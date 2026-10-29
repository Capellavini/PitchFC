-- ─────────────────────────────────────────────────────────
-- PITCH Ligas — the league's own public page (LP) at /leagues/<slug>.
--
--   1. The page exists by default: the first time a league has a name its slug is
--      reserved and the page is published. Its Gestor can hide it with one click
--      (league_workspace_set_published) and it is never switched on again by itself.
--      Leagues that already existed keep their choice (page_auto_done = true).
--   2. Fan sign-ups for the league's Pitch Manager (Fantasy): a fan leaves a name
--      and an email on the public page; only the Gestor can read or delete them.
--
--   • league_workspace_write()           the single write path now publishes the page the first time the league has a name
--   • league_workspaces.page_auto_done   the automatic publication already happened
--   • league_fan_signups                 RLS on, NO policies, no direct access
--   • league_fan_signup()                anon: sign up (idempotent per email, rate limited)
--   • league_fan_signups_list()          owner: who signed up
--   • league_fan_signup_delete()         owner: remove one person
--
-- Additive and idempotent. Errors: 'league:<code>'.
-- ─────────────────────────────────────────────────────────

-- ── 1. Published by default ──────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'league_workspaces' and column_name = 'page_auto_done') then
    -- Existing leagues: their Gestor already decided (or never asked), so nothing is switched on for them.
    alter table public.league_workspaces add column page_auto_done boolean not null default true;
    alter table public.league_workspaces alter column page_auto_done set default false;
  end if;
end $$;

