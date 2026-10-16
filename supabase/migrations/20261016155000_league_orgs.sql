-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L1 (design plan PR L1): league organizations, collaborators,
-- pilot access requests, invites, audit log.
--
-- Source: docs/ligas-draft-sql/01_league_orgs.sql (validated in PGlite).
-- Check: supabase/tests/ligas_l1_check.sql.
--
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.1, §6, §7 (PR L1).
--
-- What this does
--   • league_access_requests  pilot gate (brief §5): request → admin review.
--                             A request is never an approval; create_league
--                             requires an APPROVED, unused request (or admin).
--   • leagues                 the organization (identity, locality,
--                             visibility public | unlisted | private).
--   • league_members          collaborators with a role per league:
--                             owner | manager | scorer | referee, optionally
--                             scoped to ONE competition (FK added in L2).
--   • league_invites          single-use links that carry the role up front
--                             (the invite says destination + role before
--                             accepting; it never grants owner).
--   • league_audit_log        one row per state transition (all league PRs
--                             write here; it is also the notification seam).
--   • RLS: SELECT-only policies; every write is a SECURITY DEFINER RPC.
--     anon has NO table privilege; public pages go through RPCs that
--     project a fixed, PII-free payload.
--
-- Never touches games / attendances / matchdays / teams / team_matches.
-- Errors: 'league:<code>'. Idempotent (if not exists / create or replace).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.league_access_requests (
  id                  uuid primary key default gen_random_uuid(),
  requester_player_id uuid not null references public.players(id) on delete cascade,
  org_name            text not null check (char_length(btrim(org_name)) between 2 and 80),
  city                text check (city is null or char_length(city) <= 80),
  country             text not null default 'PT' check (country in ('PT','BR')),
  modality            text check (modality is null or modality in ('futebol','society','futsal')),
  expected_teams      int  check (expected_teams is null or expected_teams between 2 and 200),
  context             text check (context is null or char_length(context) <= 1000),
  status              text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  reviewed_by         uuid references public.players(id) on delete set null,
  reviewed_at         timestamptz,
  review_note         text check (review_note is null or char_length(review_note) <= 500),
  used_by_league_id   uuid,            -- FK below (leagues) — one league per approval
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- One open request per person (double-tap / spam guard).
create unique index if not exists league_access_requests_one_pending_key
  on public.league_access_requests (requester_player_id) where status = 'pending';

create table if not exists public.leagues (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  short_name    text check (short_name is null or char_length(short_name) <= 24),
  description   text check (description is null or char_length(description) <= 2000),
  logo_url      text,
  color         text not null default '#C8FF00' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  city          text,
  region        text,
  country       text not null default 'PT' check (country in ('PT','BR')),
  timezone      text not null default 'Europe/Lisbon',
  -- public   : listed + readable by anyone (anon via RPC only).
  -- unlisted : readable by slug, never listed in directories / search.
  -- private  : members + registered teams' members, or the view_key link.
  visibility    text not null default 'private' check (visibility in ('public','unlisted','private')),
  -- 32 hex chars; lets a private league share a read-only link. Rotatable.
  view_key      text not null default replace(gen_random_uuid()::text, '-', ''),
  status        text not null default 'draft' check (status in ('draft','active','archived')),
  access_request_id uuid references public.league_access_requests(id) on delete set null,
  created_by    uuid references public.players(id) on delete set null,
  client_ref    text check (client_ref is null or char_length(client_ref) <= 64),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  constraint leagues_slug_key unique (slug)
);
create unique index if not exists leagues_creator_client_ref_key
  on public.leagues (created_by, client_ref) where client_ref is not null;
-- Owner decision 2026-10-16 (Vini): ONE league per approved pilot request —
-- enforced in the DB too, not only by create_league().
create unique index if not exists leagues_access_request_key
  on public.leagues (access_request_id) where access_request_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_access_requests_league_fkey') then
    alter table public.league_access_requests add constraint league_access_requests_league_fkey
      foreign key (used_by_league_id) references public.leagues(id) on delete set null;
  end if;
end $$;

create table if not exists public.league_members (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  role           text not null check (role in ('owner','manager','scorer','referee')),
  -- null = the whole league; otherwise only that competition (FK in L2).
  competition_id uuid,
  status         text not null default 'active' check (status in ('active','removed')),
  invited_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  removed_at     timestamptz,
  constraint league_members_owner_unscoped check (role <> 'owner' or competition_id is null)
);
create unique index if not exists league_members_one_owner_key
  on public.league_members (league_id) where role = 'owner' and status = 'active';
create unique index if not exists league_members_role_scope_key
  on public.league_members (league_id, player_id, role,
                            coalesce(competition_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';
create index if not exists league_members_player_idx on public.league_members (player_id) where status = 'active';

create table if not exists public.league_invites (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references public.leagues(id) on delete cascade,
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role           text not null check (role in ('manager','scorer','referee')),   -- never owner
  competition_id uuid,                                                         -- FK in L2
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '7 days',
  revoked_at     timestamptz,
  accepted_by    uuid references public.players(id) on delete set null,
  accepted_at    timestamptz
);
create index if not exists league_invites_league_idx on public.league_invites (league_id, created_at desc);

create table if not exists public.league_audit_log (
  id              bigserial primary key,
  league_id       uuid references public.leagues(id) on delete set null,
  competition_id  uuid,          -- FK in L2
  match_id        uuid,          -- FK in L4 (team_matches)
  actor_player_id uuid references public.players(id) on delete set null,
  action          text not null check (char_length(action) between 1 and 80),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists league_audit_log_league_idx on public.league_audit_log (league_id, created_at desc);

-- ── 2. Helpers ───────────────────────────────────────────
-- Does the caller hold one of p_roles in league l (optionally for comp c)?
-- A competition-scoped member only matches when c is that competition.
create or replace function public.has_league_role(l uuid, p_roles text[], c uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.league_members m
     where m.league_id = l and m.status = 'active'
       and m.player_id = public.my_player_id()
       and m.role = any(p_roles)
       and (m.competition_id is null or m.competition_id = c));
$$;

-- Owner or manager (the "gestor") of league l / competition c.
create or replace function public.is_league_manager(l uuid, c uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_league_role(l, array['owner','manager'], c);
$$;

-- Any active collaborator of league l (any role, any scope).
create or replace function public.is_league_staff(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.league_members m
     where m.league_id = l and m.status = 'active' and m.player_id = public.my_player_id());
$$;

-- Table-level visibility (used by RLS). public → any signed-in user;
-- unlisted/private → staff only here (registered teams' members are added
-- in L3 by redefining this function). Unlisted-by-slug and view_key access
-- go through RPCs, never through table reads, so a private league cannot
-- be enumerated or fetched by id.
create or replace function public.can_see_league(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.leagues g where g.id = l and g.visibility = 'public' and g.status <> 'draft')
      or public.is_league_staff(l);
$$;

create or replace function public.league_audit(p_league uuid, p_action text, p_payload jsonb default '{}'::jsonb,
                                               p_competition uuid default null, p_match uuid default null)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.league_audit_log (league_id, competition_id, match_id, actor_player_id, action, payload)
  values (p_league, p_competition, p_match, public.my_player_id(), p_action, coalesce(p_payload, '{}'::jsonb));
$$;

-- Display name only (never email / phone / age). Shared by every public payload.
create or replace function public.league_person_name(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(x.nick), ''), split_part(x.name, ' ', 1)) from public.players x where x.id = p;
$$;

create or replace function public.league_unique_slug(p_name text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_base text := public.team_slugify(p_name); v_cand text := v_base; n int := 1;
begin
  -- Integration addition: /league/<slug> shares the path with app routes
  -- (/league/demo, /league/minhas …), so those words are never a slug.
  while exists (select 1 from public.leagues where slug = v_cand)
        or v_cand in ('demo','minhas','me','admin','new','nova','convite','inscricao','pilot','piloto') loop
    n := n + 1;
    v_cand := trim(both '-' from left(v_base, 35)) || '-' || n;
  end loop;
  return v_cand;
end $$;

-- Allow-listed editable fields of a league.
create or replace function public.league_validate_fields(f jsonb)
returns void language plpgsql stable set search_path = public as $$
declare k text;
begin
  if f is null then return; end if;
  if jsonb_typeof(f) <> 'object' then raise exception 'league:invalid_field'; end if;
  for k in select jsonb_object_keys(f) loop
    if k not in ('name','short_name','description','logo_url','color','city','region','country','timezone','visibility') then
      raise exception 'league:invalid_field' using detail = k;
    end if;
  end loop;
  if f ? 'visibility' and f->>'visibility' not in ('public','unlisted','private') then raise exception 'league:invalid_visibility'; end if;
  if f ? 'country' and f->>'country' not in ('PT','BR') then raise exception 'league:invalid_country'; end if;
  if f ? 'color' and f->>'color' !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'league:invalid_color'; end if;
  if f ? 'name' and char_length(btrim(f->>'name')) not between 2 and 80 then raise exception 'league:invalid_name'; end if;
end $$;

-- ── 3. RLS (read-only policies) ──────────────────────────
alter table public.league_access_requests enable row level security;
alter table public.leagues                enable row level security;
alter table public.league_members         enable row level security;
alter table public.league_invites         enable row level security;
alter table public.league_audit_log       enable row level security;

drop policy if exists "league_access_requests select" on public.league_access_requests;
create policy "league_access_requests select" on public.league_access_requests for select to authenticated
  using (requester_player_id = public.my_player_id() or public.is_admin());

drop policy if exists "leagues select" on public.leagues;
create policy "leagues select" on public.leagues for select to authenticated
  using (public.can_see_league(id));

-- Collaborator list: staff of that league only (a public page shows the
-- named responsáveis through the RPC payload, not this table).
drop policy if exists "league_members select" on public.league_members;
create policy "league_members select" on public.league_members for select to authenticated
  using (player_id = public.my_player_id() or public.is_league_staff(league_id));

drop policy if exists "league_invites select" on public.league_invites;
create policy "league_invites select" on public.league_invites for select to authenticated
  using (public.is_league_manager(league_id));

drop policy if exists "league_audit_log select" on public.league_audit_log;
create policy "league_audit_log select" on public.league_audit_log for select to authenticated
  using (league_id is not null and public.is_league_staff(league_id));

-- Column guard: view_key must never be readable through the table (even by
-- public-league readers). Revoke the column; managers get it via RPC.
-- (Column-level privilege: SELECT on the table minus view_key.)

-- ── 4. Grants (explicit — CLAUDE.md, Oct 30 2026 change) ──
revoke all on table public.league_access_requests, public.leagues, public.league_members,
                    public.league_invites, public.league_audit_log from anon, authenticated;
grant select on table public.league_access_requests to authenticated;
grant select (id, slug, name, short_name, description, logo_url, color, city, region, country, timezone,
              visibility, status, created_by, created_at, updated_at, archived_at)
  on table public.leagues to authenticated;
grant select on table public.league_members   to authenticated;
grant select on table public.league_invites   to authenticated;
grant select on table public.league_audit_log to authenticated;
grant all on table public.league_access_requests, public.leagues, public.league_members,
                   public.league_invites, public.league_audit_log to service_role;
revoke all on sequence public.league_audit_log_id_seq from anon, authenticated;
grant usage, select on sequence public.league_audit_log_id_seq to service_role;

-- ── 5. RPCs ──────────────────────────────────────────────

-- request_league_access(fields) → {request_id, status, created}
-- Signed-in only. Idempotent: an open request is returned, not duplicated.
create or replace function public.request_league_access(p_fields jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid uuid := public.my_player_id();
  f     jsonb := coalesce(p_fields, '{}'::jsonb);
  r     public.league_access_requests%rowtype;
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into r from public.league_access_requests where requester_player_id = v_pid and status = 'pending';
  if found then return jsonb_build_object('request_id', r.id, 'status', r.status, 'created', false); end if;
  insert into public.league_access_requests (requester_player_id, org_name, city, country, modality, expected_teams, context)
  values (v_pid, btrim(coalesce(f->>'org_name', '')), nullif(btrim(f->>'city'), ''), coalesce(f->>'country', 'PT'),
          nullif(f->>'modality', ''), nullif(f->>'expected_teams', '')::int, nullif(btrim(f->>'context'), ''))
  returning * into r;
  perform public.league_audit(null, 'access_requested', jsonb_build_object('request_id', r.id));
  return jsonb_build_object('request_id', r.id, 'status', r.status, 'created', true);
exception when check_violation then raise exception 'league:invalid_request';
end $$;

-- review_league_access(request, 'approve'|'reject', note) → {request_id, status}   (app admin only)
create or replace function public.review_league_access(p_request_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.league_access_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'league:admin_only' using errcode = '42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'league:invalid_decision'; end if;
  select * into r from public.league_access_requests where id = p_request_id for update;
  if not found then raise exception 'league:request_not_found'; end if;
  if r.status <> 'pending' then
    return jsonb_build_object('request_id', r.id, 'status', r.status, 'already_reviewed', true);
  end if;
  update public.league_access_requests
     set status = case p_decision when 'approve' then 'approved' else 'rejected' end,
         reviewed_by = public.my_player_id(), reviewed_at = now(), review_note = left(p_note, 500), updated_at = now()
   where id = r.id returning * into r;
  perform public.league_audit(null, 'access_' || r.status, jsonb_build_object('request_id', r.id));
  return jsonb_build_object('request_id', r.id, 'status', r.status);
end $$;

-- create_league(name, fields, client_ref) → {league_id, slug, created}
-- Needs an approved, unused access request of the caller (or app admin).
-- Caller becomes owner. Always starts as draft + private.
create or replace function public.create_league(p_name text, p_fields jsonb default '{}'::jsonb, p_client_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid uuid := public.my_player_id();
  f     jsonb := coalesce(p_fields, '{}'::jsonb) - 'visibility';
  v_req public.league_access_requests%rowtype;
  v_lg  public.leagues%rowtype;
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  perform public.league_validate_fields(f || jsonb_build_object('name', btrim(coalesce(p_name, ''))));
  perform pg_advisory_xact_lock(hashtextextended('league_create:' || v_pid::text, 0));
  if p_client_ref is not null then
    select * into v_lg from public.leagues where created_by = v_pid and client_ref = p_client_ref;
    if found then return jsonb_build_object('league_id', v_lg.id, 'slug', v_lg.slug, 'created', false); end if;
  end if;
  if not public.is_admin() then
    select * into v_req from public.league_access_requests
     where requester_player_id = v_pid and status = 'approved' and used_by_league_id is null
     order by reviewed_at limit 1 for update;
    if not found then raise exception 'league:access_not_approved' using errcode = '42501'; end if;
  end if;
  insert into public.leagues (slug, name, short_name, description, logo_url, color, city, region, country, timezone,
                              visibility, status, access_request_id, created_by, client_ref)
  values (public.league_unique_slug(p_name), btrim(p_name), f->>'short_name', f->>'description', f->>'logo_url',
          coalesce(f->>'color', '#C8FF00'), f->>'city', f->>'region', coalesce(f->>'country', 'PT'),
          coalesce(f->>'timezone', case when f->>'country' = 'BR' then 'America/Sao_Paulo' else 'Europe/Lisbon' end),
          'private', 'draft', v_req.id, v_pid, p_client_ref)
  returning * into v_lg;
  insert into public.league_members (league_id, player_id, role) values (v_lg.id, v_pid, 'owner');
  if v_req.id is not null then
    update public.league_access_requests set used_by_league_id = v_lg.id, updated_at = now() where id = v_req.id;
  end if;
  perform public.league_audit(v_lg.id, 'league_created', jsonb_build_object('slug', v_lg.slug));
  return jsonb_build_object('league_id', v_lg.id, 'slug', v_lg.slug, 'created', true);
end $$;

-- update_league(league, fields) → {league_id, slug}
-- Owner/manager edit identity; visibility is owner-only. Slug never changes.
create or replace function public.update_league(p_league_id uuid, p_fields jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_lg public.leagues%rowtype; f jsonb := coalesce(p_fields, '{}'::jsonb);
begin
  select * into v_lg from public.leagues where id = p_league_id for update;
  if not found or not public.is_league_manager(p_league_id) then raise exception 'league:not_found'; end if;
  perform public.league_validate_fields(f);
  if f ? 'visibility' and not (public.is_admin() or public.has_league_role(p_league_id, array['owner'])) then
    raise exception 'league:owner_only' using errcode = '42501';
  end if;
  if v_lg.status = 'archived' then raise exception 'league:archived'; end if;
  update public.leagues set
    name        = coalesce(btrim(f->>'name'), name),
    short_name  = case when f ? 'short_name'  then f->>'short_name'  else short_name end,
    description = case when f ? 'description' then f->>'description' else description end,
    logo_url    = case when f ? 'logo_url'    then f->>'logo_url'    else logo_url end,
    color       = coalesce(f->>'color', color),
    city        = case when f ? 'city'   then f->>'city'   else city end,
    region      = case when f ? 'region' then f->>'region' else region end,
    country     = coalesce(f->>'country', country),
    timezone    = coalesce(f->>'timezone', timezone),
    visibility  = coalesce(f->>'visibility', visibility),
    updated_at  = now()
  where id = p_league_id returning * into v_lg;
  perform public.league_audit(v_lg.id, 'league_updated', jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(f) k)));
  return jsonb_build_object('league_id', v_lg.id, 'slug', v_lg.slug);
end $$;

-- set_league_status(league, 'active'|'archived') → {status}
-- Owner only. draft → active (the league page becomes reachable per its
-- visibility), active → archived (read-only history; invites revoked).
create or replace function public.set_league_status(p_league_id uuid, p_status text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_lg public.leagues%rowtype;
begin
  select * into v_lg from public.leagues where id = p_league_id for update;
  if not found or not public.is_league_staff(p_league_id) then raise exception 'league:not_found'; end if;
  if not (public.is_admin() or public.has_league_role(p_league_id, array['owner'])) then
    raise exception 'league:owner_only' using errcode = '42501';
  end if;
  if v_lg.status = p_status then return jsonb_build_object('status', p_status, 'unchanged', true); end if;
  if (v_lg.status, p_status) not in (('draft','active'), ('active','archived'), ('draft','archived')) then
    raise exception 'league:invalid_transition';
  end if;
  update public.leagues set status = p_status, updated_at = now(),
         archived_at = case when p_status = 'archived' then now() end
   where id = p_league_id;
  if p_status = 'archived' then
    update public.league_invites set revoked_at = now() where league_id = p_league_id and revoked_at is null and accepted_at is null;
  end if;
  perform public.league_audit(p_league_id, 'league_' || p_status, '{}'::jsonb);
  return jsonb_build_object('status', p_status);
end $$;

-- create_league_invite(league, role, competition) → {token, role, expires_at}
-- Owner invites managers; owner/manager invite scorer/referee.
create or replace function public.create_league_invite(p_league_id uuid, p_role text, p_competition_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_inv public.league_invites%rowtype;
begin
  if p_role not in ('manager','scorer','referee') then raise exception 'league:invalid_role'; end if;
  if not public.is_league_manager(p_league_id, p_competition_id) then raise exception 'league:not_found'; end if;
  if p_role = 'manager' and not (public.is_admin() or public.has_league_role(p_league_id, array['owner'])) then
    raise exception 'league:owner_only' using errcode = '42501';
  end if;
  -- (L2 adds: p_competition_id must belong to p_league_id.)
  insert into public.league_invites (league_id, role, competition_id, created_by)
  values (p_league_id, p_role, p_competition_id, public.my_player_id()) returning * into v_inv;
  perform public.league_audit(p_league_id, 'invite_created', jsonb_build_object('role', p_role, 'competition_id', p_competition_id), p_competition_id);
  return jsonb_build_object('token', v_inv.token, 'role', v_inv.role, 'expires_at', v_inv.expires_at);
end $$;

-- league_invite_preview(token) → {status, role, league{name,slug,logo_url,city}, invited_by}
-- anon + authenticated: tells destination and role BEFORE accepting.
create or replace function public.league_invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_inv public.league_invites%rowtype; v_lg public.leagues%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return jsonb_build_object('status', 'not_found'); end if;
  select * into v_inv from public.league_invites where token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into v_lg from public.leagues where id = v_inv.league_id;
  return jsonb_build_object(
    'status', case when v_lg.status = 'archived' then 'archived' when v_inv.revoked_at is not null then 'revoked'
                   when v_inv.accepted_at is not null then 'used' when v_inv.expires_at <= now() then 'expired' else 'valid' end,
    'role', v_inv.role,
    'league', jsonb_build_object('name', v_lg.name, 'slug', v_lg.slug, 'logo_url', v_lg.logo_url, 'city', v_lg.city),
    'invited_by', public.league_person_name(v_inv.created_by));
end $$;

-- accept_league_invite(token) → {league_id, slug, role, already_member}
create or replace function public.accept_league_invite(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_pid uuid := public.my_player_id(); v_inv public.league_invites%rowtype; v_lg public.leagues%rowtype;
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into v_inv from public.league_invites where token = p_token for update;
  if not found then raise exception 'league:invite_not_found'; end if;
  select * into v_lg from public.leagues where id = v_inv.league_id;
  if v_inv.accepted_by = v_pid then
    return jsonb_build_object('league_id', v_lg.id, 'slug', v_lg.slug, 'role', v_inv.role, 'already_member', true);
  end if;
  if v_lg.status = 'archived' then raise exception 'league:archived'; end if;
  if v_inv.revoked_at is not null then raise exception 'league:invite_revoked'; end if;
  if v_inv.accepted_at is not null then raise exception 'league:invite_used'; end if;
  if v_inv.expires_at <= now() then raise exception 'league:invite_expired'; end if;
  insert into public.league_members (league_id, player_id, role, competition_id, invited_by)
  values (v_lg.id, v_pid, v_inv.role, v_inv.competition_id, v_inv.created_by)
  on conflict do nothing;
  update public.league_invites set accepted_by = v_pid, accepted_at = now() where id = v_inv.id;
  perform public.league_audit(v_lg.id, 'member_joined', jsonb_build_object('role', v_inv.role, 'invite_id', v_inv.id), v_inv.competition_id);
  return jsonb_build_object('league_id', v_lg.id, 'slug', v_lg.slug, 'role', v_inv.role, 'already_member', false);
end $$;

-- remove_league_member(member_row_id) → {removed}
-- Owner removes anyone but themselves; manager removes scorer/referee;
-- anyone can remove their own non-owner row (leave).
create or replace function public.remove_league_member(p_member_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.league_members%rowtype; v_pid uuid := public.my_player_id();
begin
  select * into m from public.league_members where id = p_member_id and status = 'active' for update;
  if not found then raise exception 'league:member_not_found'; end if;
  if m.role = 'owner' then raise exception 'league:transfer_ownership_first'; end if;
  if not (m.player_id = v_pid
          or public.is_admin()
          or public.has_league_role(m.league_id, array['owner'])
          or (m.role in ('scorer','referee') and public.has_league_role(m.league_id, array['manager'], m.competition_id))) then
    raise exception 'league:not_allowed' using errcode = '42501';
  end if;
  update public.league_members set status = 'removed', removed_at = now() where id = m.id;
  perform public.league_audit(m.league_id, 'member_removed', jsonb_build_object('player_id', m.player_id, 'role', m.role));
  return jsonb_build_object('removed', true);
end $$;

-- transfer_league_ownership(league, player) → {league_id, owner}
-- The new owner must already be an active manager of the league.
create or replace function public.transfer_league_ownership(p_league_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.has_league_role(p_league_id, array['owner'])) then
    raise exception 'league:owner_only' using errcode = '42501';
  end if;
  perform 1 from public.leagues where id = p_league_id for update;
  if not exists (select 1 from public.league_members where league_id = p_league_id and player_id = p_player_id
                   and role = 'manager' and competition_id is null and status = 'active') then
    raise exception 'league:new_owner_must_be_manager';
  end if;
  update public.league_members set role = 'manager' where league_id = p_league_id and role = 'owner' and status = 'active';
  update public.league_members set role = 'owner'
   where league_id = p_league_id and player_id = p_player_id and role = 'manager' and competition_id is null and status = 'active';
  perform public.league_audit(p_league_id, 'ownership_transferred', jsonb_build_object('to', p_player_id));
  return jsonb_build_object('league_id', p_league_id, 'owner', p_player_id);
end $$;

-- my_leagues() → {items:[{league_id, slug, name, logo_url, roles[], status}]}   ("Minhas ligas")
create or replace function public.my_leagues()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb))
    from (select jsonb_build_object('league_id', g.id, 'slug', g.slug, 'name', g.name, 'logo_url', g.logo_url,
                                    'status', g.status, 'visibility', g.visibility,
                                    'roles', (select jsonb_agg(distinct m.role) from public.league_members m
                                               where m.league_id = g.id and m.player_id = public.my_player_id() and m.status = 'active')) x
            from public.leagues g
           where exists (select 1 from public.league_members m
                          where m.league_id = g.id and m.player_id = public.my_player_id() and m.status = 'active')) s;
$$;

-- league_page(slug, key) → public league payload or null.
-- anon + authenticated. Returns NULL (indistinguishable from "not found")
-- when: draft and not staff; private and neither staff nor correct key.
-- Payload never contains email / phone / age / view_key.
create or replace function public.league_page(p_slug text, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_lg public.leagues%rowtype; v_staff boolean;
begin
  select * into v_lg from public.leagues where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then return null; end if;
  v_staff := public.my_player_id() is not null and public.is_league_staff(v_lg.id);
  if not v_staff then
    if v_lg.status = 'draft' then return null; end if;
    if v_lg.visibility = 'private' and (p_key is null or p_key <> v_lg.view_key) then return null; end if;
  end if;
  return jsonb_build_object(
    'id', v_lg.id, 'slug', v_lg.slug, 'name', v_lg.name, 'short_name', v_lg.short_name,
    'description', v_lg.description, 'logo_url', v_lg.logo_url, 'color', v_lg.color,
    'city', v_lg.city, 'region', v_lg.region, 'country', v_lg.country, 'timezone', v_lg.timezone,
    'visibility', v_lg.visibility, 'status', v_lg.status,
    'responsaveis', (select coalesce(jsonb_agg(jsonb_build_object('name', public.league_person_name(m.player_id), 'role', m.role)
                                               order by m.role), '[]'::jsonb)
                       from public.league_members m
                      where m.league_id = v_lg.id and m.status = 'active' and m.role in ('owner','manager') and m.competition_id is null),
    'my_roles', case when v_staff then (select jsonb_agg(distinct m.role) from public.league_members m
                                         where m.league_id = v_lg.id and m.player_id = public.my_player_id() and m.status = 'active')
                     else '[]'::jsonb end,
    'view_key', case when public.is_league_manager(v_lg.id) then v_lg.view_key end);
  -- competitions[] are appended by L2's redefinition.
end $$;

-- ── 6. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  -- RLS helpers (policies run as the caller).
  foreach f in array array[
    'public.has_league_role(uuid, text[], uuid)', 'public.is_league_manager(uuid, uuid)',
    'public.is_league_staff(uuid)', 'public.can_see_league(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Signed-in RPCs.
  foreach f in array array[
    'public.request_league_access(jsonb)', 'public.review_league_access(uuid, text, text)',
    'public.create_league(text, jsonb, text)', 'public.update_league(uuid, jsonb)', 'public.set_league_status(uuid, text)',
    'public.create_league_invite(uuid, text, uuid)', 'public.accept_league_invite(text)',
    'public.remove_league_member(uuid)', 'public.transfer_league_ownership(uuid, uuid)', 'public.my_leagues()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Public (anon too): fixed PII-free payloads.
  foreach f in array array['public.league_invite_preview(text)', 'public.league_page(text, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  -- Internal plumbing.
  foreach f in array array[
    'public.league_audit(uuid, text, jsonb, uuid, uuid)', 'public.league_person_name(uuid)',
    'public.league_unique_slug(text)', 'public.league_validate_fields(jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── 7. Admin review list (integration addition) ─────────
-- list_league_access_requests(status) → {items:[…]}   (app admin only)
-- The admin needs WHO asked (name + contact) to follow up on a pilot
-- request; players rows of strangers are not readable through RLS, so this
-- is an admin-only RPC (same trust level as the existing admin dashboard).
create or replace function public.list_league_access_requests(p_status text default 'pending')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'league:admin_only' using errcode = '42501'; end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'org_name', r.org_name, 'city', r.city, 'country', r.country, 'modality', r.modality,
             'expected_teams', r.expected_teams, 'context', r.context, 'status', r.status, 'created_at', r.created_at,
             'used_by_league_id', r.used_by_league_id, 'requester_player_id', r.requester_player_id,
             'requester_name', p.name, 'requester_email', p.email, 'requester_phone', p.phone)
           order by r.created_at)
      from public.league_access_requests r left join public.players p on p.id = r.requester_player_id
     where p_status is null or r.status = p_status), '[]'::jsonb));
end $$;
revoke execute on function public.list_league_access_requests(text) from public, anon;
grant execute on function public.list_league_access_requests(text) to authenticated, service_role;

-- ── Comments ─────────────────────────────────────────────
comment on table public.league_access_requests is 'PITCH Ligas: pilot access requests (brief §5). A request is never an approval: an app admin reviews it via review_league_access(); create_league() consumes one approved, unused request.';
comment on table public.leagues is 'PITCH Ligas: a league organization (tenant). Starts draft + private; visibility public|unlisted|private; view_key withheld by column grant. Written only through league RPCs.';
comment on column public.leagues.view_key is '128-bit secret for sharing a private league page (?k=). Not readable by authenticated; returned to staff by league_page().';
comment on table public.league_members is 'PITCH Ligas: collaborators per league (owner|manager|scorer|referee), optionally scoped to one competition. Exactly one active owner.';
comment on table public.league_invites is 'PITCH Ligas: single-use collaborator invites; the role is fixed at creation and never owner.';
comment on table public.league_audit_log is 'PITCH Ligas: append-only audit of every league state transition (also the Fase 3 notification seam).';
