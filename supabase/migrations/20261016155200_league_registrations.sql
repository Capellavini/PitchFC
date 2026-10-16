-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L2b (design plan PR L3): team registration + homologated
-- squad snapshots.
--
-- Source: docs/ligas-draft-sql/03_registrations_squads.sql. Depends on 01, 02 and Rivals 007000.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.4.
--
-- What this does
--   • competition_registration_links  token links a manager sends to team
--                                     captains (optionally aimed at one team).
--   • competition_teams               one row per (competition, team): the
--                                     EXISTING Rivals team takes part — it is
--                                     never re-created per season (brief §18).
--   • competition_squad_versions /    immutable squad snapshots. A team's live
--     competition_squad_players       roster (team_members) can change freely;
--                                     the competition only sees the version
--                                     the authority homologated. Leaving the
--                                     team does NOT silently drop the player
--                                     from a homologated squad (brief §2).
--   • One player can be homologated for at most ONE team per competition.
--   • can_see_competition / can_see_league now also admit members of a
--     registered team (submitted or homologated).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.competition_registration_links (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id        uuid references public.teams(id) on delete cascade,     -- null = any team leader with the link
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '30 days',
  revoked_at     timestamptz
);

create table if not exists public.competition_teams (
  id                        uuid primary key default gen_random_uuid(),
  competition_id            uuid not null references public.competitions(id) on delete cascade,
  team_id                   uuid not null references public.teams(id) on delete restrict,
  status                    text not null default 'draft'
                              check (status in ('draft','submitted','homologated','rejected','withdrawn')),
  -- Name/crest frozen at FIRST homologation so the competition history
  -- reads as it was (the team page keeps the live identity).
  registered_name           text,
  registered_logo_url       text,
  homologated_squad_version int,
  registered_by             uuid references public.players(id) on delete set null,
  via_link_id               uuid references public.competition_registration_links(id) on delete set null,
  decided_by                uuid references public.players(id) on delete set null,
  decided_at                timestamptz,
  decision_note             text check (decision_note is null or char_length(decision_note) <= 500),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint competition_teams_key unique (competition_id, team_id)
);
create index if not exists competition_teams_team_idx on public.competition_teams (team_id, status);