-- A free slug from a league name (…-2, …-3 when taken). Serialised so two new leagues can't pick the same one.
create or replace function public.league_ws_new_slug(p_name text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_base text; v_cand text; n int := 1;
begin
  perform pg_advisory_xact_lock(hashtextextended('league_workspace_slug', 0));
  v_base := coalesce(nullif(public.team_slugify(p_name), ''), 'liga');
  v_cand := v_base;
  while exists (select 1 from public.league_workspaces where slug = v_cand) loop
    n := n + 1;
    v_cand := trim(both '-' from left(v_base, 35)) || '-' || n;
  end loop;
  return v_cand;
end $$;
revoke all on function public.league_ws_new_slug(text) from public, anon, authenticated;

-- Same write as before (the app and the WhatsApp Adjunto both go through it), plus: the first write that
-- carries a league name publishes the page.
create or replace function public.league_workspace_write(p_user uuid, p_state jsonb, p_expected integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_name text := left(btrim(coalesce(p_state #>> '{data,league,name}', '')), 120);
begin
  if p_user is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  -- coalesce: a missing key makes jsonb_typeof NULL, and `NULL <> 'object'` would skip the guard.
  if p_state is null or coalesce(jsonb_typeof(p_state), '') <> 'object'
     or coalesce(jsonb_typeof(p_state -> 'data'), '') <> 'object'
     or coalesce(jsonb_typeof(p_state -> 'matches'), '') <> 'array' then
    raise exception 'league:invalid_state' using errcode = '22023';
  end if;
  if octet_length(p_state::text) > 4000000 then raise exception 'league:state_too_large' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('league_workspace:' || p_user::text, 0));
  select * into w from public.league_workspaces where owner_user_id = p_user for update;
  if not found then
    if coalesce(p_expected, 0) <> 0 then raise exception 'league:version_conflict' using errcode = '40001'; end if;
    insert into public.league_workspaces (owner_user_id, name, state) values (p_user, v_name, p_state) returning * into w;
  else
    if w.version <> coalesce(p_expected, -1) then raise exception 'league:version_conflict' using errcode = '40001'; end if;
    update public.league_workspaces
       set state = p_state, name = v_name, version = w.version + 1, updated_at = now()
     where id = w.id returning * into w;
  end if;
  if w.slug is null and not w.page_auto_done and length(btrim(w.name)) >= 2 then
    update public.league_workspaces
       set slug = public.league_ws_new_slug(w.name), published = true, page_auto_done = true
     where id = w.id returning * into w;
  end if;
  return jsonb_build_object('id', w.id, 'version', w.version, 'slug', w.slug, 'published', w.published);
end $$;
revoke all on function public.league_workspace_write(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.league_workspace_write(uuid, jsonb, integer) to service_role;

-- ── 2. Fan sign-ups ──────────────────────────────────────
create table if not exists public.league_fan_signups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
  name text not null,
  email text not null,
  team_id text,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint league_fan_signups_name_len check (char_length(name) between 2 and 80),
  constraint league_fan_signups_email_len check (char_length(email) between 5 and 254)
);
create unique index if not exists league_fan_signups_workspace_email on public.league_fan_signups (workspace_id, lower(email));
create index if not exists league_fan_signups_workspace_created on public.league_fan_signups (workspace_id, created_at desc);
alter table public.league_fan_signups enable row level security;
revoke all on table public.league_fan_signups from public, anon, authenticated;
grant select, insert, update, delete on table public.league_fan_signups to service_role;

-- A fan signs up on the public page. Same answer for a new and a repeated email (no way to probe who signed up).
create or replace function public.league_fan_signup(p_slug text, p_name text, p_email text, p_team_id text, p_consent boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_team text := nullif(btrim(coalesce(p_team_id, '')), '');
begin
  select * into w from public.league_workspaces where slug = lower(btrim(coalesce(p_slug, ''))) and published;
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  if coalesce(w.state #>> '{data,league,page,signup}', 'true') = 'false' then raise exception 'league:signup_closed' using errcode = '22023'; end if;
  if coalesce(p_consent, false) is not true then raise exception 'league:consent_required' using errcode = '22023'; end if;
  if char_length(v_name) < 2 then raise exception 'league:name_required' using errcode = '22023'; end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'league:invalid_email' using errcode = '22023'; end if;
  if v_team is not null and not exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(w.state #> '{data,teams}') = 'array' then w.state #> '{data,teams}' else '[]'::jsonb end) t
        where t ->> 'id' = v_team) then
    v_team := null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('league_fan_signup:' || w.id::text, 0));
  if (select count(*) from public.league_fan_signups where workspace_id = w.id and created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'league:rate_limited' using errcode = '53400';
  end if;
  if (select count(*) from public.league_fan_signups where workspace_id = w.id) >= 20000 then
    raise exception 'league:signup_full' using errcode = '53400';
  end if;
  insert into public.league_fan_signups (workspace_id, name, email, team_id)
  values (w.id, v_name, v_email, v_team)
  on conflict (workspace_id, lower(email)) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- The Gestor's list (newest first).
create or replace function public.league_fan_signups_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'count', (select count(*) from public.league_fan_signups where workspace_id = w.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'email', s.email, 'team_id', s.team_id, 'created_at', s.created_at) order by s.created_at desc)
                         from (select * from public.league_fan_signups where workspace_id = w.id order by created_at desc limit 2000) s), '[]'::jsonb));
end $$;

-- Remove one person (they asked, or it was a mistake).
create or replace function public.league_fan_signup_delete(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype; n int;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  delete from public.league_fan_signups where id = p_id and workspace_id = w.id;
  get diagnostics n = row_count;
  return jsonb_build_object('deleted', n);
end $$;

revoke all on function public.league_fan_signup(text, text, text, text, boolean) from public;
revoke all on function public.league_fan_signups_list() from public, anon;
revoke all on function public.league_fan_signup_delete(uuid) from public, anon;
grant execute on function public.league_fan_signup(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.league_fan_signups_list() to authenticated;
grant execute on function public.league_fan_signup_delete(uuid) to authenticated;

comment on table public.league_fan_signups is 'PITCH Ligas: fans who signed up on a league public page for its Pitch Manager. RPC access only.';
