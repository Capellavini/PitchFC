-- ─────────────────────────────────────────────────────────
-- DRAFT — PITCH Ligas Fase 2, PR L4: ONE match table for both origins
-- (challenge | competition), phases/rounds, fixtures, scheduling and
-- official assignment.
--
-- NOT A MIGRATION (see 01 header). Depends on 01–03 + Rivals 140000/120000.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.5, §3.6, §4.
--
-- THE KEY CHANGE: public.team_matches stops being "the match of a
-- challenge" and becomes "the match between two teams", with an explicit
-- origin. A league fixture IS a team_matches row — the team page, the
-- league page and the match page all show the same id (brief §15).
--
--   • team_matches + source_type ('challenge' default | 'competition'),
--     competition_id, phase_id, round_id, seq (optimistic version / event
--     log counter, used from L5).
--   • challenge_id, agreed_version, kickoff_at, field_responsible, cost_split
--     become NULLable — but a CHECK keeps them NOT NULL for challenge rows,
--     and keeps exactly one origin per row.
--   • Status vocabularies are split per origin by CHECK. Invariant that
--     protects every Rivals aggregate (team_record / form / h2h / scouting /
--     my_team_career / roster stats, all filtering result_status =
--     'confirmed'): a competition row can NEVER be 'confirmed' — it is
--     'homologated'. So Rivals metrics stay friendly-only without touching
--     those functions; league metrics come from L6 projections.
--   • Origin guards (triggers) so the Rivals RPCs cannot touch a league
--     match: no direct team_matches UPDATE outside league RPCs (GUC
--     pitch.league_rpc set transaction-locally by them), no Rivals result
--     revisions, no hand-typed player stats (league stats derive from
--     events). RSVP + lineup tables ARE reused (convocatória).
--   • A team with an active registration cannot be archived.
-- ─────────────────────────────────────────────────────────

-- ── 1. Phases, groups, rounds ────────────────────────────
create table if not exists public.competition_phases (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  ordinal        int  not null check (ordinal between 1 and 10),
  name           text not null check (char_length(btrim(name)) between 1 and 40),
  kind           text not null default 'league' check (kind in ('league','groups','knockout')),
  double_legged  boolean not null default false,
  status         text not null default 'draft' check (status in ('draft','active','finished')),
  created_at     timestamptz not null default now(),
  constraint competition_phases_ordinal_key unique (competition_id, ordinal)
);

-- Groups exist in the schema for the future 'groups' structure; Fase 2's
-- 'league' phase has none (group_id stays null on its matches).
create table if not exists public.competition_groups (
  id       uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.competition_phases(id) on delete cascade,
  name     text not null check (char_length(btrim(name)) between 1 and 20),
  constraint competition_groups_name_key unique (phase_id, name)
);

create table if not exists public.competition_rounds (
  id        uuid primary key default gen_random_uuid(),
  phase_id  uuid not null references public.competition_phases(id) on delete cascade,
  number    int  not null check (number between 1 and 200),
  name      text,                    -- "Jornada 3" (UI default when null)
  starts_on date,
  constraint competition_rounds_number_key unique (phase_id, number)
);

-- ── 2. team_matches: origin ──────────────────────────────
alter table public.team_matches
  add column if not exists source_type    text not null default 'challenge',
  add column if not exists competition_id uuid references public.competitions(id) on delete restrict,
  add column if not exists phase_id       uuid references public.competition_phases(id) on delete restrict,
  add column if not exists group_id       uuid references public.competition_groups(id) on delete restrict,
  add column if not exists round_id       uuid references public.competition_rounds(id) on delete restrict,
  add column if not exists replay_of_match_id uuid references public.team_matches(id) on delete set null,
  -- Bumped by every league event append / lifecycle transition (L5). The
  -- client sends the seq it last saw for lifecycle actions (end, submit,
  -- homologate): stale → league:stale_seq, never a silent overwrite.
  add column if not exists seq            int  not null default 0,
  add column if not exists status_reason  text check (status_reason is null or char_length(status_reason) <= 500);

alter table public.team_matches alter column challenge_id      drop not null;
alter table public.team_matches alter column agreed_version    drop not null;
alter table public.team_matches alter column kickoff_at        drop not null;
alter table public.team_matches alter column field_responsible drop not null;
alter table public.team_matches alter column cost_split        drop not null;

