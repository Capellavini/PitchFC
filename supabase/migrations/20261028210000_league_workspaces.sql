-- ─────────────────────────────────────────────────────────
-- PITCH Ligas — workspace "bridge" (option A).
--
-- The new Ligas app (Gestor Painel, Gerir, Adjunto…) keeps the whole league as
-- ONE state document. Until it is mapped onto the relational league tables
-- (L1–L3), that document lives here: one workspace per account, saved with
-- optimistic concurrency, readable by the public only through a sanitized
-- projection once the owner publishes it.
--
--   • league_workspaces            one row per owner (RLS on, NO policies, no
--                                  direct table access: every access is an RPC)
--   • league_workspace_get()       my workspace or null
--   • league_workspace_save()      create/replace, guarded by expected version
--   • league_workspace_set_published()  turn the public page on/off (slug)
--   • league_workspace_public()    PII-light projection for /l/<slug>
--
-- Direct creation: no pilot request is needed to start a workspace. The
-- relational league tables (leagues, competitions…) are untouched.
-- Errors: 'league:<code>'. Idempotent where possible.
-- ─────────────────────────────────────────────────────────
create table if not exists public.league_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text unique,
  name text not null default '',
  state jsonb not null,
  version integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint league_workspaces_state_object check (jsonb_typeof(state) = 'object'),
  constraint league_workspaces_state_size check (octet_length(state::text) <= 4000000)
);
alter table public.league_workspaces enable row level security;
revoke all on table public.league_workspaces from public, anon, authenticated;
grant select, insert, update, delete on table public.league_workspaces to service_role;

-- ── 1. My workspace ──────────────────────────────────────
create or replace function public.league_workspace_get()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object('id', w.id, 'slug', w.slug, 'name', w.name, 'version', w.version,
                            'published', w.published, 'state', w.state, 'updated_at', w.updated_at);
end $$;

-- ── 2. Save (create when p_expected_version = 0) ─────────
create or replace function public.league_workspace_save(p_state jsonb, p_expected_version integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_name text := left(btrim(coalesce(p_state #>> '{data,league,name}', '')), 120);
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  -- coalesce: a missing key makes jsonb_typeof NULL, and `NULL <> 'object'` would skip the guard.
  if p_state is null or coalesce(jsonb_typeof(p_state), '') <> 'object'
     or coalesce(jsonb_typeof(p_state -> 'data'), '') <> 'object'
     or coalesce(jsonb_typeof(p_state -> 'matches'), '') <> 'array' then
    raise exception 'league:invalid_state' using errcode = '22023';
  end if;
  if octet_length(p_state::text) > 4000000 then raise exception 'league:state_too_large' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('league_workspace:' || auth.uid()::text, 0));
  select * into w from public.league_workspaces where owner_user_id = auth.uid() for update;
  if not found then
    if coalesce(p_expected_version, 0) <> 0 then raise exception 'league:version_conflict' using errcode = '40001'; end if;
    insert into public.league_workspaces (owner_user_id, name, state) values (auth.uid(), v_name, p_state) returning * into w;
  else
    if w.version <> coalesce(p_expected_version, -1) then raise exception 'league:version_conflict' using errcode = '40001'; end if;
    update public.league_workspaces
       set state = p_state, name = v_name, version = w.version + 1, updated_at = now()
     where id = w.id returning * into w;
  end if;
  return jsonb_build_object('id', w.id, 'version', w.version, 'slug', w.slug, 'published', w.published);
end $$;

-- ── 3. Publish / unpublish the public page ───────────────
create or replace function public.league_workspace_set_published(p_published boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_base text; v_cand text; n int := 1;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid() for update;
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  if p_published and w.slug is null then
    if length(btrim(w.name)) < 2 then raise exception 'league:name_required' using errcode = '22023'; end if;
    v_base := coalesce(nullif(public.team_slugify(w.name), ''), 'liga');
    v_cand := v_base;
    while exists (select 1 from public.league_workspaces where slug = v_cand) loop
      n := n + 1;
      v_cand := trim(both '-' from left(v_base, 35)) || '-' || n;
    end loop;
    update public.league_workspaces set slug = v_cand where id = w.id;
  end if;
  update public.league_workspaces set published = coalesce(p_published, false), updated_at = now()
   where id = w.id returning * into w;
  return jsonb_build_object('slug', w.slug, 'published', w.published);
end $$;

-- ── 4. Public projection (anon) ──────────────────────────
-- Only a published workspace; players reduced to name, number, position and
-- team; no viewer, preferences, Fantasy picks or fan votes.
create or replace function public.league_workspace_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype; s jsonb; players jsonb;
begin
  select * into w from public.league_workspaces where slug = lower(btrim(coalesce(p_slug, ''))) and published;
  if not found then return null; end if;
  s := w.state;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p -> 'id', 'teamId', p -> 'teamId', 'name', p -> 'name', 'nick', p -> 'nick',
           'position', p -> 'position', 'number', p -> 'number', 'captain', coalesce(p -> 'captain', 'false'::jsonb))), '[]'::jsonb)
    into players
    from jsonb_array_elements(case when jsonb_typeof(s #> '{data,players}') = 'array' then s #> '{data,players}' else '[]'::jsonb end) p;
  return jsonb_build_object(
    'slug', w.slug, 'name', w.name, 'updated_at', w.updated_at,
    'state', jsonb_build_object(
      'version', s -> 'version',
      'data', jsonb_build_object(
        'league', coalesce(s #> '{data,league}', '{}'::jsonb),
        'competitions', coalesce(s #> '{data,competitions}', '[]'::jsonb),
        'teams', coalesce(s #> '{data,teams}', '[]'::jsonb),
        'players', players),
      'modules', coalesce(s -> 'modules', '{}'::jsonb),
      'matches', coalesce(s -> 'matches', '[]'::jsonb),
      'logs', coalesce(s -> 'logs', '{}'::jsonb),
      'announcements', coalesce(s -> 'announcements', '[]'::jsonb),
      'fanVotes', '{}'::jsonb, 'fantasy', '{}'::jsonb,
      'viewer', jsonb_build_object('role', 'fan', 'entered', true),
      'prefs', jsonb_build_object('supportTeamId', null, 'followTeamIds', '[]'::jsonb, 'followPlayerIds', '[]'::jsonb,
                                  'notifyResults', true, 'notifyCalendar', true)));
end $$;

revoke all on function public.league_workspace_get() from public, anon;
revoke all on function public.league_workspace_save(jsonb, integer) from public, anon;
revoke all on function public.league_workspace_set_published(boolean) from public, anon;
revoke all on function public.league_workspace_public(text) from public;
grant execute on function public.league_workspace_get() to authenticated;
grant execute on function public.league_workspace_save(jsonb, integer) to authenticated;
grant execute on function public.league_workspace_set_published(boolean) to authenticated;
grant execute on function public.league_workspace_public(text) to anon, authenticated;

comment on table public.league_workspaces is 'PITCH Ligas bridge: one state document per owner; access only through league_workspace_* RPCs.';
