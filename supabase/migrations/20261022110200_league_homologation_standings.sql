-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L6 (design plan PR L6): homologation,
-- official stat snapshots, disputes, W.O. / abandonment, point
-- adjustments, standings and player rankings.
--
-- Source: docs/ligas-draft-sql/06_homologation_standings.sql (validated in
-- PGlite on top of the shipped L1–L5). Depends on 155000–155400.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.8, §3.9, §3.10.
-- Check: supabase/tests/ligas_l6_check.sql.
--
-- Fix vs the draft: league_snapshot_immutable() resolved old.status in one
-- AND chain, which errors ("record old has no field status") on
-- team_match_official_stats instead of raising league:snapshot_immutable.
-- Now nested + to_jsonb (still blocks every UPDATE/DELETE on both tables
-- except current → superseded on homologations).
--
-- Integration additions (end of file, §9): competition_rankings() (top
-- scorers / assists / cards / appearances with rank) and
-- competition_disputes() (the authority's dispute inbox).
--
-- Rivals isolation: every function here filters source_type =
-- 'competition' (directly or through league_lock_match); a competition row
-- can never be 'confirmed' (CHECK from 155300), so Rivals aggregates are
-- untouched.
--
-- Projection strategy:
--   • LIVE / provisional numbers = computed on read from the effective
--     event log (league_match_score, match_live). Cheap: one match.
--   • OFFICIAL numbers = a SNAPSHOT written in the same transaction as the
--     homologation (team_match_homologations + team_match_official_stats),
--     never hand-edited; a later correction to the log does not change the
--     table until the authority re-homologates (new revision, previous
--     superseded).
--   • STANDINGS / rankings = SQL functions over the CURRENT homologations +
--     audited point adjustments + the published regulation. No stored totals.
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.team_match_homologations (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.team_matches(id) on delete cascade,
  revision           int  not null check (revision >= 1),
  -- played   : score + stats from the event log
  -- walkover : W.O. — score from regulation.walkover, no player stats
  -- awarded  : authority-imposed score (e.g. abandoned match), no player stats
  -- annulled : the match does not count at all
  kind               text not null check (kind in ('played','walkover','awarded','annulled')),
  home_score         int  check (home_score is null or home_score between 0 and 99),
  away_score         int  check (away_score is null or away_score between 0 and 99),
  winner_team_id     uuid references public.teams(id) on delete restrict,
  loser_team_id      uuid references public.teams(id) on delete restrict,  -- walkover: the team that did not show
  event_seq          int  not null,                 -- team_matches.seq homologated (the log the authority saw)
  regulation_version int  not null,
  status             text not null default 'current' check (status in ('current','superseded')),
  decided_by         uuid references public.players(id) on delete set null,
  decided_role       text not null,
  reason             text check (reason is null or char_length(reason) <= 500),
  created_at         timestamptz not null default now(),
  constraint team_match_homologations_rev_key unique (match_id, revision),
  constraint team_match_homologations_scores_check check (kind = 'annulled' or (home_score is not null and away_score is not null))
);
create unique index if not exists team_match_homologations_one_current_key
  on public.team_match_homologations (match_id) where status = 'current';

create table if not exists public.team_match_official_stats (
  homologation_id uuid not null references public.team_match_homologations(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete restrict,
  team_id         uuid not null references public.teams(id) on delete restrict,
  appeared        boolean not null default false,
  goals           int not null default 0 check (goals >= 0),
  own_goals       int not null default 0 check (own_goals >= 0),
  assists         int not null default 0 check (assists >= 0),
  yellows         int not null default 0 check (yellows >= 0),
  second_yellows  int not null default 0 check (second_yellows >= 0),
  reds            int not null default 0 check (reds >= 0),
  primary key (homologation_id, player_id)
);
create index if not exists team_match_official_stats_player_idx on public.team_match_official_stats (player_id);

create table if not exists public.team_match_disputes (
  id                    uuid primary key default gen_random_uuid(),
  match_id              uuid not null references public.team_matches(id) on delete cascade,
  homologation_revision int,                           -- null = disputed while still in review
  opened_by_team_id     uuid not null references public.teams(id) on delete cascade,
  opened_by_player_id   uuid references public.players(id) on delete set null,
  reason                text not null check (char_length(btrim(reason)) between 5 and 1000),
  -- [{kind:'url'|'note'|'var_clip', ref:'…'}] — evidence; a clip never decides by itself (brief §12)
  evidence              jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  status                text not null default 'open' check (status in ('open','upheld','rejected','withdrawn')),
  deadline_at           timestamptz,                   -- window end that applied when opened
  decided_by            uuid references public.players(id) on delete set null,
  decided_role          text,
  decision_note         text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_at            timestamptz,
  created_at            timestamptz not null default now()
);
create unique index if not exists team_match_disputes_one_open_key
  on public.team_match_disputes (match_id, opened_by_team_id) where status = 'open';

-- Administrative point deductions/bonuses: justified + traceable, never an
-- edit of the computed total (brief §9). Revoking keeps the row.
create table if not exists public.competition_point_adjustments (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete restrict,
  points         int  not null check (points between -50 and 50 and points <> 0),
  reason         text not null check (char_length(btrim(reason)) between 5 and 500),
  decided_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     uuid references public.players(id) on delete set null,
  revoke_reason  text check (revoke_reason is null or char_length(revoke_reason) <= 500)
);

-- Snapshots are write-once.
create or replace function public.league_snapshot_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Nested (not one AND chain): official_stats rows have no "status" field,
  -- and plpgsql does not short-circuit record field resolution.
  if tg_table_name = 'team_match_homologations' and tg_op = 'UPDATE' then
    if to_jsonb(old)->>'status' = 'current' and to_jsonb(new)->>'status' = 'superseded'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;   -- the only allowed change
    end if;
  end if;
  raise exception 'league:snapshot_immutable';
end $$;
drop trigger if exists team_match_homologations_immutable on public.team_match_homologations;
create trigger team_match_homologations_immutable before update or delete on public.team_match_homologations
  for each row execute function public.league_snapshot_immutable();
drop trigger if exists team_match_official_stats_immutable on public.team_match_official_stats;
create trigger team_match_official_stats_immutable before update or delete on public.team_match_official_stats
  for each row execute function public.league_snapshot_immutable();

-- ── 2. RLS + grants ──────────────────────────────────────
alter table public.team_match_homologations      enable row level security;
alter table public.team_match_official_stats     enable row level security;
alter table public.team_match_disputes           enable row level security;
alter table public.competition_point_adjustments enable row level security;

drop policy if exists "team_match_homologations select" on public.team_match_homologations;
create policy "team_match_homologations select" on public.team_match_homologations for select to authenticated
  using (public.can_see_match(match_id));
drop policy if exists "team_match_official_stats select" on public.team_match_official_stats;
create policy "team_match_official_stats select" on public.team_match_official_stats for select to authenticated
  using (exists (select 1 from public.team_match_homologations h where h.id = homologation_id and public.can_see_match(h.match_id)));
-- Disputes: staff + the two teams (not the public; the decision is
-- published through the match payload once taken).
drop policy if exists "team_match_disputes select" on public.team_match_disputes;
create policy "team_match_disputes select" on public.team_match_disputes for select to authenticated
  using (exists (select 1 from public.team_matches m where m.id = match_id
                  and (public.is_competition_staff(m.competition_id) or public.is_team_member(m.home_team_id)
                       or public.is_team_member(m.away_team_id))));
-- Adjustments are public with the table (the reason is shown next to the points).
drop policy if exists "competition_point_adjustments select" on public.competition_point_adjustments;
create policy "competition_point_adjustments select" on public.competition_point_adjustments for select to authenticated
  using (public.can_see_competition(competition_id));

revoke all on table public.team_match_homologations, public.team_match_official_stats, public.team_match_disputes,
                    public.competition_point_adjustments from anon, authenticated;
grant select on table public.team_match_homologations, public.team_match_official_stats, public.team_match_disputes,
                      public.competition_point_adjustments to authenticated;
grant select, insert, update, delete on table public.team_match_homologations, public.team_match_official_stats, public.team_match_disputes,
                   public.competition_point_adjustments to service_role;

-- ── 3. Internal: write a homologation ────────────────────
create or replace function public.league_write_homologation(m public.team_matches, p_kind text, p_home int, p_away int,
                                                            p_loser uuid, p_role text, p_reason text)
returns public.team_match_homologations language plpgsql volatile security definer set search_path = public as $$
declare h public.team_match_homologations%rowtype; v_rev int; v_reg int;
begin
  select current_regulation_version into v_reg from public.competitions where id = m.competition_id;
  select coalesce(max(revision), 0) + 1 into v_rev from public.team_match_homologations where match_id = m.id;
  update public.team_match_homologations set status = 'superseded' where match_id = m.id and status = 'current';
  insert into public.team_match_homologations (match_id, revision, kind, home_score, away_score, winner_team_id, loser_team_id,
                                               event_seq, regulation_version, decided_by, decided_role, reason)
  values (m.id, v_rev, p_kind, p_home, p_away,
          case when p_kind = 'annulled' then null when p_home > p_away then m.home_team_id when p_away > p_home then m.away_team_id end,
          p_loser, m.seq, v_reg, public.my_player_id(), p_role, left(p_reason, 500))
  returning * into h;
  if p_kind = 'played' then
    insert into public.team_match_official_stats (homologation_id, player_id, team_id, appeared, goals, own_goals, assists,
                                                  yellows, second_yellows, reds)
    select h.id, x.player_id, x.team_id, bool_or(x.appeared), sum(x.goals), sum(x.own_goals), sum(x.assists),
           sum(x.yellows), sum(x.second_yellows), sum(x.reds)
      from (
        -- scorer / carded / subbed player (own goal: player is on the OTHER team)
        select e.player_id,
               case when e.type = 'own_goal' then case when e.team_id = m.home_team_id then m.away_team_id else m.home_team_id end
                    else e.team_id end as team_id,
               true as appeared,
               (e.type = 'goal')::int as goals, (e.type = 'own_goal')::int as own_goals, 0 as assists,
               (e.type = 'yellow')::int as yellows, (e.type = 'second_yellow')::int as second_yellows, (e.type = 'red')::int as reds
          from public.team_match_events_effective e
         where e.match_id = m.id and e.player_id is not null and e.type <> 'period'
        union all
        select e.assist_player_id, e.team_id, true, 0, 0, 1, 0, 0, 0
          from public.team_match_events_effective e where e.match_id = m.id and e.assist_player_id is not null
        union all
        select e.sub_in_player_id, e.team_id, true, 0, 0, 0, 0, 0, 0
          from public.team_match_events_effective e where e.match_id = m.id and e.type = 'sub' and e.sub_in_player_id is not null
        union all
        select l.player_id, l.team_id, true, 0, 0, 0, 0, 0, 0
          from public.team_match_lineup l where l.match_id = m.id
      ) x
     group by x.player_id, x.team_id;
  end if;
  return h;
end $$;

-- ── 4. RPCs: homologation ────────────────────────────────

-- homologate_match(match, expected_seq, reason) → {revision, kind, home_score, away_score}
-- The regulation's authority. Match finished/abandoned with a provisional,
-- submitted or homologated result (the last = re-homologation after a
-- correction; reason mandatory then). Score and stats come from the log.
create or replace function public.homologate_match(p_match_id uuid, p_expected_seq int, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_role text; v_h int; v_a int; h public.team_match_homologations%rowtype;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  v_role := public.league_can_homologate(m);
  if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
  if p_expected_seq is distinct from m.seq then raise exception 'league:stale_seq'; end if;
  if m.match_status not in ('finished','abandoned') or m.result_status not in ('provisional','submitted','homologated') then
    raise exception 'league:invalid_transition';
  end if;
  if m.result_status = 'homologated' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
    if not exists (select 1 from public.team_match_events e join public.team_match_homologations cur on cur.match_id = e.match_id and cur.status = 'current'
                    where e.match_id = m.id and e.seq > cur.event_seq) then
      raise exception 'league:nothing_to_rehomologate';
    end if;
  end if;
  select s.home, s.away into v_h, v_a from public.league_match_score(m.id) s;
  h := public.league_write_homologation(m, 'played', v_h, v_a, null, v_role, p_reason);
  update public.team_matches
     set official_home_score = v_h, official_away_score = v_a, result_status = 'homologated',
         result_confirmed_at = now(), seq = seq + 1, updated_at = now()
   where id = m.id;
  perform public.league_audit(public.competition_league(m.competition_id), 'match_homologated',
    jsonb_build_object('revision', h.revision, 'home', v_h, 'away', v_a, 'event_seq', h.event_seq, 'reason', p_reason),
    m.competition_id, m.id);
  return jsonb_build_object('revision', h.revision, 'kind', h.kind, 'home_score', v_h, 'away_score', v_a);
end $$;

-- record_walkover(match, absent_team, reason, expected_seq) → {revision, home_score, away_score}
-- Authority. Before the match is live (or abandoned). Score from
-- regulation.walkover; the absent team also gets walkover.loser_points
-- (≤ 0) in the table. No player stats are produced.
create or replace function public.record_walkover(p_match_id uuid, p_absent_team_id uuid, p_reason text, p_expected_seq int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_role text; r jsonb; v_h int; v_a int; h public.team_match_homologations%rowtype;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  v_role := public.league_can_homologate(m);
  if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
  if p_expected_seq is distinct from m.seq then raise exception 'league:stale_seq'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  if p_absent_team_id not in (m.home_team_id, m.away_team_id) then raise exception 'league:invalid_team'; end if;
  if m.match_status not in ('unscheduled','scheduled','postponed','abandoned') then raise exception 'league:invalid_transition'; end if;
  r := public.competition_rules(m.competition_id)->'walkover';
  if p_absent_team_id = m.home_team_id then v_h := (r->>'loser_score')::int; v_a := (r->>'winner_score')::int;
  else v_h := (r->>'winner_score')::int; v_a := (r->>'loser_score')::int; end if;
  h := public.league_write_homologation(m, 'walkover', v_h, v_a, p_absent_team_id, v_role, p_reason);
  update public.team_matches
     set match_status = case when match_status = 'abandoned' then 'abandoned' else 'finished' end,
         kickoff_at = coalesce(kickoff_at, now()),
         official_home_score = v_h, official_away_score = v_a, result_status = 'homologated', result_confirmed_at = now(),
         status_reason = left(p_reason, 500), seq = seq + 1, updated_at = now()
   where id = m.id;
  perform public.league_audit(public.competition_league(m.competition_id), 'match_walkover',
    jsonb_build_object('absent_team_id', p_absent_team_id, 'reason', p_reason), m.competition_id, m.id);
  return jsonb_build_object('revision', h.revision, 'home_score', v_h, 'away_score', v_a);
end $$;

-- abandon_match(match, reason, expected_seq) → {match_status}
-- Operator or authority, while live. The log is kept. Nothing counts until
-- decide_abandoned_match.
create or replace function public.abandon_match(p_match_id uuid, p_reason text, p_expected_seq int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  if public.league_operator_role(m) is null and public.league_can_homologate(m) is null then
    raise exception 'league:not_operator' using errcode = '42501';
  end if;
  if p_expected_seq is distinct from m.seq then raise exception 'league:stale_seq'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  if m.match_status <> 'live' then raise exception 'league:invalid_transition'; end if;
  update public.team_matches set match_status = 'abandoned', result_status = 'provisional', ended_at = now(),
         status_reason = left(p_reason, 500), seq = seq + 1, updated_at = now() where id = m.id;
  perform public.league_audit(public.competition_league(m.competition_id), 'match_abandoned',
    jsonb_build_object('reason', p_reason), m.competition_id, m.id);
  return jsonb_build_object('match_status', 'abandoned');
end $$;

-- decide_abandoned_match(match, decision, payload, reason, expected_seq) → {decision, …}
--   'keep_score' → homologate_match on the log as it stands
--   'award'      → payload {home_score, away_score}: kind 'awarded'
--   'annul'      → kind 'annulled' (does not count)
--   'replay'     → a NEW team_matches row (same round, replay_of_match_id),
--                  unscheduled; the abandoned one is annulled.
create or replace function public.decide_abandoned_match(p_match_id uuid, p_decision text, p_payload jsonb, p_reason text, p_expected_seq int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_role text; h public.team_match_homologations%rowtype; v_new uuid;
        v_h int; v_a int;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  v_role := public.league_can_homologate(m);
  if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
  if m.match_status <> 'abandoned' or m.result_status = 'homologated' then raise exception 'league:invalid_transition'; end if;
  if p_expected_seq is distinct from m.seq then raise exception 'league:stale_seq'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  if p_decision = 'keep_score' then
    return public.homologate_match(p_match_id, p_expected_seq, p_reason) || jsonb_build_object('decision', p_decision);
  elsif p_decision = 'award' then
    v_h := (p_payload->>'home_score')::int; v_a := (p_payload->>'away_score')::int;
    if v_h is null or v_a is null then raise exception 'league:invalid_score'; end if;
    h := public.league_write_homologation(m, 'awarded', v_h, v_a, null, v_role, p_reason);
  elsif p_decision in ('annul','replay') then
    h := public.league_write_homologation(m, 'annulled', null, null, null, v_role, p_reason);
    if p_decision = 'replay' then
      insert into public.team_matches (source_type, competition_id, phase_id, group_id, round_id, home_team_id, away_team_id,
                                       timezone, format, duration_min, currency, match_status, replay_of_match_id)
      values ('competition', m.competition_id, m.phase_id, m.group_id, m.round_id, m.home_team_id, m.away_team_id,
              m.timezone, m.format, m.duration_min, m.currency, 'unscheduled', m.id)
      returning id into v_new;
    end if;
  else
    raise exception 'league:invalid_decision';
  end if;
  update public.team_matches
     set official_home_score = v_h, official_away_score = v_a, result_status = 'homologated', result_confirmed_at = now(),
         seq = seq + 1, updated_at = now()
   where id = m.id;
  perform public.league_audit(public.competition_league(m.competition_id), 'abandoned_' || p_decision,
    jsonb_build_object('reason', p_reason, 'replay_match_id', v_new), m.competition_id, m.id);
  return jsonb_build_object('decision', p_decision, 'revision', h.revision, 'replay_match_id', v_new);
end $$;

-- ── 5. RPCs: disputes ────────────────────────────────────
-- open_dispute(match, reason, evidence) → {dispute_id, deadline_at}
-- A leader of either team. While submitted (in review), or within
-- regulation.dispute_window_hours after the current homologation.
-- The official result KEEPS counting while a dispute is open.
create or replace function public.open_dispute(p_match_id uuid, p_reason text, p_evidence jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_team uuid; h public.team_match_homologations%rowtype; v_deadline timestamptz; v_id uuid;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  v_team := case when public.is_team_leader(m.home_team_id) then m.home_team_id
                 when public.is_team_leader(m.away_team_id) then m.away_team_id end;
  if v_team is null then raise exception 'league:not_team_leader' using errcode = '42501'; end if;
  if m.result_status not in ('provisional','submitted','homologated') then raise exception 'league:nothing_to_dispute'; end if;
  select * into h from public.team_match_homologations where match_id = m.id and status = 'current';
  if found then
    v_deadline := h.created_at + make_interval(hours => (public.competition_rules(m.competition_id)->>'dispute_window_hours')::int);
    if now() > v_deadline then raise exception 'league:dispute_window_closed'; end if;
  end if;
  insert into public.team_match_disputes (match_id, homologation_revision, opened_by_team_id, opened_by_player_id, reason, evidence, deadline_at)
  values (m.id, h.revision, v_team, public.my_player_id(), btrim(p_reason), coalesce(p_evidence, '[]'::jsonb), v_deadline)
  returning id into v_id;
  perform public.league_audit(public.competition_league(m.competition_id), 'dispute_opened',
    jsonb_build_object('dispute_id', v_id, 'team_id', v_team), m.competition_id, m.id);
  return jsonb_build_object('dispute_id', v_id, 'deadline_at', v_deadline);
exception when unique_violation then raise exception 'league:dispute_already_open';
          when check_violation then raise exception 'league:invalid_dispute';
end $$;

-- decide_dispute(dispute, 'upheld'|'rejected'|'withdrawn', note) → {status}
-- upheld/rejected: the homologation authority, note mandatory. Upholding
-- does NOT change numbers by itself: the authority corrects the log
-- (record_match_event action correct/void, reason) and re-homologates.
-- withdrawn: a leader of the team that opened it.
create or replace function public.decide_dispute(p_dispute_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d public.team_match_disputes%rowtype; m public.team_matches%rowtype; v_role text;
begin
  perform public.league_rpc_begin();
  select * into d from public.team_match_disputes where id = p_dispute_id for update;
  if not found then raise exception 'league:dispute_not_found'; end if;
  select * into m from public.team_matches where id = d.match_id;
  if d.status <> 'open' then return jsonb_build_object('status', d.status, 'unchanged', true); end if;
  if p_decision = 'withdrawn' then
    if not public.is_team_leader(d.opened_by_team_id) then raise exception 'league:not_allowed' using errcode = '42501'; end if;
    v_role := 'team_leader';
  elsif p_decision in ('upheld','rejected') then
    v_role := public.league_can_homologate(m);
    if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'league:reason_required'; end if;
  else
    raise exception 'league:invalid_decision';
  end if;
  update public.team_match_disputes set status = p_decision, decided_by = public.my_player_id(), decided_role = v_role,
         decision_note = left(p_note, 1000), decided_at = now() where id = d.id;
  perform public.league_audit(public.competition_league(m.competition_id), 'dispute_' || p_decision,
    jsonb_build_object('dispute_id', d.id, 'note', p_note), m.competition_id, m.id);
  return jsonb_build_object('status', p_decision);
end $$;

-- ── 6. RPCs: point adjustments ───────────────────────────
create or replace function public.adjust_points(p_competition_id uuid, p_team_id uuid, p_points int, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_manager(public.competition_league(p_competition_id), p_competition_id) then raise exception 'league:not_found'; end if;
  if not exists (select 1 from public.competition_teams where competition_id = p_competition_id and team_id = p_team_id and status = 'homologated') then
    raise exception 'league:team_not_registered';
  end if;
  insert into public.competition_point_adjustments (competition_id, team_id, points, reason, decided_by)
  values (p_competition_id, p_team_id, p_points, btrim(p_reason), public.my_player_id()) returning id into v_id;
  perform public.league_audit(public.competition_league(p_competition_id), 'points_adjusted',
    jsonb_build_object('team_id', p_team_id, 'points', p_points, 'reason', p_reason), p_competition_id);
  return jsonb_build_object('adjustment_id', v_id);
exception when check_violation then raise exception 'league:invalid_adjustment';
end $$;

create or replace function public.revoke_point_adjustment(p_adjustment_id uuid, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a public.competition_point_adjustments%rowtype;
begin
  select * into a from public.competition_point_adjustments where id = p_adjustment_id for update;
  if not found or not public.is_league_manager(public.competition_league(a.competition_id), a.competition_id) then raise exception 'league:not_found'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  if a.revoked_at is not null then return jsonb_build_object('revoked', true, 'unchanged', true); end if;
  update public.competition_point_adjustments set revoked_at = now(), revoked_by = public.my_player_id(), revoke_reason = left(p_reason, 500)
   where id = a.id;
  perform public.league_audit(public.competition_league(a.competition_id), 'points_adjustment_revoked',
    jsonb_build_object('adjustment_id', a.id, 'reason', p_reason), a.competition_id);
  return jsonb_build_object('revoked', true);
end $$;

-- ── 7. Standings ─────────────────────────────────────────
-- Internal: per-team rows of the current homologations of a competition.
create or replace function public.league_team_results(p_competition_id uuid)
returns table (match_id uuid, team_id uuid, opp_id uuid, gf int, ga int, kind text, absent boolean)
language sql stable security definer set search_path = public as $$
  select m.id, t.team_id, t.opp_id,
         case when t.is_home then h.home_score else h.away_score end,
         case when t.is_home then h.away_score else h.home_score end,
         h.kind, h.loser_team_id = t.team_id
    from public.team_matches m
    join public.team_match_homologations h on h.match_id = m.id and h.status = 'current' and h.kind <> 'annulled'
    cross join lateral (values (m.home_team_id, m.away_team_id, true), (m.away_team_id, m.home_team_id, false)) t(team_id, opp_id, is_home)
   where m.competition_id = p_competition_id and m.source_type = 'competition';
$$;

-- competition_standings(competition, key) → {rows:[…], regulation_version, tiebreakers, notes[]}
-- Official table: homologated results only (provisional ones never enter;
-- a labelled live preview is a client concern). Sort keys come from the
-- published regulation (validated allow-list, so the dynamic ORDER BY is
-- built from constants only). Teams still level on every key share the
-- rank and get tie_unresolved = true (no silent coin toss).
create or replace function public.competition_standings(p_competition_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text; r jsonb;
  v_order text := ''; v_part text := ''; t text; v_rows jsonb;
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
  r := public.competition_rules(v_c.id);
  if r is null then return jsonb_build_object('rows', '[]'::jsonb, 'regulation_version', null); end if;
  for t in select jsonb_array_elements_text(r->'tiebreakers') loop
    v_order := v_order || case t when 'pts' then 'pts desc, ' when 'h2h' then 'h2h desc, ' when 'gd' then 'gd desc, '
                                 when 'gf' then 'gf desc, ' when 'wins' then 'w desc, ' when 'ga_fewest' then 'ga asc, ' end;
    v_part  := v_part  || case t when 'pts' then 'pts, ' when 'h2h' then 'h2h, ' when 'gd' then 'gd, '
                                 when 'gf' then 'gf, ' when 'wins' then 'w, ' when 'ga_fewest' then 'ga, ' end;
  end loop;
  v_order := left(v_order, length(v_order) - 2);
  v_part  := left(v_part, length(v_part) - 2);

  execute format($q$
    with teams as (
      select ct.team_id, coalesce(ct.registered_name, tm.name) as name, tm.slug, coalesce(ct.registered_logo_url, tm.logo_url) as logo_url
        from public.competition_teams ct join public.teams tm on tm.id = ct.team_id
       where ct.competition_id = $1 and ct.status = 'homologated'),
    res as (select * from public.league_team_results($1)),
    base as (
      select t.team_id, t.name, t.slug, t.logo_url,
             count(r.match_id)::int as j,
             count(*) filter (where r.gf > r.ga)::int as w,
             count(*) filter (where r.gf = r.ga)::int as d,
             count(*) filter (where r.gf < r.ga)::int as l,
             coalesce(sum(r.gf), 0)::int as gf, coalesce(sum(r.ga), 0)::int as ga,
             count(*) filter (where r.absent)::int as wo_losses,
             coalesce((select sum(a.points) from public.competition_point_adjustments a
                        where a.competition_id = $1 and a.team_id = t.team_id and a.revoked_at is null), 0)::int as adj
        from teams t left join res r on r.team_id = t.team_id
       group by t.team_id, t.name, t.slug, t.logo_url),
    pts as (
      select b.*, b.gf - b.ga as gd,
             b.w * ($2#>>'{points,win}')::int + b.d * ($2#>>'{points,draw}')::int + b.l * ($2#>>'{points,loss}')::int
             + b.wo_losses * ($2#>>'{walkover,loser_points}')::int + b.adj as pts
        from base b),
    h2h as (
      -- points earned only against teams level on points (one pass).
      select p.*, coalesce((
               select sum(case when r.gf > r.ga then ($2#>>'{points,win}')::int when r.gf = r.ga then ($2#>>'{points,draw}')::int
                               else ($2#>>'{points,loss}')::int end)
                 from res r join pts o on o.team_id = r.opp_id
                where r.team_id = p.team_id and o.pts = p.pts), 0)::int as h2h
        from pts p)
    select coalesce(jsonb_agg(to_jsonb(x) order by x.rank, x.name), '[]'::jsonb) from (
      select h.team_id, h.name, h.slug, h.logo_url, h.j, h.w, h.d, h.l, h.gf, h.ga, h.gd, h.pts, h.adj as adjustments,
             h.h2h, rank() over (order by %1$s)::int as rank,
             (count(*) over (partition by %2$s) > 1) as tie_unresolved
        from h2h h) x
  $q$, v_order, v_part) into v_rows using v_c.id, r;

  return jsonb_build_object(
    'rows', v_rows, 'regulation_version', v_c.current_regulation_version, 'tiebreakers', r->'tiebreakers', 'points', r->'points',
    'pending', (select count(*) from public.team_matches m where m.competition_id = v_c.id
                  and m.result_status in ('provisional','submitted')),
    'adjustments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'team_id', a.team_id, 'points', a.points, 'reason', a.reason, 'created_at', a.created_at))
                               from public.competition_point_adjustments a where a.competition_id = v_c.id and a.revoked_at is null), '[]'::jsonb));
end $$;

-- competition_player_stats(competition, key) → {items:[{player_id, name, team_id, apps, goals, assists, own_goals, yellows, reds}]}
-- From the CURRENT homologated snapshots only. Youth category → initials.
create or replace function public.competition_player_stats(p_competition_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text; v_youth boolean;
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
             'player_id', s.player_id,
             'name', case when v_youth then upper(left(p.name, 1)) || '.' else public.league_person_name(s.player_id) end,
             'photo_url', case when v_youth then null else p.photo_url end,
             'team_id', s.team_id, 'apps', s.apps, 'goals', s.goals, 'assists', s.assists,
             'own_goals', s.own_goals, 'yellows', s.yellows, 'reds', s.reds)
           order by s.goals desc, s.assists desc, s.apps)
      from (select st.player_id, st.team_id, count(*) filter (where st.appeared)::int as apps,
                   sum(st.goals)::int as goals, sum(st.assists)::int as assists, sum(st.own_goals)::int as own_goals,
                   sum(st.yellows + st.second_yellows)::int as yellows, sum(st.reds)::int as reds
              from public.team_match_official_stats st
              join public.team_match_homologations h on h.id = st.homologation_id and h.status = 'current'
              join public.team_matches m on m.id = h.match_id
             where m.competition_id = v_c.id
             group by st.player_id, st.team_id) s
      join public.players p on p.id = s.player_id), '[]'::jsonb));
end $$;

-- ── 8. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.homologate_match(uuid, int, text)', 'public.record_walkover(uuid, uuid, text, int)',
    'public.abandon_match(uuid, text, int)', 'public.decide_abandoned_match(uuid, text, jsonb, text, int)',
    'public.open_dispute(uuid, text, jsonb)', 'public.decide_dispute(uuid, text, text)',
    'public.adjust_points(uuid, uuid, int, text)', 'public.revoke_point_adjustment(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.competition_standings(uuid, text)', 'public.competition_player_stats(uuid, text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.league_write_homologation(public.team_matches, text, int, int, uuid, text, text)',
    'public.league_team_results(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── 9. Integration additions ─────────────────────────────
-- competition_rankings(competition, kind, key, limit) → {kind, items:[{rank, player_id, name, photo_url, team_id, team_name, value, apps, goals, assists, yellows, reds}]} | null
-- Public (same visibility + youth rule as competition_player_stats, which
-- it reuses). kind: 'goals' (Artilharia) | 'assists' | 'cards' (reds
-- first, then yellows; value = yellows + reds) | 'apps'. Zero rows are
-- left out. Ties share the rank (rank()).
create or replace function public.competition_rankings(p_competition_id uuid, p_kind text default 'goals', p_key text default null,
                                                       p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_stats jsonb; v_kind text := coalesce(p_kind, 'goals');
begin
  if v_kind not in ('goals','assists','cards','apps') then raise exception 'league:invalid_ranking'; end if;
  v_stats := public.competition_player_stats(p_competition_id, p_key);
  if v_stats is null then return null; end if;
  return jsonb_build_object('kind', v_kind, 'items', coalesce((
    select jsonb_agg(x.j || jsonb_build_object('rank', x.rk, 'value', x.v,
                     'team_name', (select coalesce(ct.registered_name, t.name) from public.teams t
                                     left join public.competition_teams ct on ct.team_id = t.id and ct.competition_id = p_competition_id
                                    where t.id = (x.j->>'team_id')::uuid))
                     order by x.rk, x.j->>'name')
      from (select s.j, s.v, rank() over (order by s.v desc, s.k2 desc)::int as rk
              from (select i as j,
                           case v_kind when 'goals' then (i->>'goals')::int when 'assists' then (i->>'assists')::int
                                       when 'cards' then (i->>'yellows')::int + (i->>'reds')::int else (i->>'apps')::int end as v,
                           case v_kind when 'cards' then (i->>'reds')::int else 0 end as k2
                      from jsonb_array_elements(v_stats->'items') i) s
             where s.v > 0
             order by s.v desc, s.k2 desc
             limit greatest(1, least(coalesce(p_limit, 20), 200))) x), '[]'::jsonb));
end $$;

-- competition_disputes(competition, status|null) → {items:[…], is_authority}
-- Competition staff see every dispute (the authority's inbox); a member of
-- a registered team sees only disputes on its own matches. Never public.
create or replace function public.competition_disputes(p_competition_id uuid, p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_staff boolean;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found or public.my_player_id() is null and not public.is_admin() then raise exception 'league:not_found'; end if;
  v_staff := public.is_competition_staff(v_c.id);
  if not v_staff and not public.is_competition_participant(v_c.id) then raise exception 'league:not_found'; end if;
  return jsonb_build_object('is_staff', v_staff, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'match_id', d.match_id, 'round', r.number,
             'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id,
             'opened_by_team_id', d.opened_by_team_id, 'opened_by', public.league_person_name(d.opened_by_player_id),
             'homologation_revision', d.homologation_revision, 'reason', d.reason, 'evidence', d.evidence,
             'status', d.status, 'deadline_at', d.deadline_at, 'decision_note', d.decision_note,
             'decided_role', d.decided_role, 'decided_at', d.decided_at, 'created_at', d.created_at,
             'can_decide', d.status = 'open' and public.league_can_homologate(m) is not null)
           order by d.created_at desc)
      from public.team_match_disputes d
      join public.team_matches m on m.id = d.match_id and m.source_type = 'competition'
      left join public.competition_rounds r on r.id = m.round_id
     where m.competition_id = v_c.id and (p_status is null or d.status = p_status)
       and (v_staff or public.is_team_member(m.home_team_id) or public.is_team_member(m.away_team_id))), '[]'::jsonb));
end $$;

do $$
begin
  execute 'revoke execute on function public.competition_rankings(uuid, text, text, int) from public';
  execute 'grant execute on function public.competition_rankings(uuid, text, text, int) to anon, authenticated, service_role';
  execute 'revoke execute on function public.competition_disputes(uuid, text) from public, anon';
  execute 'grant execute on function public.competition_disputes(uuid, text) to authenticated, service_role';
  execute 'revoke execute on function public.league_snapshot_immutable() from public, anon, authenticated';
end $$;

-- ── Comments ─────────────────────────────────────────────
comment on table public.team_match_homologations is 'PITCH Ligas: revisioned, write-once homologations (played|walkover|awarded|annulled). One current per match. Written only by league RPCs.';
comment on table public.team_match_official_stats is 'PITCH Ligas: official per-player stats snapshot of a homologation revision (derived from the event log; write-once).';
comment on table public.team_match_disputes is 'PITCH Ligas: disputes opened by a team leader (reason + evidence); decided by the homologation authority. Staff + the two teams only.';
comment on table public.competition_point_adjustments is 'PITCH Ligas: audited point deductions/bonuses (never an edit of a total). Revocable, row kept.';