-- Widen the inline status checks (names as generated by 140000's create table).
alter table public.team_matches drop constraint if exists team_matches_match_status_check;
alter table public.team_matches add constraint team_matches_match_status_check
  check (match_status in ('scheduled','cancelled','not_played','played',                       -- challenge
                          'unscheduled','live','finished','postponed','abandoned'));          -- competition (+ scheduled, cancelled)
alter table public.team_matches drop constraint if exists team_matches_result_status_check;
alter table public.team_matches add constraint team_matches_result_status_check
  check (result_status in ('none','reported','disputed','confirmed',                          -- challenge
                           'provisional','submitted','homologated'));                         -- competition (+ none). Disputes are records (L6), not a status: an official result keeps counting until a decision changes it.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_matches_source_type_check') then
    alter table public.team_matches add constraint team_matches_source_type_check
      check (source_type in ('challenge','competition'));
  end if;
  -- Exactly one origin, with the columns that origin needs.
  if not exists (select 1 from pg_constraint where conname = 'team_matches_origin_check') then
    alter table public.team_matches add constraint team_matches_origin_check check (
      (source_type = 'challenge'
         and challenge_id is not null and agreed_version is not null and kickoff_at is not null
         and field_responsible is not null and cost_split is not null
         and competition_id is null and phase_id is null and round_id is null and group_id is null)
      or
      (source_type = 'competition'
         and challenge_id is null and agreed_version is null
         and competition_id is not null and phase_id is not null and round_id is not null));
  end if;
  -- Per-origin vocabularies (see header: 'confirmed' ⇒ challenge).
  if not exists (select 1 from pg_constraint where conname = 'team_matches_origin_status_check') then
    alter table public.team_matches add constraint team_matches_origin_status_check check (
      (source_type = 'challenge'
         and match_status in ('scheduled','cancelled','not_played','played')
         and result_status in ('none','reported','disputed','confirmed'))
      or
      (source_type = 'competition'
         and match_status in ('unscheduled','scheduled','live','finished','postponed','cancelled','abandoned')
         and result_status in ('none','provisional','submitted','homologated')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_matches_kickoff_check') then
    alter table public.team_matches add constraint team_matches_kickoff_check
      check (kickoff_at is not null or match_status in ('unscheduled','postponed','cancelled'));
  end if;
end $$;

create index if not exists team_matches_competition_idx
  on public.team_matches (competition_id, round_id) where competition_id is not null;
-- A pair meets at most once per round (replays excluded).
create unique index if not exists team_matches_round_pair_key
  on public.team_matches (round_id, least(home_team_id, away_team_id), greatest(home_team_id, away_team_id))
  where round_id is not null and replay_of_match_id is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_audit_log_match_fkey') then
    alter table public.league_audit_log add constraint league_audit_log_match_fkey
      foreign key (match_id) references public.team_matches(id) on delete set null;
  end if;
end $$;

-- ── 3. Officials (mesa / árbitro) ────────────────────────
create table if not exists public.team_match_officials (
  match_id    uuid not null references public.team_matches(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  role        text not null check (role in ('scorer','referee')),
  assigned_by uuid references public.players(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (match_id, player_id, role)
);
create index if not exists team_match_officials_player_idx on public.team_match_officials (player_id);

-- ── 4. Guards ────────────────────────────────────────────
-- League RPCs call this first; it marks the transaction as a league write.
create or replace function public.league_rpc_begin()
returns void language sql volatile set search_path = public as $$
  select set_config('pitch.league_rpc', 'on', true);
$$;

create or replace function public.league_guard_team_matches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source_type is distinct from old.source_type or new.challenge_id is distinct from old.challenge_id
     or new.competition_id is distinct from old.competition_id then
    raise exception 'league:origin_immutable';
  end if;
  if old.source_type = 'competition' and coalesce(current_setting('pitch.league_rpc', true), '') <> 'on' then
    raise exception 'league:managed_by_league';
  end if;
  return new;
end $$;
drop trigger if exists team_matches_league_guard on public.team_matches;
create trigger team_matches_league_guard before update on public.team_matches
  for each row execute function public.league_guard_team_matches();

create or replace function public.league_guard_no_rivals_rows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.team_matches m where m.id = new.match_id and m.source_type = 'competition') then
    raise exception '%', case tg_table_name when 'team_match_results' then 'league:use_homologation'
                                            else 'league:stats_from_events' end;
  end if;
  return new;
end $$;
drop trigger if exists team_match_results_league_guard on public.team_match_results;
create trigger team_match_results_league_guard before insert on public.team_match_results
  for each row execute function public.league_guard_no_rivals_rows();
drop trigger if exists team_match_player_stats_league_guard on public.team_match_player_stats;
create trigger team_match_player_stats_league_guard before insert or update on public.team_match_player_stats
  for each row execute function public.league_guard_no_rivals_rows();

-- Lineup of a league match: only players in the team's HOMOLOGATED squad
-- (L7 adds "and not suspended").
create or replace function public.league_guard_lineup()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.team_matches%rowtype;
begin
  select * into m from public.team_matches where id = new.match_id;
  if m.source_type <> 'competition' then return new; end if;
  if not exists (select 1 from public.competition_teams ct
                   join public.competition_squad_players sp on sp.registration_id = ct.id and sp.version = ct.homologated_squad_version
                  where ct.competition_id = m.competition_id and ct.team_id = new.team_id and sp.player_id = new.player_id) then
    raise exception 'league:player_not_in_squad';
  end if;
  return new;
end $$;
drop trigger if exists team_match_lineup_league_guard on public.team_match_lineup;
create trigger team_match_lineup_league_guard before insert or update on public.team_match_lineup
  for each row execute function public.league_guard_lineup();

-- Archiving a team that still plays a competition is refused.
create or replace function public.league_guard_team_archive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
       select 1 from public.competition_teams ct join public.competitions c on c.id = ct.competition_id
        where ct.team_id = new.id and ct.status in ('submitted','homologated')
          and c.status not in ('finished','archived')) then
    raise exception 'league:team_in_competition';
  end if;
  return new;
end $$;
drop trigger if exists teams_league_archive_guard on public.teams;
create trigger teams_league_archive_guard before update of archived_at on public.teams
  for each row execute function public.league_guard_team_archive();

-- ── 5. Visibility of league matches ──────────────────────
create or replace function public.can_see_match(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.team_matches m
     where m.id = mid
       and (public.is_team_member(m.home_team_id) or public.is_team_member(m.away_team_id)
            or (m.competition_id is not null and public.can_see_competition(m.competition_id))));
$$;

drop policy if exists "team_matches select" on public.team_matches;
create policy "team_matches select" on public.team_matches for select to authenticated
  using (public.is_team_member(home_team_id) or public.is_team_member(away_team_id) or public.is_admin()
         or (competition_id is not null and public.can_see_competition(competition_id)));

alter table public.competition_phases   enable row level security;
alter table public.competition_groups   enable row level security;
alter table public.competition_rounds   enable row level security;
alter table public.team_match_officials enable row level security;

drop policy if exists "competition_phases select" on public.competition_phases;
create policy "competition_phases select" on public.competition_phases for select to authenticated
  using (public.can_see_competition(competition_id));
drop policy if exists "competition_groups select" on public.competition_groups;
create policy "competition_groups select" on public.competition_groups for select to authenticated
  using (exists (select 1 from public.competition_phases p where p.id = phase_id and public.can_see_competition(p.competition_id)));
drop policy if exists "competition_rounds select" on public.competition_rounds;
create policy "competition_rounds select" on public.competition_rounds for select to authenticated
  using (exists (select 1 from public.competition_phases p where p.id = phase_id and public.can_see_competition(p.competition_id)));
-- Officials are visible to those who can see the match (brief §7 "arbitragem
-- e mesa, conforme visibilidade"); names only through RPC payloads.
drop policy if exists "team_match_officials select" on public.team_match_officials;
create policy "team_match_officials select" on public.team_match_officials for select to authenticated
  using (public.can_see_match(match_id));

revoke all on table public.competition_phases, public.competition_groups, public.competition_rounds,
                    public.team_match_officials from anon, authenticated;
grant select on table public.competition_phases, public.competition_groups, public.competition_rounds,
                      public.team_match_officials to authenticated;
grant all on table public.competition_phases, public.competition_groups, public.competition_rounds,
                   public.team_match_officials to service_role;

-- ── 6. Helpers ───────────────────────────────────────────
-- Lock + load a league match; raises when not a competition match.
create or replace function public.league_lock_match(p_match_id uuid)
returns public.team_matches language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype;
begin
  select * into m from public.team_matches where id = p_match_id for update;
  if not found or m.source_type <> 'competition' then raise exception 'league:match_not_found'; end if;
  return m;
end $$;

create or replace function public.is_match_official(mid uuid, p_roles text[] default array['scorer','referee'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_match_officials o
                  where o.match_id = mid and o.player_id = public.my_player_id() and o.role = any(p_roles));
$$;

-- ── 7. RPCs ──────────────────────────────────────────────

-- create_phase(competition, name, double_legged) → {phase_id, ordinal}
-- Fase 2: kind 'league' only, one phase per competition.
create or replace function public.create_phase(p_competition_id uuid, p_name text default 'Fase regular',
                                               p_double_legged boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_p public.competition_phases%rowtype;
begin
  select * into v_c from public.competitions where id = p_competition_id for update;
  if not found or not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  select * into v_p from public.competition_phases where competition_id = v_c.id;
  if found then return jsonb_build_object('phase_id', v_p.id, 'ordinal', v_p.ordinal, 'created', false); end if;
  insert into public.competition_phases (competition_id, ordinal, name, kind, double_legged)
  values (v_c.id, 1, btrim(p_name), 'league', coalesce(p_double_legged, false)) returning * into v_p;
  perform public.league_audit(v_c.league_id, 'phase_created', jsonb_build_object('phase_id', v_p.id), v_c.id);
  return jsonb_build_object('phase_id', v_p.id, 'ordinal', v_p.ordinal, 'created', true);
end $$;

-- create_fixtures(phase, fixtures [{round, home_team_id, away_team_id}]) → {created, matches}
-- The CLIENT generates the round robin with the shared core
-- (src/lib/core/standings.js roundRobinFixtures); the SERVER only
-- validates that it is a complete, consistent round robin of the
-- homologated teams: every unordered pair exactly once (twice, one per
-- direction, when double_legged), a team at most once per round.
-- One-shot: if fixtures already exist for the phase, an identical set
-- returns created = false; a different set → league:fixtures_exist.
create or replace function public.create_fixtures(p_phase_id uuid, p_fixtures jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_p public.competition_phases%rowtype; v_c public.competitions%rowtype; v_g public.leagues%rowtype;
  v_teams uuid[]; v_n int; v_expected int; v_round uuid; rec record;
begin
  perform public.league_rpc_begin();
  select * into v_p from public.competition_phases where id = p_phase_id for update;
  if not found then raise exception 'league:not_found'; end if;
  select * into v_c from public.competitions where id = v_p.competition_id;
  select * into v_g from public.leagues where id = v_c.league_id;
  if not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  if jsonb_typeof(p_fixtures) <> 'array' then raise exception 'league:invalid_fixtures'; end if;

  drop table if exists pg_temp._fx;
  create temp table _fx on commit drop as
    select (e->>'round')::int as rnd, (e->>'home_team_id')::uuid as home, (e->>'away_team_id')::uuid as away
      from jsonb_array_elements(p_fixtures) e;

  if exists (select 1 from public.team_matches where phase_id = v_p.id) then
    if (select count(*) from _fx) = (select count(*) from public.team_matches m where m.phase_id = v_p.id and m.replay_of_match_id is null)
       and not exists (select 1 from _fx f where not exists (
             select 1 from public.team_matches m join public.competition_rounds r on r.id = m.round_id
              where m.phase_id = v_p.id and r.number = f.rnd and m.home_team_id = f.home and m.away_team_id = f.away)) then
      return jsonb_build_object('created', false, 'matches', (select count(*) from _fx));
    end if;
    raise exception 'league:fixtures_exist';
  end if;

  select array_agg(team_id order by team_id) into v_teams
    from public.competition_teams where competition_id = v_c.id and status = 'homologated';
  v_n := coalesce(array_length(v_teams, 1), 0);
  if v_n < 2 then raise exception 'league:not_enough_teams'; end if;
  v_expected := (v_n * (v_n - 1) / 2) * case when v_p.double_legged then 2 else 1 end;

  if exists (select 1 from _fx where rnd is null or rnd < 1 or home is null or away is null or home = away
                                 or not (home = any(v_teams)) or not (away = any(v_teams))) then
    raise exception 'league:invalid_fixtures' using detail = 'unknown team / self match / bad round';
  end if;
  if (select count(*) from _fx) <> v_expected then raise exception 'league:invalid_fixtures' using detail = 'incomplete round robin'; end if;
  if exists (select 1 from (select rnd, t from _fx, lateral unnest(array[home, away]) t) x group by rnd, t having count(*) > 1) then
    raise exception 'league:invalid_fixtures' using detail = 'team twice in a round';
  end if;
  if v_p.double_legged then
    if exists (select 1 from _fx group by home, away having count(*) > 1) then
      raise exception 'league:invalid_fixtures' using detail = 'same direction twice';
    end if;
  elsif exists (select 1 from _fx group by least(home, away), greatest(home, away) having count(*) > 1) then
    raise exception 'league:invalid_fixtures' using detail = 'pair twice';
  end if;

  for rec in select distinct rnd from _fx order by rnd loop
    insert into public.competition_rounds (phase_id, number) values (v_p.id, rec.rnd) on conflict (phase_id, number) do nothing;
  end loop;
  insert into public.team_matches (source_type, competition_id, phase_id, round_id, home_team_id, away_team_id,
                                   kickoff_at, timezone, format, duration_min, currency, match_status)
  select 'competition', v_c.id, v_p.id, r.id, f.home, f.away,
         null, coalesce(v_c.timezone, v_g.timezone), v_c.format, v_c.match_duration_min,
         case v_g.country when 'BR' then 'BRL' else 'EUR' end, 'unscheduled'
    from _fx f join public.competition_rounds r on r.phase_id = v_p.id and r.number = f.rnd;
  update public.competition_phases set status = 'active' where id = v_p.id;
  perform public.league_audit(v_c.league_id, 'fixtures_created', jsonb_build_object('phase_id', v_p.id, 'matches', v_expected), v_c.id);
  return jsonb_build_object('created', true, 'matches', v_expected);
end $$;

-- schedule_match(match, kickoff, venue{name,address,url}, expected_seq) → {match_id, match_status, seq}
-- Manager. unscheduled | scheduled | postponed → scheduled.
create or replace function public.schedule_match(p_match_id uuid, p_kickoff_at timestamptz, p_venue jsonb default '{}'::jsonb,
                                                 p_expected_seq int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v jsonb := coalesce(p_venue, '{}'::jsonb);
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  if not public.is_league_manager(public.competition_league(m.competition_id), m.competition_id) then raise exception 'league:match_not_found'; end if;
  if p_expected_seq is not null and p_expected_seq <> m.seq then raise exception 'league:stale_seq'; end if;
  if m.match_status not in ('unscheduled','scheduled','postponed') then raise exception 'league:invalid_transition'; end if;
  if p_kickoff_at is null then raise exception 'league:kickoff_required'; end if;
  update public.team_matches
     set kickoff_at = p_kickoff_at, match_status = 'scheduled',
         venue_name = coalesce(v->>'name', venue_name), venue_address = coalesce(v->>'address', venue_address),
         venue_url = coalesce(v->>'url', venue_url), seq = seq + 1, updated_at = now()
   where id = m.id returning * into m;
  perform public.league_audit(public.competition_league(m.competition_id), 'match_scheduled',
    jsonb_build_object('kickoff_at', p_kickoff_at), m.competition_id, m.id);
  return jsonb_build_object('match_id', m.id, 'match_status', m.match_status, 'seq', m.seq);
end $$;

-- postpone_match(match, reason) / cancel_match(match, reason) → {match_status, seq}
-- Manager; reason mandatory. Postponed keeps the row (same id, back to
-- scheduled via schedule_match). Cancelled is terminal and never counts
-- (plan §3.8). Neither is allowed once events exist (use abandon, L6).
create or replace function public.set_match_off(p_match_id uuid, p_status text, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype;
begin
  perform public.league_rpc_begin();
  if p_status not in ('postponed','cancelled') then raise exception 'league:invalid_transition'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  m := public.league_lock_match(p_match_id);
  if not public.is_league_manager(public.competition_league(m.competition_id), m.competition_id) then raise exception 'league:match_not_found'; end if;
  if m.match_status not in ('unscheduled','scheduled','postponed') then raise exception 'league:invalid_transition'; end if;
  update public.team_matches
     set match_status = p_status, status_reason = left(p_reason, 500), seq = seq + 1, updated_at = now(),
         kickoff_at = case when p_status = 'postponed' then null else kickoff_at end,
         cancelled_at = case when p_status = 'cancelled' then now() end,
         cancel_reason = case when p_status = 'cancelled' then left(p_reason, 280) end
   where id = m.id returning * into m;
  perform public.league_audit(public.competition_league(m.competition_id), 'match_' || p_status,
    jsonb_build_object('reason', p_reason), m.competition_id, m.id);
  return jsonb_build_object('match_id', m.id, 'match_status', m.match_status, 'seq', m.seq);
end $$;

-- assign_official(match, player, role, assign) → {assigned}
-- Manager. The player must be an active league member with that role
-- (league-wide or scoped to this competition) — or a manager.
create or replace function public.assign_official(p_match_id uuid, p_player_id uuid, p_role text, p_assign boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_league uuid;
begin
  if p_role not in ('scorer','referee') then raise exception 'league:invalid_role'; end if;
  select * into m from public.team_matches where id = p_match_id and source_type = 'competition';
  if not found then raise exception 'league:match_not_found'; end if;
  v_league := public.competition_league(m.competition_id);
  if not public.is_league_manager(v_league, m.competition_id) then raise exception 'league:match_not_found'; end if;
  if p_assign then
    if not exists (select 1 from public.league_members lm
                    where lm.league_id = v_league and lm.player_id = p_player_id and lm.status = 'active'
                      and lm.role in (p_role, 'owner', 'manager')
                      and (lm.competition_id is null or lm.competition_id = m.competition_id)) then
      raise exception 'league:not_a_collaborator';
    end if;
    insert into public.team_match_officials (match_id, player_id, role, assigned_by)
    values (m.id, p_player_id, p_role, public.my_player_id()) on conflict do nothing;
  else
    delete from public.team_match_officials where match_id = m.id and player_id = p_player_id and role = p_role;
  end if;
  perform public.league_audit(v_league, case when p_assign then 'official_assigned' else 'official_unassigned' end,
    jsonb_build_object('player_id', p_player_id, 'role', p_role), m.competition_id, m.id);
  return jsonb_build_object('assigned', p_assign);
end $$;

-- competition_matches(competition, round_number|null, key) → {items:[…]}   (anon via visibility)
create or replace function public.competition_matches(p_competition_id uuid, p_round int default null, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text;
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
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'round', r.number, 'round_name', r.name,
             'home', jsonb_build_object('id', m.home_team_id, 'name', coalesce(hc.registered_name, ht.name), 'slug', ht.slug, 'logo_url', coalesce(hc.registered_logo_url, ht.logo_url)),
             'away', jsonb_build_object('id', m.away_team_id, 'name', coalesce(ac.registered_name, at.name), 'slug', at.slug, 'logo_url', coalesce(ac.registered_logo_url, at.logo_url)),
             'kickoff_at', m.kickoff_at, 'timezone', m.timezone, 'venue_name', m.venue_name,
             'match_status', m.match_status, 'result_status', m.result_status,
             -- Official score only once homologated; live/provisional score comes from L5's match_live().
             'home_score', case when m.result_status = 'homologated' then m.official_home_score end,
             'away_score', case when m.result_status = 'homologated' then m.official_away_score end)
           order by r.number, m.kickoff_at nulls last, m.id)
      from public.team_matches m
      join public.competition_rounds r on r.id = m.round_id
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      left join public.competition_teams hc on hc.competition_id = m.competition_id and hc.team_id = m.home_team_id
      left join public.competition_teams ac on ac.competition_id = m.competition_id and ac.team_id = m.away_team_id
     where m.competition_id = v_c.id and (p_round is null or r.number = p_round)), '[]'::jsonb));
end $$;

-- ── 8. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  execute 'revoke execute on function public.is_match_official(uuid, text[]) from public, anon';
  execute 'grant execute on function public.is_match_official(uuid, text[]) to authenticated, service_role';
  foreach f in array array[
    'public.create_phase(uuid, text, boolean)', 'public.create_fixtures(uuid, jsonb)',
    'public.schedule_match(uuid, timestamptz, jsonb, int)', 'public.set_match_off(uuid, text, text)',
    'public.assign_official(uuid, uuid, text, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.competition_matches(uuid, int, text) from public';
  execute 'grant execute on function public.competition_matches(uuid, int, text) to anon, authenticated, service_role';
  -- league_rpc_begin must NOT be callable through the API (it would only
  -- set a GUC for the caller's own transaction, but keep the surface shut).
  foreach f in array array['public.league_rpc_begin()', 'public.league_lock_match(uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
