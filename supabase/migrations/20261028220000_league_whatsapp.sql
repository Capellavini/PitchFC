-- ─────────────────────────────────────────────────────────
-- PITCH Ligas — Adjunto on WhatsApp (same bot number as the weekly-groups Adjunto).
--
-- A league manager links their phone with a one-time code generated in the
-- app (LIGA-XXXXXX, 15 min). From then on the bot reads their messages and
-- photos (a sentence about a game, a photo of the súmula), turns them into
-- the SAME proposals the app chat uses, shows a summary and applies only on
-- "sim". The bot writes the league through league_workspace_write (service
-- role only), with the same optimistic version as the app.
--
--   league_wa_codes      one-time link codes (RPC-only for users)
--   league_wa_links      one linked WhatsApp per account
--   league_wa_pending    proposals waiting for "sim"/"não" (30 min)
--   league_wa_usage      daily cap of model calls per account
--   league_workspace_write(user, state, expected)   the single write path (the
--                        app's league_workspace_save now calls it too)
-- Tables: RLS on, no policies, no grants to anon/authenticated.
-- ─────────────────────────────────────────────────────────

-- ── 1. One write path for the league document ────────────
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
  return jsonb_build_object('id', w.id, 'version', w.version, 'slug', w.slug, 'published', w.published);
end $$;
revoke all on function public.league_workspace_write(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.league_workspace_write(uuid, jsonb, integer) to service_role;

create or replace function public.league_workspace_save(p_state jsonb, p_expected_version integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  return public.league_workspace_write(auth.uid(), p_state, p_expected_version);
end $$;
revoke all on function public.league_workspace_save(jsonb, integer) from public, anon;
grant execute on function public.league_workspace_save(jsonb, integer) to authenticated;

-- ── 2. Tables ────────────────────────────────────────────
create table if not exists public.league_wa_codes (
  code text primary key check (code ~ '^LIGA-[A-HJ-NP-Z2-9]{6}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz,
  used_jid text
);
create table if not exists public.league_wa_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wa_jid text not null unique,
  wa_lid text,
  wa_pn text,
  enabled boolean not null default true,
  linked_at timestamptz not null default now(),
  last_inbound_at timestamptz
);
create table if not exists public.league_wa_pending (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  summary text not null default '',
  status text not null default 'pending' check (status in ('pending', 'applied', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index if not exists league_wa_pending_user on public.league_wa_pending (user_id, status, created_at desc);
create table if not exists public.league_wa_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  calls integer not null check (calls between 1 and 40),
  primary key (user_id, usage_day)
);
alter table public.league_wa_codes enable row level security;
alter table public.league_wa_links enable row level security;
alter table public.league_wa_pending enable row level security;
alter table public.league_wa_usage enable row level security;
revoke all on table public.league_wa_codes, public.league_wa_links, public.league_wa_pending, public.league_wa_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.league_wa_codes, public.league_wa_links, public.league_wa_pending, public.league_wa_usage to service_role;

-- ── 3. App: link code and status ─────────────────────────
create or replace function public.league_wa_gen_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  s text := 'LIGA-';
begin
  for i in 0..5 loop s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
  return s;
end $$;
revoke all on function public.league_wa_gen_code() from public, anon, authenticated;

create or replace function public.league_wa_create_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_code text; v_recent int;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('league_wa_code:' || auth.uid()::text, 0));
  select count(*) into v_recent from public.league_wa_codes where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'league:rate_limited' using errcode = 'P0001'; end if;
  update public.league_wa_codes set expires_at = now() where user_id = auth.uid() and used_at is null and expires_at > now();
  loop
    v_code := public.league_wa_gen_code();
    insert into public.league_wa_codes (code, user_id) values (v_code, auth.uid()) on conflict (code) do nothing;
    exit when found;
  end loop;
  return v_code;
end $$;
revoke all on function public.league_wa_create_code() from public, anon;
grant execute on function public.league_wa_create_code() to authenticated;

create or replace function public.league_wa_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare l public.league_wa_links%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into l from public.league_wa_links where user_id = auth.uid() and enabled;
  if not found then return jsonb_build_object('linked', false); end if;
  return jsonb_build_object('linked', true, 'linked_at', l.linked_at,
    'phone', case when l.wa_pn is null then null else repeat('•', greatest(length(l.wa_pn) - 3, 0)) || right(l.wa_pn, 3) end);
end $$;
revoke all on function public.league_wa_status() from public, anon;
grant execute on function public.league_wa_status() to authenticated;

create or replace function public.league_wa_unlink()
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  delete from public.league_wa_links where user_id = auth.uid();
  update public.league_wa_pending set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  return true;
end $$;
revoke all on function public.league_wa_unlink() from public, anon;
grant execute on function public.league_wa_unlink() to authenticated;

-- ── 4. Bot (service role only) ───────────────────────────
-- Consumes a code and links the sender. A jid linked to ANOTHER account is released first.
create or replace function public.league_wa_consume_code(p_code text, p_jid text, p_lid text default null, p_pn text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid;
begin
  update public.league_wa_codes set used_at = now(), used_jid = p_jid
   where code = upper(btrim(p_code)) and used_at is null and expires_at > now()
   returning user_id into v_user;
  if v_user is null then return null; end if;
  delete from public.league_wa_links where wa_jid = p_jid and user_id <> v_user;
  insert into public.league_wa_links (user_id, wa_jid, wa_lid, wa_pn, enabled, linked_at)
    values (v_user, p_jid, p_lid, p_pn, true, now())
    on conflict (user_id) do update set wa_jid = excluded.wa_jid, wa_lid = excluded.wa_lid, wa_pn = excluded.wa_pn, enabled = true, linked_at = now();
  return v_user;
end $$;
revoke all on function public.league_wa_consume_code(text, text, text, text) from public, anon, authenticated;
grant execute on function public.league_wa_consume_code(text, text, text, text) to service_role;

create or replace function public.league_wa_workspace_of(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  select * into w from public.league_workspaces where owner_user_id = p_user;
  if not found then return null; end if;
  return jsonb_build_object('version', w.version, 'state', w.state, 'slug', w.slug, 'published', w.published);
end $$;
revoke all on function public.league_wa_workspace_of(uuid) from public, anon, authenticated;
grant execute on function public.league_wa_workspace_of(uuid) to service_role;

create or replace function public.league_wa_take_slot(p_user uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_calls integer;
begin
  insert into public.league_wa_usage as u (user_id, usage_day, calls)
    values (p_user, (now() at time zone 'UTC')::date, 1)
    on conflict (user_id, usage_day) do update set calls = u.calls + 1 where u.calls < 40
    returning calls into v_calls;
  return v_calls is not null;
end $$;
revoke all on function public.league_wa_take_slot(uuid) from public, anon, authenticated;
grant execute on function public.league_wa_take_slot(uuid) to service_role;

comment on table public.league_wa_links is 'PITCH Ligas: WhatsApp linked to a league account. Service role and league_wa_* RPCs only.';
