-- ─────────────────────────────────────────────────────────
-- Migration — PITCH Rivals (1/3): teams, roles, invites, audit
--
-- Plan: docs/RIVALS-PLAN.md §2 "007000_rivals_teams" + §3 "Teams" RPCs.
-- Spec: docs/TEAMS-CHALLENGES-SPEC.md (owner decisions block wins).
--
-- What this does
--   • teams        + slug (unique, backfilled), secondary_color, home_venue,
--                    preferred_format, created_by, updated_at, archived_at,
--                    timezone, currency; double-tap guard
--                    unique (created_by, lower(name)) where not archived.
--   • team_members + role 'vice', status active/left/removed, left_at;
--                    one active captain + at most one active vice per team
--                    (unique partial indexes); captain rows backfilled.
--   • team_invites   (new) expiring / revocable / counted roster links.
--   • rivals_audit_log (new) one row per state transition.
--   • Helpers team_role / is_team_member / is_team_leader /
--     is_team_captain / can_manage_team (redefined: captain OR vice).
--   • RLS: read-only policies; ALL writes go through the SECURITY DEFINER
--     RPCs below (closes the migration-49 holes: self-insert into any
--     team, captain_id hijack, roster auto-add without consent).
--
-- Never touches games / attendances / matchdays (option B). The policy
-- fingerprint of those three tables is recorded in rivals_audit_log
-- ('migration_baseline:007000') BEFORE anything else runs, so
-- supabase/tests/rivals_teams_check.sql can prove it is unchanged.
--
-- Legacy (migration 49) rosters: every existing team_members row is kept
-- and stays 'active' (owner decision on consent-less auto-adds pending —
-- plan "Open questions" #3). The backfill only ADDS the missing captain
-- rows / normalises roles; it never deletes or deactivates anyone.
--
-- Errors: every RPC raises 'rivals:<code>' (the app maps <code> to copy).
-- Idempotent: safe to re-run (if not exists / create or replace / guarded
-- constraint + policy creation).
-- ─────────────────────────────────────────────────────────

-- ── 0. Audit log first (it also stores the regression baseline) ──────
create table if not exists public.rivals_audit_log (
  id               bigserial primary key,
  team_id          uuid references public.teams(id) on delete set null,
  challenge_id     uuid,   -- FK added by 007100 (team_challenges)
  match_id         uuid,   -- FK added by 007100 (team_matches)
  actor_player_id  uuid references public.players(id) on delete set null,
  action           text not null check (char_length(action) between 1 and 80),
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists rivals_audit_log_team_idx on public.rivals_audit_log (team_id, created_at desc);

-- Fingerprint of the group-game policies, captured before this migration
-- changes anything (only on the first run).
insert into public.rivals_audit_log (action, payload)
select 'migration_baseline:007000', jsonb_build_object(
  'group_policies_md5', (
    select md5(coalesce(string_agg(
      format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
             coalesce(qual, ''), coalesce(with_check, '')),
      E'\n' order by tablename, policyname), ''))
    from pg_policies
    where schemaname = 'public' and tablename in ('games', 'attendances', 'matchdays')
  ))
where not exists (select 1 from public.rivals_audit_log where action = 'migration_baseline:007000');

-- ── 1. teams: new columns ────────────────────────────────
alter table public.teams
  add column if not exists slug             text,
  add column if not exists secondary_color  text,
  add column if not exists home_venue       text,
  add column if not exists preferred_format text,
  add column if not exists created_by       uuid references public.players(id) on delete set null,
  add column if not exists updated_at       timestamptz not null default now(),
  add column if not exists archived_at      timestamptz,
  add column if not exists timezone         text not null default 'Europe/Lisbon',
  add column if not exists currency         text not null default 'EUR';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'teams_preferred_format_check') then
    alter table public.teams add constraint teams_preferred_format_check
      check (preferred_format is null or preferred_format in ('5v5','6v6','7v7','8v8','9v9','11v11'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_currency_check') then
    alter table public.teams add constraint teams_currency_check check (currency in ('EUR','BRL'));
  end if;
end $$;

-- Slug: lower-case ascii words joined by '-', max 40 chars, never empty.
-- Mirrored by slugify() in src/lib/rivals.js (demo mode).
create or replace function public.team_slugify(p text)
returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(
    trim(both '-' from left(trim(both '-' from regexp_replace(lower(translate(coalesce(p, ''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9]+', '-', 'g')), 40)),
    ''), 'equipa');
$$;

-- First free slug for a name: base, base-2, base-3 …
create or replace function public.rivals_unique_slug(p_name text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_base text := public.team_slugify(p_name);
  v_cand text := v_base;
  n int := 1;
begin
  while exists (select 1 from public.teams where slug = v_cand) loop
    n := n + 1;
    v_cand := trim(both '-' from left(v_base, 35)) || '-' || n;
  end loop;
  return v_cand;
end $$;

-- Backfill slugs (oldest team keeps the bare slug).
do $$
declare r record;
begin
  for r in select id, name from public.teams where slug is null order by created_at, id loop
    update public.teams set slug = public.rivals_unique_slug(r.name) where id = r.id;
  end loop;
end $$;
alter table public.teams alter column slug set not null;
create unique index if not exists teams_slug_key on public.teams (slug);

-- ── 2. Legacy captaincy normalisation (never drops a member) ─────────
-- a) A team whose captain row was deleted (captain_id set null) gets its
--    earliest member as captain, so no team is left without a leader.
update public.teams t
   set captain_id = (select m.player_id from public.team_members m
                      where m.team_id = t.id order by m.joined_at, m.id limit 1)
 where t.captain_id is null
   and exists (select 1 from public.team_members m where m.team_id = t.id);
-- b) A team with no captain AND no members is an empty shell: archive it
--    (kept, just hidden — nothing to lose).
update public.teams t
   set archived_at = now()
 where t.captain_id is null and t.archived_at is null
   and not exists (select 1 from public.team_members m where m.team_id = t.id);
-- c) created_by = captain for legacy rows; when one captain has two live
--    teams with the same name (the double-tap bug), only the oldest gets
--    created_by so the new unique index can be built — nothing archived.
update public.teams t
   set created_by = t.captain_id
  from (select id, row_number() over (partition by captain_id, lower(name) order by created_at, id) as rn
          from public.teams
         where archived_at is null and captain_id is not null) d
 where d.id = t.id and d.rn = 1 and t.created_by is null;
create unique index if not exists teams_creator_name_live_key
  on public.teams (created_by, lower(name)) where archived_at is null;

-- ── 3. team_members: roles + status + history ────────────
alter table public.team_members
  add column if not exists status  text not null default 'active',
  add column if not exists left_at timestamptz;

alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('captain','vice','player'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_members_status_check') then
    alter table public.team_members add constraint team_members_status_check
      check (status in ('active','left','removed'));
  end if;
end $$;

-- Stray 'captain' rows that aren't teams.captain_id → 'player' (kept active).
update public.team_members m
   set role = 'player'
  from public.teams t
 where t.id = m.team_id and m.role = 'captain' and m.player_id is distinct from t.captain_id;
-- Every captain has an active captain row.
insert into public.team_members (team_id, player_id, role, status)
select t.id, t.captain_id, 'captain', 'active'
  from public.teams t
 where t.captain_id is not null
on conflict (team_id, player_id) do update
  set role = 'captain', status = 'active', left_at = null;

create unique index if not exists team_members_one_captain_key
  on public.team_members (team_id) where role = 'captain' and status = 'active';
create unique index if not exists team_members_one_vice_key
  on public.team_members (team_id) where role = 'vice' and status = 'active';
create index if not exists team_members_player_active_idx
  on public.team_members (player_id, team_id) where status = 'active';

-- ── 4. team_invites ──────────────────────────────────────
-- 32 hex chars from gen_random_uuid() (122 random bits, core — no pgcrypto
-- schema dependency). One live (not revoked) link per team.
create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by  uuid references public.players(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  revoked_at  timestamptz,
  max_uses    int check (max_uses is null or max_uses between 1 and 100),
  uses        int not null default 0 check (uses >= 0)
);
create unique index if not exists team_invites_one_live_key
  on public.team_invites (team_id) where revoked_at is null;

-- ── 5. Helpers (SECURITY DEFINER: used inside RLS without recursion) ─
create or replace function public.team_role(t uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.team_members m
   where m.team_id = t and m.player_id = public.my_player_id() and m.status = 'active'
   limit 1;
$$;

create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.team_role(t) is not null;
$$;

create or replace function public.is_team_leader(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.team_role(t) in ('captain','vice'), false);
$$;

create or replace function public.is_team_captain(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.team_role(t) = 'captain', false);
$$;

-- Redefined (was: captain_id = me). Captain OR vice manage the roster;
-- captain-only actions check is_team_captain explicitly.
create or replace function public.can_manage_team(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_team_leader(t);
$$;

-- Internal: one audit row (actor = caller's player).
create or replace function public.rivals_audit(p_team uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.rivals_audit_log (team_id, actor_player_id, action, payload)
  values (p_team, public.my_player_id(), p_action, coalesce(p_payload, '{}'::jsonb));
$$;

-- Internal: validate an editable-fields object (allow-list + formats).
create or replace function public.rivals_validate_team_fields(f jsonb, p_allow_group boolean default false)
returns void language plpgsql immutable set search_path = public as $$
declare k text;
begin
  if f is null then return; end if;
  if jsonb_typeof(f) <> 'object' then raise exception 'rivals:invalid_field'; end if;
  for k in select jsonb_object_keys(f) loop
    if k not in ('name','city','color','secondary_color','home_venue','preferred_format','logo_url','timezone','currency')
       and not (p_allow_group and k = 'founded_by_group_id') then
      raise exception 'rivals:invalid_field' using detail = k;
    end if;
  end loop;
  if f ? 'name' and char_length(btrim(coalesce(f->>'name', ''))) not between 2 and 40 then
    raise exception 'rivals:invalid_name';
  end if;
  if coalesce(f->>'color', '#000000') !~ '^#[0-9A-Fa-f]{6}$'
     or coalesce(f->>'secondary_color', '#000000') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'rivals:invalid_color';
  end if;
  if f->>'preferred_format' is not null and f->>'preferred_format' not in ('5v5','6v6','7v7','8v8','9v9','11v11') then
    raise exception 'rivals:invalid_format';
  end if;
  if f->>'currency' is not null and f->>'currency' not in ('EUR','BRL') then
    raise exception 'rivals:invalid_currency';
  end if;
  if f->>'timezone' is not null and f->>'timezone' not in ('Europe/Lisbon','Atlantic/Azores','Atlantic/Madeira','America/Sao_Paulo') then
    raise exception 'rivals:invalid_timezone';
  end if;
  if char_length(coalesce(f->>'city', '')) > 60 or char_length(coalesce(f->>'home_venue', '')) > 80 then
    raise exception 'rivals:field_too_long';
  end if;
  if f->>'logo_url' is not null and (f->>'logo_url' !~ '^https://' or char_length(f->>'logo_url') > 500) then
    raise exception 'rivals:invalid_logo';
  end if;
end $$;

-- ── 6. RLS: read-only policies, no write policies at all ──
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.team_invites     enable row level security;
alter table public.rivals_audit_log enable row level security;

drop policy if exists "teams select" on public.teams;
drop policy if exists "teams insert" on public.teams;
drop policy if exists "teams update" on public.teams;
drop policy if exists "teams delete" on public.teams;
create policy "teams select" on public.teams for select to authenticated using (true);

drop policy if exists "team_members select" on public.team_members;
drop policy if exists "team_members insert" on public.team_members;
drop policy if exists "team_members update" on public.team_members;
drop policy if exists "team_members delete" on public.team_members;
-- Active rosters are public to signed-in users (team pages); your own
-- history and your teams' full history (left/removed) only to you/them.
create policy "team_members select" on public.team_members for select to authenticated
  using (status = 'active' or player_id = public.my_player_id() or public.is_team_member(team_id) or public.is_admin());

drop policy if exists "team_invites select" on public.team_invites;
create policy "team_invites select" on public.team_invites for select to authenticated
  using (public.is_team_leader(team_id) or public.is_admin());

drop policy if exists "rivals_audit_log select" on public.rivals_audit_log;
create policy "rivals_audit_log select" on public.rivals_audit_log for select to authenticated
  using ((team_id is not null and public.is_team_member(team_id)) or public.is_admin());

-- ── 7. Table grants (explicit — see CLAUDE.md, Oct 30 2026 change) ──
revoke all on table public.teams            from anon;
revoke all on table public.team_members     from anon;
revoke insert, update, delete, truncate on table public.teams        from authenticated;
revoke insert, update, delete, truncate on table public.team_members from authenticated;
grant  select on table public.teams        to authenticated;
grant  select on table public.team_members to authenticated;
grant  all    on table public.teams        to service_role;
grant  all    on table public.team_members to service_role;

revoke all on table public.team_invites     from anon, authenticated;
revoke all on table public.rivals_audit_log from anon, authenticated;
grant  select on table public.team_invites     to authenticated;
grant  select on table public.rivals_audit_log to authenticated;
grant  all    on table public.team_invites     to service_role;
grant  all    on table public.rivals_audit_log to service_role;
revoke all on sequence public.rivals_audit_log_id_seq from anon, authenticated;
grant  usage, select on sequence public.rivals_audit_log_id_seq to service_role;

-- Realtime (useTeams refetches on roster/team changes; RLS still applies).
do $$ begin alter publication supabase_realtime add table public.teams;        exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.team_members; exception when others then null; end $$;

-- ── 8. RPCs ──────────────────────────────────────────────

-- create_team(name, fields) → {team_id, slug, created}
-- Caller becomes captain. NO roster auto-add (players join via invite).
-- Idempotent on double-tap: same creator + same live name → the existing
-- team with created = false.
create or replace function public.create_team(p_name text, p_fields jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_name  text := btrim(coalesce(p_name, ''));
  f       jsonb := coalesce(p_fields, '{}'::jsonb);
  v_team  public.teams%rowtype;
  v_group uuid;
  v_n     int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  perform public.rivals_validate_team_fields(f || jsonb_build_object('name', v_name), true);

  perform pg_advisory_xact_lock(hashtextextended('rivals_create_team:' || v_pid::text, 0));

  select * into v_team from public.teams
   where created_by = v_pid and lower(name) = lower(v_name) and archived_at is null limit 1;
  if found then
    return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug, 'created', false);
  end if;

  select count(*) into v_n from public.teams where captain_id = v_pid and archived_at is null;
  if v_n >= 5 then raise exception 'rivals:too_many_teams'; end if;

  begin
    v_group := nullif(f->>'founded_by_group_id', '')::uuid;
  exception when others then v_group := null;
  end;
  if v_group is not null and not exists (
    select 1 from public.player_group_memberships
     where player_id = v_pid and group_id = v_group and not banned) then
    v_group := null;
  end if;

  for i in 1..3 loop
    begin
      insert into public.teams (name, slug, city, color, secondary_color, home_venue, preferred_format,
                                logo_url, timezone, currency, captain_id, created_by, founded_by_group_id)
      values (v_name, public.rivals_unique_slug(v_name), nullif(btrim(f->>'city'), ''),
              coalesce(f->>'color', '#C8FF00'), f->>'secondary_color', nullif(btrim(f->>'home_venue'), ''),
              coalesce(f->>'preferred_format', '7v7'), nullif(f->>'logo_url', ''),
              coalesce(f->>'timezone', 'Europe/Lisbon'), coalesce(f->>'currency', 'EUR'),
              v_pid, v_pid, v_group)
      returning * into v_team;
      exit;
    exception when unique_violation then
      if i = 3 then raise exception 'rivals:try_again'; end if;  -- slug race with another creator
    end;
  end loop;

  insert into public.team_members (team_id, player_id, role, status) values (v_team.id, v_pid, 'captain', 'active');
  perform public.rivals_audit(v_team.id, 'team_created', jsonb_build_object('name', v_name, 'slug', v_team.slug));
  return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug, 'created', true);
end $$;

-- update_team(team, fields) → {team_id, slug}
-- Leaders edit the allow-listed fields; renaming is captain-only; the
-- slug never changes (links stay valid).
create or replace function public.update_team(p_team_id uuid, p_fields jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  f      jsonb := coalesce(p_fields, '{}'::jsonb);
  v_team public.teams%rowtype;
  v_role text;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  v_role := public.team_role(p_team_id);
  if not (public.is_admin() or v_role in ('captain','vice')) then
    raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;
  if f ? 'name' and not (public.is_admin() or v_role = 'captain') then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  perform public.rivals_validate_team_fields(f, false);

  begin
    update public.teams set
      name             = case when f ? 'name'             then btrim(f->>'name') else name end,
      city             = case when f ? 'city'             then nullif(btrim(f->>'city'), '') else city end,
      color            = case when f ? 'color'            then coalesce(f->>'color', color) else color end,
      secondary_color  = case when f ? 'secondary_color'  then f->>'secondary_color' else secondary_color end,
      home_venue       = case when f ? 'home_venue'       then nullif(btrim(f->>'home_venue'), '') else home_venue end,
      preferred_format = case when f ? 'preferred_format' then f->>'preferred_format' else preferred_format end,
      logo_url         = case when f ? 'logo_url'         then nullif(f->>'logo_url', '') else logo_url end,
      timezone         = case when f ? 'timezone'         then coalesce(f->>'timezone', timezone) else timezone end,
      currency         = case when f ? 'currency'         then coalesce(f->>'currency', currency) else currency end,
      updated_at       = now()
    where id = p_team_id;
  exception when unique_violation then
    raise exception 'rivals:duplicate_name';
  end;

  perform public.rivals_audit(p_team_id, 'team_updated',
    jsonb_build_object('fields', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(f) k)));
  return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug);
end $$;

-- archive_team(team) → {team_id, archived_at}. Captain only. Members and
-- history are kept; the live invite is revoked.
-- EXTENSION POINT: 007100 replaces this to also block while a match is
-- scheduled and cancel the team's pending challenges.
create or replace function public.archive_team(p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_team public.teams%rowtype;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if not (public.is_admin() or public.is_team_captain(p_team_id)) then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  if v_team.archived_at is not null then
    return jsonb_build_object('team_id', p_team_id, 'archived_at', v_team.archived_at);
  end if;
  update public.teams set archived_at = now(), updated_at = now() where id = p_team_id;
  update public.team_invites set revoked_at = now() where team_id = p_team_id and revoked_at is null;
  perform public.rivals_audit(p_team_id, 'team_archived', '{}'::jsonb);
  return jsonb_build_object('team_id', p_team_id, 'archived_at', now());
end $$;

-- create_team_invite(team, rotate, ttl_days, max_uses)
--   → {token, expires_at, max_uses, uses, created_at}
-- Leaders only. Returns the current live link unless it's expired / used
-- up or p_rotate = true, in which case the old one is revoked first.
create or replace function public.create_team_invite(p_team_id uuid, p_rotate boolean default false,
                                                     p_ttl_days int default 14, p_max_uses int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_inv  public.team_invites%rowtype;
  v_had  boolean := false;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if not public.can_manage_team(p_team_id) then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  if coalesce(p_ttl_days, 14) not between 1 and 30 then raise exception 'rivals:invalid_expiry'; end if;
  if p_max_uses is not null and p_max_uses not between 1 and 100 then raise exception 'rivals:invalid_max_uses'; end if;

  select * into v_inv from public.team_invites where team_id = p_team_id and revoked_at is null for update;
  if found then
    v_had := true;
    if not coalesce(p_rotate, false) and v_inv.expires_at > now()
       and (v_inv.max_uses is null or v_inv.uses < v_inv.max_uses) then
      return jsonb_build_object('token', v_inv.token, 'expires_at', v_inv.expires_at, 'max_uses', v_inv.max_uses,
                                'uses', v_inv.uses, 'created_at', v_inv.created_at);
    end if;
    update public.team_invites set revoked_at = now() where id = v_inv.id;
  end if;

  -- clock_timestamp(): ordering vs. a removal in the same transaction
  -- matters (accept_team_invite compares left_at with created_at).
  insert into public.team_invites (team_id, created_by, created_at, expires_at, max_uses)
  values (p_team_id, public.my_player_id(), clock_timestamp(),
          now() + make_interval(days => coalesce(p_ttl_days, 14)), p_max_uses)
  returning * into v_inv;
  perform public.rivals_audit(p_team_id, 'invite_created',
    jsonb_build_object('invite_id', v_inv.id, 'replaced_previous', v_had, 'ttl_days', coalesce(p_ttl_days, 14), 'max_uses', p_max_uses));
  return jsonb_build_object('token', v_inv.token, 'expires_at', v_inv.expires_at, 'max_uses', v_inv.max_uses,
                            'uses', v_inv.uses, 'created_at', v_inv.created_at);
end $$;

-- revoke_team_invite(team) → {revoked}. Leaders only.
create or replace function public.revoke_team_invite(p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_n int;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'rivals:team_not_found'; end if;
  if not public.can_manage_team(p_team_id) then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  update public.team_invites set revoked_at = now() where team_id = p_team_id and revoked_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then perform public.rivals_audit(p_team_id, 'invite_revoked', '{}'::jsonb); end if;
  return jsonb_build_object('revoked', v_n);
end $$;

-- team_invite_preview(token) — anon OK. What the invite page shows before
-- login: {status, expires_at, team{…, member_count}, invited_by,
-- already_member}. status: valid | expired | revoked | used_up |
-- archived | not_found. Never returns the roster.
create or replace function public.team_invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inv  public.team_invites%rowtype;
  v_team public.teams%rowtype;
  v_pid  uuid := public.my_player_id();
  v_status text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_inv from public.team_invites where token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into v_team from public.teams where id = v_inv.team_id;
  v_status := case
    when v_team.archived_at is not null then 'archived'
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.expires_at <= now() then 'expired'
    when v_inv.max_uses is not null and v_inv.uses >= v_inv.max_uses then 'used_up'
    else 'valid' end;
  return jsonb_build_object(
    'status', v_status,
    'expires_at', v_inv.expires_at,
    'team', jsonb_build_object(
      'name', v_team.name, 'slug', v_team.slug, 'city', v_team.city, 'color', v_team.color,
      'secondary_color', v_team.secondary_color, 'logo_url', v_team.logo_url,
      'preferred_format', v_team.preferred_format,
      'member_count', (select count(*) from public.team_members m where m.team_id = v_team.id and m.status = 'active')),
    'invited_by', (select coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) from public.players p where p.id = v_inv.created_by),
    'already_member', v_pid is not null and exists (
      select 1 from public.team_members m where m.team_id = v_team.id and m.player_id = v_pid and m.status = 'active'));
end $$;

-- accept_team_invite(token) → {team_id, slug, name, already_member}
-- Always joins as 'player' (an invite never grants captain/vice).
-- Idempotent: an active member gets already_member = true and the
-- invite's use count is untouched. A removed player can only come back
-- through a link created AFTER their removal.
create or replace function public.accept_team_invite(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  v_inv  public.team_invites%rowtype;
  v_team public.teams%rowtype;
  v_mem  public.team_members%rowtype;
begin
  if v_pid is null then raise exception 'rivals:no_profile' using errcode = '42501'; end if;
  select * into v_inv from public.team_invites where token = p_token for update;
  if not found then raise exception 'rivals:invite_not_found'; end if;
  select * into v_team from public.teams where id = v_inv.team_id for update;

  select * into v_mem from public.team_members where team_id = v_team.id and player_id = v_pid;
  if found and v_mem.status = 'active' then
    return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug, 'name', v_team.name, 'already_member', true);
  end if;

  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if v_inv.revoked_at is not null then raise exception 'rivals:invite_revoked'; end if;
  if v_inv.expires_at <= now() then raise exception 'rivals:invite_expired'; end if;
  if v_inv.max_uses is not null and v_inv.uses >= v_inv.max_uses then raise exception 'rivals:invite_used_up'; end if;
  if v_mem.id is not null and v_mem.status = 'removed' and v_mem.left_at >= v_inv.created_at then
    raise exception 'rivals:removed_from_team';
  end if;
  if (select count(*) from public.team_members where team_id = v_team.id and status = 'active') >= 40 then
    raise exception 'rivals:team_full';
  end if;

  if v_mem.id is not null then
    update public.team_members set role = 'player', status = 'active', left_at = null, joined_at = now() where id = v_mem.id;
  else
    insert into public.team_members (team_id, player_id, role, status) values (v_team.id, v_pid, 'player', 'active');
  end if;
  update public.team_invites set uses = uses + 1 where id = v_inv.id;
  perform public.rivals_audit(v_team.id, 'member_joined', jsonb_build_object('player_id', v_pid, 'invite_id', v_inv.id, 'rejoined', v_mem.id is not null));
  return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug, 'name', v_team.name, 'already_member', false);
end $$;

-- set_member_role(team, player, 'vice'|'player') → {team_id, player_id, role, demoted}
-- Captain only. Naming a new vice demotes the previous one (≤1 vice).
create or replace function public.set_member_role(p_team_id uuid, p_player_id uuid, p_role text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team    public.teams%rowtype;
  v_mem     public.team_members%rowtype;
  v_demoted uuid;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_role not in ('vice','player') then raise exception 'rivals:invalid_role'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if not (public.is_admin() or public.is_team_captain(p_team_id)) then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  select * into v_mem from public.team_members where team_id = p_team_id and player_id = p_player_id and status = 'active';
  if not found then raise exception 'rivals:not_a_member'; end if;
  if v_mem.role = 'captain' then raise exception 'rivals:use_transfer'; end if;
  if v_mem.role = p_role then
    return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id, 'role', p_role, 'demoted', null);
  end if;
  if p_role = 'vice' then
    update public.team_members set role = 'player'
     where team_id = p_team_id and role = 'vice' and status = 'active' and player_id <> p_player_id
     returning player_id into v_demoted;
  end if;
  update public.team_members set role = p_role where id = v_mem.id;
  perform public.rivals_audit(p_team_id, 'role_changed',
    jsonb_build_object('player_id', p_player_id, 'from', v_mem.role, 'to', p_role, 'demoted_vice', v_demoted));
  return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id, 'role', p_role, 'demoted', v_demoted);
end $$;

-- transfer_captaincy(team, player) → {team_id, captain_id, previous_captain_role}
-- Captain only; the target must be an active member. The old captain
-- becomes vice when the vice slot is free (or the target was the vice),
-- otherwise player. The team is never without a captain.
create or replace function public.transfer_captaincy(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team  public.teams%rowtype;
  v_old   uuid;
  v_trole text;
  v_new_old_role text;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if not (public.is_admin() or public.is_team_captain(p_team_id)) then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  v_old := v_team.captain_id;
  select role into v_trole from public.team_members where team_id = p_team_id and player_id = p_player_id and status = 'active';
  if v_trole is null or p_player_id = v_old then raise exception 'rivals:invalid_target'; end if;

  v_new_old_role := case when v_trole = 'vice'
                           or not exists (select 1 from public.team_members where team_id = p_team_id and role = 'vice' and status = 'active')
                         then 'vice' else 'player' end;
  update public.team_members set role = 'player'  where team_id = p_team_id and player_id = v_old;
  update public.team_members set role = 'captain' where team_id = p_team_id and player_id = p_player_id;
  update public.team_members set role = v_new_old_role where team_id = p_team_id and player_id = v_old and status = 'active';
  update public.teams set captain_id = p_player_id, updated_at = now() where id = p_team_id;
  perform public.rivals_audit(p_team_id, 'captaincy_transferred',
    jsonb_build_object('from', v_old, 'to', p_player_id, 'previous_captain_role', v_new_old_role));
  return jsonb_build_object('team_id', p_team_id, 'captain_id', p_player_id, 'previous_captain_role', v_new_old_role);
end $$;

-- remove_team_member(team, player) → {team_id, player_id}
-- Leaders only; the captain can't be removed; a vice can only remove
-- players. Soft: status 'removed' + left_at (history kept).
create or replace function public.remove_team_member(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_mem  public.team_members%rowtype;
  v_me   text;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  v_me := public.team_role(p_team_id);
  if not (public.is_admin() or v_me in ('captain','vice')) then
    raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;
  if p_player_id = public.my_player_id() then raise exception 'rivals:use_leave'; end if;
  select * into v_mem from public.team_members where team_id = p_team_id and player_id = p_player_id and status = 'active';
  if not found then raise exception 'rivals:not_a_member'; end if;
  if v_mem.role = 'captain' then raise exception 'rivals:cannot_remove_captain' using errcode = '42501'; end if;
  if v_mem.role = 'vice' and not (public.is_admin() or v_me = 'captain') then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  update public.team_members set status = 'removed', left_at = clock_timestamp() where id = v_mem.id;
  perform public.rivals_audit(p_team_id, 'member_removed', jsonb_build_object('player_id', p_player_id, 'role', v_mem.role));
  return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id);
end $$;

-- leave_team(team) → {team_id, archived}
-- A captain with teammates must transfer first; the LAST member leaving
-- archives the team (it's never left without a responsible).
create or replace function public.leave_team(p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  v_team public.teams%rowtype;
  v_mem  public.team_members%rowtype;
  v_others int;
  v_archive boolean := false;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  select * into v_mem from public.team_members where team_id = p_team_id and player_id = v_pid and status = 'active';
  if not found then raise exception 'rivals:not_a_member'; end if;
  select count(*) into v_others from public.team_members
   where team_id = p_team_id and status = 'active' and player_id <> v_pid;
  if v_mem.role = 'captain' and v_others > 0 then raise exception 'rivals:captain_must_transfer'; end if;
  v_archive := v_others = 0 and v_team.archived_at is null;

  update public.team_members set status = 'left', left_at = clock_timestamp() where id = v_mem.id;
  if v_archive then
    update public.teams set archived_at = now(), updated_at = now() where id = p_team_id;
    update public.team_invites set revoked_at = now() where team_id = p_team_id and revoked_at is null;
  end if;
  perform public.rivals_audit(p_team_id, 'member_left', jsonb_build_object('player_id', v_pid, 'role', v_mem.role, 'archived', v_archive));
  return jsonb_build_object('team_id', p_team_id, 'archived', v_archive);
end $$;

-- team_profile(slug) — anon OK. Public identity for ?team=<slug> and the
-- OG preview: no roster. `record`/`form` are placeholders here;
-- EXTENSION POINT: 007200 replaces this with the confirmed-results record.
create or replace function public.team_profile(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_team public.teams%rowtype;
begin
  select * into v_team from public.teams where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_team.id, 'name', v_team.name, 'slug', v_team.slug, 'city', v_team.city,
    'color', v_team.color, 'secondary_color', v_team.secondary_color, 'logo_url', v_team.logo_url,
    'preferred_format', v_team.preferred_format, 'home_venue', v_team.home_venue,
    'created_at', v_team.created_at, 'archived', v_team.archived_at is not null,
    'member_count', (select count(*) from public.team_members m where m.team_id = v_team.id and m.status = 'active'),
    'my_role', public.team_role(v_team.id),
    'record', jsonb_build_object('played', 0, 'wins', 0, 'draws', 0, 'losses', 0, 'goals_for', 0, 'goals_against', 0),
    'form', '[]'::jsonb);
end $$;

-- ── 9. EXECUTE grants (Supabase auto-grants anon/authenticated) ──
do $$
declare f text;
begin
  -- RLS helpers: signed-in users (policies run as the caller).
  foreach f in array array[
    'public.team_role(uuid)', 'public.is_team_member(uuid)', 'public.is_team_leader(uuid)',
    'public.is_team_captain(uuid)', 'public.can_manage_team(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- App RPCs: signed-in users only.
  foreach f in array array[
    'public.create_team(text, jsonb)', 'public.update_team(uuid, jsonb)', 'public.archive_team(uuid)',
    'public.create_team_invite(uuid, boolean, int, int)', 'public.revoke_team_invite(uuid)',
    'public.accept_team_invite(text)', 'public.set_member_role(uuid, uuid, text)',
    'public.transfer_captaincy(uuid, uuid)', 'public.remove_team_member(uuid, uuid)', 'public.leave_team(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Previews: also anonymous (logged-out invite / team pages, OG function).
  foreach f in array array['public.team_invite_preview(text)', 'public.team_profile(text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  -- Internal only.
  foreach f in array array[
    'public.rivals_audit(uuid, text, jsonb)', 'public.rivals_unique_slug(text)',
    'public.rivals_validate_team_fields(jsonb, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