create table if not exists public.competition_squad_versions (
  registration_id uuid not null references public.competition_teams(id) on delete cascade,
  version         int  not null check (version >= 1),
  status          text not null default 'submitted' check (status in ('submitted','homologated','rejected','superseded')),
  submitted_by    uuid references public.players(id) on delete set null,
  submitted_at    timestamptz not null default now(),
  decided_by      uuid references public.players(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text check (decision_note is null or char_length(decision_note) <= 500),
  primary key (registration_id, version)
);
create unique index if not exists competition_squad_versions_one_open_key
  on public.competition_squad_versions (registration_id) where status = 'submitted';
create unique index if not exists competition_squad_versions_one_homologated_key
  on public.competition_squad_versions (registration_id) where status = 'homologated';

create table if not exists public.competition_squad_players (
  registration_id uuid not null,
  version         int  not null,
  player_id       uuid not null references public.players(id) on delete restrict,
  shirt_number    int  check (shirt_number is null or shirt_number between 0 and 99),
  squad_role      text not null default 'player' check (squad_role in ('player','captain')),
  primary key (registration_id, version, player_id),
  foreign key (registration_id, version) references public.competition_squad_versions(registration_id, version) on delete cascade
);
create index if not exists competition_squad_players_player_idx on public.competition_squad_players (player_id);
create unique index if not exists competition_squad_players_shirt_key
  on public.competition_squad_players (registration_id, version, shirt_number) where shirt_number is not null;

-- Squad player rows are write-once (a change = a new version).
create or replace function public.league_squad_players_immutable()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'league:squad_immutable'; end $$;
drop trigger if exists competition_squad_players_immutable on public.competition_squad_players;
create trigger competition_squad_players_immutable before update on public.competition_squad_players
  for each row execute function public.league_squad_players_immutable();

-- Only status/decision columns of a version may change after insert.
create or replace function public.league_squad_versions_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.registration_id <> old.registration_id or new.version <> old.version
     or new.submitted_by is distinct from old.submitted_by or new.submitted_at <> old.submitted_at then
    raise exception 'league:squad_immutable';
  end if;
  if old.status in ('rejected','superseded') then raise exception 'league:squad_immutable'; end if;
  return new;
end $$;
drop trigger if exists competition_squad_versions_guard on public.competition_squad_versions;
create trigger competition_squad_versions_guard before update on public.competition_squad_versions
  for each row execute function public.league_squad_versions_guard();

-- ── 2. Helpers ───────────────────────────────────────────
-- The homologated squad (current) of a registration.
create or replace function public.competition_squad(p_registration uuid)
returns table (player_id uuid, shirt_number int, squad_role text)
language sql stable security definer set search_path = public as $$
  select sp.player_id, sp.shirt_number, sp.squad_role
    from public.competition_teams ct
    join public.competition_squad_players sp on sp.registration_id = ct.id and sp.version = ct.homologated_squad_version
   where ct.id = p_registration;
$$;

-- Is the caller an active member of a team registered (submitted/homologated) in c?
create or replace function public.is_competition_participant(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.competition_teams ct
                  where ct.competition_id = c and ct.status in ('submitted','homologated')
                    and public.is_team_member(ct.team_id));
$$;

create or replace function public.can_see_competition(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.competitions x join public.leagues g on g.id = x.league_id
                  where x.id = c and x.status <> 'draft' and g.status <> 'draft'
                    and coalesce(x.visibility, g.visibility) = 'public')
      or public.is_competition_staff(c)
      or public.is_competition_participant(c);
$$;

create or replace function public.can_see_league(l uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.leagues g where g.id = l and g.visibility = 'public' and g.status <> 'draft')
      or public.is_league_staff(l)
      or exists (select 1 from public.competitions x where x.league_id = l and public.is_competition_participant(x.id));
$$;

-- Leader of the registered team, or a competition manager.
create or replace function public.can_manage_registration(p_registration uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.competition_teams ct join public.competitions x on x.id = ct.competition_id
                  where ct.id = p_registration
                    and (public.is_team_leader(ct.team_id) or public.is_league_manager(x.league_id, x.id)));
$$;

-- ── 3. RLS ───────────────────────────────────────────────
alter table public.competition_registration_links enable row level security;
alter table public.competition_teams              enable row level security;
alter table public.competition_squad_versions     enable row level security;
alter table public.competition_squad_players      enable row level security;

drop policy if exists "competition_registration_links select" on public.competition_registration_links;
create policy "competition_registration_links select" on public.competition_registration_links for select to authenticated
  using (public.is_league_manager(public.competition_league(competition_id), competition_id));

-- Homologated registrations are as visible as the competition; pending /
-- rejected ones only to staff and the team itself.
drop policy if exists "competition_teams select" on public.competition_teams;
create policy "competition_teams select" on public.competition_teams for select to authenticated
  using ((status = 'homologated' and public.can_see_competition(competition_id))
         or public.is_competition_staff(competition_id) or public.is_team_member(team_id));

-- Squad lists: staff + the team's members + participants of the same
-- competition (opponents need to see eligible players). The PUBLIC squad
-- goes through competition_team_page() which applies the youth rule.
drop policy if exists "competition_squad_versions select" on public.competition_squad_versions;
create policy "competition_squad_versions select" on public.competition_squad_versions for select to authenticated
  using (exists (select 1 from public.competition_teams ct where ct.id = registration_id
                  and (public.is_competition_staff(ct.competition_id) or public.is_team_member(ct.team_id)
                       or (status = 'homologated' and public.is_competition_participant(ct.competition_id)))));
drop policy if exists "competition_squad_players select" on public.competition_squad_players;
create policy "competition_squad_players select" on public.competition_squad_players for select to authenticated
  using (exists (select 1 from public.competition_teams ct where ct.id = registration_id
                  and (public.is_competition_staff(ct.competition_id) or public.is_team_member(ct.team_id)
                       or (ct.homologated_squad_version = version and public.is_competition_participant(ct.competition_id)))));

-- ── 4. Grants ────────────────────────────────────────────
revoke all on table public.competition_registration_links, public.competition_teams,
                    public.competition_squad_versions, public.competition_squad_players from anon, authenticated;
grant select on table public.competition_registration_links, public.competition_teams,
                      public.competition_squad_versions, public.competition_squad_players to authenticated;
grant all on table public.competition_registration_links, public.competition_teams,
                   public.competition_squad_versions, public.competition_squad_players to service_role;

-- ── 5. RPCs ──────────────────────────────────────────────

-- create_registration_link(competition, team|null) → {token, expires_at}
create or replace function public.create_registration_link(p_competition_id uuid, p_team_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_l public.competition_registration_links%rowtype;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found or not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  insert into public.competition_registration_links (competition_id, team_id, created_by)
  values (v_c.id, p_team_id, public.my_player_id()) returning * into v_l;
  perform public.league_audit(v_c.league_id, 'registration_link_created', jsonb_build_object('team_id', p_team_id), v_c.id);
  return jsonb_build_object('token', v_l.token, 'expires_at', v_l.expires_at);
end $$;

-- registration_link_preview(token) → {status, competition{…}, league{…}, deadline}   (anon ok)
create or replace function public.registration_link_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_l public.competition_registration_links%rowtype; v_c public.competitions%rowtype; v_g public.leagues%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return jsonb_build_object('status', 'not_found'); end if;
  select * into v_l from public.competition_registration_links where token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into v_c from public.competitions where id = v_l.competition_id;
  select * into v_g from public.leagues where id = v_c.league_id;
  return jsonb_build_object(
    'status', case when v_l.revoked_at is not null then 'revoked' when v_l.expires_at <= now() then 'expired'
                   when v_c.status <> 'registration_open' then 'closed' else 'valid' end,
    'competition', jsonb_build_object('name', v_c.name, 'slug', v_c.slug, 'format', v_c.format, 'modality', v_c.modality),
    'league', jsonb_build_object('name', v_g.name, 'slug', v_g.slug, 'logo_url', v_g.logo_url),
    'deadline', v_c.registration_deadline,
    'for_team', (select jsonb_build_object('name', t.name, 'slug', t.slug) from public.teams t where t.id = v_l.team_id));
end $$;

-- register_team(token, team) → {registration_id, status, created}
-- Leader (captain/vice) of an existing, non-archived team. Idempotent.
create or replace function public.register_team(p_token text, p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_l public.competition_registration_links%rowtype; v_c public.competitions%rowtype; v_r public.competition_teams%rowtype;
begin
  if public.my_player_id() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into v_l from public.competition_registration_links where token = p_token;
  if not found then raise exception 'league:link_not_found'; end if;
  select * into v_c from public.competitions where id = v_l.competition_id for update;
  if not public.is_team_leader(p_team_id) then raise exception 'league:not_team_leader' using errcode = '42501'; end if;
  select * into v_r from public.competition_teams where competition_id = v_c.id and team_id = p_team_id;
  if found and v_r.status <> 'withdrawn' then
    return jsonb_build_object('registration_id', v_r.id, 'status', v_r.status, 'created', false);
  end if;
  if v_l.revoked_at is not null or v_l.expires_at <= now() then raise exception 'league:link_expired'; end if;
  if v_l.team_id is not null and v_l.team_id <> p_team_id then raise exception 'league:link_for_other_team'; end if;
  if v_c.status <> 'registration_open' then raise exception 'league:registration_closed'; end if;
  if v_c.registration_deadline is not null and v_c.registration_deadline < now() then raise exception 'league:registration_closed'; end if;
  if exists (select 1 from public.teams where id = p_team_id and archived_at is not null) then raise exception 'league:team_archived'; end if;
  if v_r.id is not null then
    update public.competition_teams set status = 'draft', registered_by = public.my_player_id(), via_link_id = v_l.id, updated_at = now()
     where id = v_r.id returning * into v_r;
  else
    insert into public.competition_teams (competition_id, team_id, registered_by, via_link_id)
    values (v_c.id, p_team_id, public.my_player_id(), v_l.id) returning * into v_r;
  end if;
  perform public.league_audit(v_c.league_id, 'team_registered', jsonb_build_object('team_id', p_team_id, 'registration_id', v_r.id), v_c.id);
  return jsonb_build_object('registration_id', v_r.id, 'status', v_r.status, 'created', true);
end $$;

-- submit_squad(registration, players jsonb [{player_id, shirt_number, squad_role}]) → {version, status}
-- Team leader (within the deadline) or competition manager (any time).
-- Every player must be an ACTIVE member of the team at submission.
-- Replaces an open submitted version (it becomes 'superseded').
create or replace function public.submit_squad(p_registration_id uuid, p_players jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_r public.competition_teams%rowtype; v_c public.competitions%rowtype; v_rules jsonb;
  v_ver int; v_n int; v_mgr boolean;
begin
  select * into v_r from public.competition_teams where id = p_registration_id for update;
  if not found or not public.can_manage_registration(v_r.id) then raise exception 'league:not_found'; end if;
  select * into v_c from public.competitions where id = v_r.competition_id;
  v_mgr := public.is_league_manager(v_c.league_id, v_c.id);
  if v_r.status in ('rejected','withdrawn') then raise exception 'league:registration_closed'; end if;
  if not v_mgr and v_c.registration_deadline is not null and v_c.registration_deadline < now() and v_r.homologated_squad_version is null then
    raise exception 'league:registration_closed';
  end if;
  if jsonb_typeof(p_players) <> 'array' then raise exception 'league:invalid_squad'; end if;
  v_rules := public.competition_rules(v_c.id);
  v_n := jsonb_array_length(p_players);
  if v_n < (v_rules#>>'{squad,min}')::int or v_n > (v_rules#>>'{squad,max}')::int then raise exception 'league:squad_size'; end if;
  if exists (select 1 from jsonb_array_elements(p_players) e
              where not exists (select 1 from public.team_members m where m.team_id = v_r.team_id and m.status = 'active'
                                   and m.player_id = (e->>'player_id')::uuid)) then
    raise exception 'league:not_team_member';
  end if;
  update public.competition_squad_versions set status = 'superseded', decided_at = now(), decided_by = public.my_player_id()
   where registration_id = v_r.id and status = 'submitted';
  select coalesce(max(version), 0) + 1 into v_ver from public.competition_squad_versions where registration_id = v_r.id;
  insert into public.competition_squad_versions (registration_id, version, submitted_by) values (v_r.id, v_ver, public.my_player_id());
  insert into public.competition_squad_players (registration_id, version, player_id, shirt_number, squad_role)
  select v_r.id, v_ver, (e->>'player_id')::uuid, nullif(e->>'shirt_number', '')::int, coalesce(e->>'squad_role', 'player')
    from jsonb_array_elements(p_players) e;
  if v_r.status = 'draft' then
    update public.competition_teams set status = 'submitted', updated_at = now() where id = v_r.id;
  end if;
  perform public.league_audit(v_c.league_id, 'squad_submitted', jsonb_build_object('registration_id', v_r.id, 'version', v_ver, 'size', v_n), v_c.id);
  return jsonb_build_object('version', v_ver, 'status', 'submitted');
exception when unique_violation then raise exception 'league:invalid_squad' using detail = 'duplicate player or shirt';
end $$;

-- decide_squad(registration, version, 'approve'|'reject', note) → {status, homologated_squad_version}
-- Competition manager. Approve: previous homologated version → superseded;
-- the registration becomes 'homologated' (name/crest frozen the first time).
-- Refused if a player is already homologated for another team in this competition.
create or replace function public.decide_squad(p_registration_id uuid, p_version int, p_decision text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_r public.competition_teams%rowtype; v_c public.competitions%rowtype; v_t public.teams%rowtype;
begin
  if p_decision not in ('approve','reject') then raise exception 'league:invalid_decision'; end if;
  select * into v_r from public.competition_teams where id = p_registration_id for update;
  if not found then raise exception 'league:not_found'; end if;
  select * into v_c from public.competitions where id = v_r.competition_id;
  if not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  -- Serialize decisions within a competition (cross-team uniqueness check).
  perform pg_advisory_xact_lock(hashtextextended('league_squad:' || v_c.id::text, 0));
  if not exists (select 1 from public.competition_squad_versions where registration_id = v_r.id and version = p_version and status = 'submitted') then
    raise exception 'league:stale_version';
  end if;
  if p_decision = 'reject' then
    update public.competition_squad_versions set status = 'rejected', decided_by = public.my_player_id(), decided_at = now(), decision_note = left(p_note, 500)
     where registration_id = v_r.id and version = p_version;
    if v_r.homologated_squad_version is null then
      update public.competition_teams set status = 'rejected', decided_by = public.my_player_id(), decided_at = now(),
             decision_note = left(p_note, 500), updated_at = now() where id = v_r.id;
    end if;
  else
    if exists (select 1 from public.competition_squad_players sp
                 join public.competition_teams o on o.competition_id = v_r.competition_id and o.id <> v_r.id
                 join public.competition_squad_players osp on osp.registration_id = o.id and osp.version = o.homologated_squad_version
                where sp.registration_id = v_r.id and sp.version = p_version and osp.player_id = sp.player_id) then
      raise exception 'league:player_in_other_squad';
    end if;
    update public.competition_squad_versions set status = 'superseded'
     where registration_id = v_r.id and status = 'homologated';
    update public.competition_squad_versions set status = 'homologated', decided_by = public.my_player_id(), decided_at = now(), decision_note = left(p_note, 500)
     where registration_id = v_r.id and version = p_version;
    select * into v_t from public.teams where id = v_r.team_id;
    update public.competition_teams
       set status = 'homologated', homologated_squad_version = p_version,
           registered_name = coalesce(registered_name, v_t.name), registered_logo_url = coalesce(registered_logo_url, v_t.logo_url),
           decided_by = public.my_player_id(), decided_at = now(), decision_note = left(p_note, 500), updated_at = now()
     where id = v_r.id returning * into v_r;
  end if;
  perform public.league_audit(v_c.league_id, 'squad_' || p_decision || 'd', jsonb_build_object('registration_id', v_r.id, 'version', p_version), v_c.id);
  select * into v_r from public.competition_teams where id = v_r.id;
  return jsonb_build_object('status', v_r.status, 'homologated_squad_version', v_r.homologated_squad_version);
end $$;

-- withdraw_registration(registration, reason) → {status}
-- Team leader before any fixture exists; manager any time (L4 decides what
-- happens to already-scheduled fixtures — see plan §3.8 W.O. / annulment).
create or replace function public.withdraw_registration(p_registration_id uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_r public.competition_teams%rowtype; v_c public.competitions%rowtype;
begin
  select * into v_r from public.competition_teams where id = p_registration_id for update;
  if not found or not public.can_manage_registration(v_r.id) then raise exception 'league:not_found'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  select * into v_c from public.competitions where id = v_r.competition_id;
  if not public.is_league_manager(v_c.league_id, v_c.id) and v_c.status not in ('draft','registration_open','registration_closed') then
    raise exception 'league:ask_manager';
  end if;
  update public.competition_teams set status = 'withdrawn', decision_note = left(p_reason, 500), updated_at = now() where id = v_r.id;
  update public.competition_squad_versions set status = 'superseded' where registration_id = v_r.id and status = 'submitted';
  perform public.league_audit(v_c.league_id, 'registration_withdrawn', jsonb_build_object('registration_id', v_r.id, 'reason', p_reason), v_c.id);
  return jsonb_build_object('status', 'withdrawn');
end $$;

-- competition_teams_page(competition) → {items:[{team, status, squad[]}]}   (anon via competition visibility)
-- Public athlete projection: display name, shirt, position. In a youth
-- category: initials only, no photo (plan §5.4). Never email/phone/age.
create or replace function public.competition_teams_page(p_competition_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_youth boolean; v_vis text;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found then return null; end if;
  select * into v_g from public.leagues where id = v_c.league_id;
  v_vis := coalesce(v_c.visibility, v_g.visibility);
  if not ((public.my_player_id() is not null and public.can_see_competition(v_c.id))
          or (v_c.status <> 'draft' and v_g.status <> 'draft'
              and (v_vis in ('public','unlisted') or p_key in (v_c.view_key, v_g.view_key)))) then
    return null;
  end if;
  v_youth := coalesce((select youth from public.league_categories where id = v_c.category_id), false);
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'registration_id', ct.id,
             'team', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', coalesce(ct.registered_name, t.name),
                                        'logo_url', coalesce(ct.registered_logo_url, t.logo_url), 'color', t.color),
             'squad', (select coalesce(jsonb_agg(jsonb_build_object(
                         'player_id', p.id,
                         'name', case when v_youth then upper(left(p.name, 1)) || '.' else public.league_person_name(p.id) end,
                         'photo_url', case when v_youth then null else p.photo_url end,
                         'position', p.position, 'shirt_number', sq.shirt_number, 'squad_role', sq.squad_role)
                         order by sq.shirt_number nulls last), '[]'::jsonb)
                         from public.competition_squad(ct.id) sq join public.players p on p.id = sq.player_id))
           order by coalesce(ct.registered_name, t.name))
      from public.competition_teams ct join public.teams t on t.id = ct.team_id
     where ct.competition_id = v_c.id and ct.status = 'homologated'), '[]'::jsonb));
end $$;

-- ── 6. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.is_competition_participant(uuid)', 'public.can_manage_registration(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.create_registration_link(uuid, uuid)', 'public.register_team(text, uuid)',
    'public.submit_squad(uuid, jsonb)', 'public.decide_squad(uuid, int, text, text)',
    'public.withdraw_registration(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.registration_link_preview(text)', 'public.competition_teams_page(uuid, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.competition_squad(uuid) from public, anon, authenticated';
  execute 'grant execute on function public.competition_squad(uuid) to service_role';
end $$;

-- ── 7. Registration review (integration addition) ───────
-- competition_registrations(competition) → {items:[{registration_id,
-- team_id, team_name, status, homologated_squad_version, versions:[{version,
-- status, players:[{player_id, name, shirt_number, squad_role}]}]}], is_manager}
-- Competition managers see every registration (to review squads); a team
-- leader sees only their own team's. Names through league_person_name
-- (display name only — never email/phone/age), because players rows of
-- other teams are not readable through RLS.
create or replace function public.competition_registrations(p_competition_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_mgr boolean;
begin
  if public.my_player_id() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into v_c from public.competitions where id = p_competition_id;
  if not found then raise exception 'league:not_found'; end if;
  v_mgr := public.is_league_manager(v_c.league_id, v_c.id);
  if not v_mgr and not public.can_see_competition(v_c.id) then raise exception 'league:not_found'; end if;
  return jsonb_build_object('is_manager', v_mgr, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'registration_id', ct.id, 'team_id', ct.team_id, 'team_name', coalesce(ct.registered_name, t.name),
             'status', ct.status, 'homologated_squad_version', ct.homologated_squad_version, 'decision_note', ct.decision_note,
             'versions', (select coalesce(jsonb_agg(jsonb_build_object(
                             'version', v.version, 'status', v.status, 'submitted_at', v.submitted_at, 'decision_note', v.decision_note,
                             'players', (select coalesce(jsonb_agg(jsonb_build_object(
                                            'player_id', sp.player_id, 'name', public.league_person_name(sp.player_id),
                                            'shirt_number', sp.shirt_number, 'squad_role', sp.squad_role)
                                          order by sp.shirt_number nulls last), '[]'::jsonb)
                                           from public.competition_squad_players sp
                                          where sp.registration_id = v.registration_id and sp.version = v.version))
                           order by v.version desc), '[]'::jsonb)
                            from public.competition_squad_versions v where v.registration_id = ct.id))
           order by coalesce(ct.registered_name, t.name))
      from public.competition_teams ct join public.teams t on t.id = ct.team_id
     where ct.competition_id = v_c.id and (v_mgr or public.is_team_leader(ct.team_id))), '[]'::jsonb));
end $$;
revoke execute on function public.competition_registrations(uuid) from public, anon;
grant execute on function public.competition_registrations(uuid) to authenticated, service_role;

-- ── Comments ─────────────────────────────────────────────
comment on table public.competition_registration_links is 'PITCH Ligas: token links a manager sends to team captains to register in a competition.';
comment on table public.competition_teams is 'PITCH Ligas: an existing Rivals team registered in a competition (draft→submitted→homologated|rejected|withdrawn). Name/logo frozen at first homologation.';
comment on table public.competition_squad_versions is 'PITCH Ligas: versioned squad submissions per registration; the manager approves/rejects each version.';
comment on table public.competition_squad_players is 'PITCH Ligas: write-once squad snapshot rows. Leaving the live team does not remove a player from a homologated squad.';
