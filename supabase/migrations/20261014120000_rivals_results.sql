-- ─────────────────────────────────────────────────────────
-- Migration — PITCH Rivals (3/3): results, RSVP, lineup, player stats,
-- derived team metrics, rematch
--
-- Contract: docs/RIVALS-RESULTS-CONTRACT.md (RPC names / args / return
-- shapes / error codes). Plan: docs/RIVALS-PLAN.md §2 "007200_rivals_results"
-- + §3 "Results". Spec: docs/TEAMS-CHALLENGES-SPEC.md (owner decisions
-- block wins; 2026-10-13 decisions 10a–e are in scope).
--
-- What this does
--   • team_match_results        immutable-ish revision log of the score of a
--                               team match: report → (confirm | contest →
--                               counter → …) and, after confirmation,
--                               correction proposals. At most ONE open
--                               ('proposed') and ONE 'confirmed' revision per
--                               match (partial unique indexes).
--   • team_match_availability   the team's RSVP ("convocatória"); readable by
--                               the members of that team only.
--   • team_match_lineup         who played, per team (appearances).
--   • team_match_player_stats   goals / assists per player (post-game
--                               steppers; informational until the result is
--                               CONFIRMED, only confirmed matches feed metrics).
--   • RLS: read-only policies, NO write policies, NO direct writes — every
--     transition is a SECURITY DEFINER RPC that locks the match row
--     (select … for update), validates, and writes an audit row.
--   • A result is NEVER auto-confirmed (no timer, no silence = yes). The
--     official score on team_matches is written in the same transaction as
--     the confirmation. expire_rivals() (007100) never touches results.
--   • Metrics are DERIVED, never stored: team_record / form / streak /
--     head-to-head / player stats read ONLY matches whose result_status is
--     'confirmed'. Cancelled / not-played matches never count as losses;
--     provisional (reported / disputed-first-time) results are excluded.
--   • Extended: my_challenges() (match gains result / RSVP / lineup keys),
--     team_profile(slug) (record + form; top scorers when signed in),
--     list_teams() (real record + form instead of the 007000 placeholders).
--   • create_rematch(): a directed challenge to the other team linked to a
--     played + confirmed match (team_challenges.rematch_of_match_id).
--
-- Never touches games / attendances / matchdays (option B). The policy
-- fingerprint of those tables is recorded again in rivals_audit_log
-- ('migration_baseline:20261014120000') before anything else runs.
--
-- Errors: 'rivals:<code>' (src/lib/rivalsCopy.js maps them to copy).
-- Idempotent: safe to re-run (if not exists / create or replace / guarded
-- constraints, policies, publications).
-- ─────────────────────────────────────────────────────────

-- ── 0. Regression baseline (first run only) ──────────────
insert into public.rivals_audit_log (action, payload)
select 'migration_baseline:20261014120000', jsonb_build_object(
  'group_policies_md5', (
    select md5(coalesce(string_agg(
      format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
             coalesce(qual, ''), coalesce(with_check, '')),
      E'\n' order by tablename, policyname), ''))
    from pg_policies
    where schemaname = 'public' and tablename in ('games', 'attendances', 'matchdays')
  ))
where not exists (select 1 from public.rivals_audit_log where action = 'migration_baseline:20261014120000');

-- ── 1. Tables ────────────────────────────────────────────

-- 1a. Result revisions. Revision numbers are per match and never reused
-- (a withdrawn report leaves a hole in the history, the next one is n+1).
create table if not exists public.team_match_results (
  id                     uuid primary key default gen_random_uuid(),
  match_id               uuid not null references public.team_matches(id) on delete cascade,
  revision               int  not null check (revision >= 1),
  kind                   text not null check (kind in ('report','counter','correction')),
  home_score             int  not null check (home_score between 0 and 99),
  away_score             int  not null check (away_score between 0 and 99),
  reported_by_team_id    uuid not null references public.teams(id) on delete cascade,
  reported_by_player_id  uuid references public.players(id) on delete set null,
  status                 text not null default 'proposed'
                           check (status in ('proposed','confirmed','disputed','superseded','withdrawn')),
  responded_by_player_id uuid references public.players(id) on delete set null,
  responded_at           timestamptz,
  note                   text check (note is null or char_length(note) <= 280),
  created_at             timestamptz not null default now(),
  constraint team_match_results_match_revision_key unique (match_id, revision)
);
-- At most one open proposal and one confirmed revision per match.
create unique index if not exists team_match_results_one_proposed_key
  on public.team_match_results (match_id) where status = 'proposed';
create unique index if not exists team_match_results_one_confirmed_key
  on public.team_match_results (match_id) where status = 'confirmed';

-- 1b. RSVP (convocatória). team_id = the team the player answered for.
create table if not exists public.team_match_availability (
  match_id    uuid not null references public.team_matches(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  status      text not null check (status in ('yes','no','maybe')),
  updated_at  timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists team_match_availability_team_idx on public.team_match_availability (match_id, team_id);

-- 1c. Lineup (who played for each team).
create table if not exists public.team_match_lineup (
  match_id           uuid not null references public.team_matches(id) on delete cascade,
  player_id          uuid not null references public.players(id) on delete cascade,
  team_id            uuid not null references public.teams(id) on delete cascade,
  set_by_player_id   uuid references public.players(id) on delete set null,
  set_at             timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists team_match_lineup_team_idx   on public.team_match_lineup (team_id, player_id);
create index if not exists team_match_lineup_match_idx  on public.team_match_lineup (match_id, team_id);

-- 1d. Goals / assists per player.
create table if not exists public.team_match_player_stats (
  match_id           uuid not null references public.team_matches(id) on delete cascade,
  player_id          uuid not null references public.players(id) on delete cascade,
  team_id            uuid not null references public.teams(id) on delete cascade,
  goals              int  not null default 0 check (goals between 0 and 30),
  assists            int  not null default 0 check (assists between 0 and 30),
  set_by_player_id   uuid references public.players(id) on delete set null,
  set_at             timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index if not exists team_match_player_stats_team_idx  on public.team_match_player_stats (team_id, player_id);
create index if not exists team_match_player_stats_match_idx on public.team_match_player_stats (match_id, team_id);

-- 1e. A confirmed match always carries its official score + revision.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_matches_confirmed_has_score') then
    alter table public.team_matches add constraint team_matches_confirmed_has_score
      check (result_status <> 'confirmed'
             or (official_home_score is not null and official_away_score is not null and confirmed_revision is not null));
  end if;
end $$;

-- ── 2. Helpers ───────────────────────────────────────────
-- Can the caller see this match? (member of either team, or admin)
create or replace function public.can_see_match(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.team_matches m
     where m.id = mid and (public.is_team_member(m.home_team_id) or public.is_team_member(m.away_team_id)));
$$;

-- Internal: the team of the match the caller LEADS (home first), or null.
create or replace function public.rivals_leader_team(m public.team_matches)
returns uuid language sql stable security definer set search_path = public as $$
  select case when public.is_team_leader(m.home_team_id) then m.home_team_id
              when public.is_team_leader(m.away_team_id) then m.away_team_id end;
$$;

-- Internal: the team of the match the caller is an ACTIVE MEMBER of (home first), or null.
create or replace function public.rivals_member_team(m public.team_matches)
returns uuid language sql stable security definer set search_path = public as $$
  select case when public.is_team_member(m.home_team_id) then m.home_team_id
              when public.is_team_member(m.away_team_id) then m.away_team_id end;
$$;

-- Internal: 0..99 scores or rivals:invalid_score.
create or replace function public.rivals_check_scores(p_home int, p_away int)
returns void language plpgsql immutable set search_path = public as $$
begin
  if p_home is null or p_away is null or p_home not between 0 and 99 or p_away not between 0 and 99 then
    raise exception 'rivals:invalid_score';
  end if;
end $$;

-- Internal: trimmed note (null when blank) or rivals:note_too_long.
create or replace function public.rivals_clean_note(p_note text)
returns text language plpgsql immutable set search_path = public as $$
declare s text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if char_length(coalesce(s, '')) > 280 then raise exception 'rivals:note_too_long'; end if;
  return s;
end $$;

-- Internal: the `result` object of the contract.
create or replace function public.rivals_result_json(r public.team_match_results)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'match_id', r.match_id, 'revision', r.revision, 'kind', r.kind, 'status', r.status,
    'home_score', r.home_score, 'away_score', r.away_score,
    'reported_by_team_id', r.reported_by_team_id, 'reported_by_player_id', r.reported_by_player_id,
    'note', r.note, 'created_at', r.created_at, 'responded_at', r.responded_at);
$$;

-- Internal: small match summary returned next to a result (additive key `match`).
create or replace function public.rivals_match_summary(m public.team_matches)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', m.id, 'match_status', m.match_status, 'result_status', m.result_status,
    'official_home_score', m.official_home_score, 'official_away_score', m.official_away_score,
    'confirmed_revision', m.confirmed_revision, 'result_confirmed_at', m.result_confirmed_at);
$$;

-- Internal: who answers an open proposal. The answering team is the OTHER
-- team than the proposer's; the proposer's own leaders get rivals:own_proposal
-- (so does a player who leads both teams and proposed it himself).
create or replace function public.rivals_answering_team(m public.team_matches, r public.team_match_results)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_other uuid := case when r.reported_by_team_id = m.home_team_id then m.away_team_id else m.home_team_id end;
begin
  if not public.is_team_leader(v_other) then
    if public.is_team_leader(r.reported_by_team_id) then
      raise exception 'rivals:own_proposal' using errcode = '42501';
    end if;
    raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;
  if r.reported_by_player_id is not distinct from public.my_player_id() then
    raise exception 'rivals:own_proposal' using errcode = '42501';
  end if;
  return v_other;
end $$;

-- Internal: the extra keys my_challenges() adds to `match` (caller = p_pid).
create or replace function public.rivals_match_extras(m public.team_matches, p_pid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_team   uuid;
  v_open   public.team_match_results%rowtype;
  v_counts jsonb;
begin
  v_team := case
    when exists (select 1 from public.team_members tm where tm.team_id = m.home_team_id and tm.player_id = p_pid and tm.status = 'active') then m.home_team_id
    when exists (select 1 from public.team_members tm where tm.team_id = m.away_team_id and tm.player_id = p_pid and tm.status = 'active') then m.away_team_id
    else null end;
  select * into v_open from public.team_match_results where match_id = m.id and status = 'proposed';

  select jsonb_build_object(
           'yes',     count(*) filter (where a.status = 'yes'),
           'no',      count(*) filter (where a.status = 'no'),
           'maybe',   count(*) filter (where a.status = 'maybe'),
           'pending', count(*) filter (where a.status is null))
    into v_counts
    from public.team_members tm
    left join public.team_match_availability a on a.match_id = m.id and a.player_id = tm.player_id
   where tm.team_id = v_team and tm.status = 'active';

  return jsonb_build_object(
    'result', jsonb_build_object(
      'status', m.result_status,
      'official_home_score', m.official_home_score,
      'official_away_score', m.official_away_score,
      'open_revision', case when v_open.id is null then null else public.rivals_result_json(v_open) end,
      'revisions_count', (select count(*) from public.team_match_results r where r.match_id = m.id)),
    'my_availability', (select a.status from public.team_match_availability a where a.match_id = m.id and a.player_id = p_pid),
    'availability_counts', coalesce(v_counts, jsonb_build_object('yes', 0, 'no', 0, 'maybe', 0, 'pending', 0)),
    'lineup_count', (select count(*) from public.team_match_lineup l where l.match_id = m.id and l.team_id = v_team),
    'stats_recorded', exists (select 1 from public.team_match_player_stats s where s.match_id = m.id and s.team_id = v_team));
end $$;

-- ── 3. RLS: read-only ────────────────────────────────────
alter table public.team_match_results       enable row level security;
alter table public.team_match_availability  enable row level security;
alter table public.team_match_lineup        enable row level security;
alter table public.team_match_player_stats  enable row level security;

drop policy if exists "team_match_results select" on public.team_match_results;
create policy "team_match_results select" on public.team_match_results for select to authenticated
  using (public.can_see_match(match_id));

-- The RSVP is the team's own business: the opponent never reads it.
drop policy if exists "team_match_availability select" on public.team_match_availability;
create policy "team_match_availability select" on public.team_match_availability for select to authenticated
  using (public.is_team_member(team_id) or public.is_admin());

-- Lineups: own team directly; the opponent's only through get_match_lineup()
-- once the match is played.
drop policy if exists "team_match_lineup select" on public.team_match_lineup;
create policy "team_match_lineup select" on public.team_match_lineup for select to authenticated
  using (public.is_team_member(team_id) or public.is_admin());

drop policy if exists "team_match_player_stats select" on public.team_match_player_stats;
create policy "team_match_player_stats select" on public.team_match_player_stats for select to authenticated
  using (public.can_see_match(match_id));

-- ── 4. Table grants (explicit — CLAUDE.md, Oct 30 2026 change) ──
revoke all on table public.team_match_results       from anon, authenticated;
revoke all on table public.team_match_availability  from anon, authenticated;
revoke all on table public.team_match_lineup        from anon, authenticated;
revoke all on table public.team_match_player_stats  from anon, authenticated;
grant  select on table public.team_match_results       to authenticated;
grant  select on table public.team_match_availability  to authenticated;
grant  select on table public.team_match_lineup        to authenticated;
grant  select on table public.team_match_player_stats  to authenticated;
grant  all    on table public.team_match_results       to service_role;
grant  all    on table public.team_match_availability  to service_role;
grant  all    on table public.team_match_lineup        to service_role;
grant  all    on table public.team_match_player_stats  to service_role;

do $$ begin alter publication supabase_realtime add table public.team_match_results;      exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.team_match_availability; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.team_match_lineup;       exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.team_match_player_stats; exception when others then null; end $$;

-- ── 5. Mutation RPCs ─────────────────────────────────────

-- set_match_availability(match, 'yes'|'no'|'maybe') → {match_id, team_id, status}
-- Any ACTIVE member of either team, match still scheduled, before kickoff.
-- Upsert of the caller's own answer only.
create or replace function public.set_match_availability(p_match_id uuid, p_status text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  m      public.team_matches%rowtype;
  v_team uuid;
  v_old  text;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('yes','no','maybe') then raise exception 'rivals:invalid_status'; end if;
  -- FOR SHARE: concurrent RSVPs do not serialise, but a cancel / kickoff
  -- change (FOR UPDATE) cannot interleave.
  select * into m from public.team_matches where id = p_match_id for share;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_member_team(m);
  if v_team is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  if m.kickoff_at <= now() then raise exception 'rivals:too_late'; end if;

  select status into v_old from public.team_match_availability where match_id = m.id and player_id = v_pid;
  insert into public.team_match_availability (match_id, player_id, team_id, status, updated_at)
  values (m.id, v_pid, v_team, p_status, now())
  on conflict (match_id, player_id) do update
    set status = excluded.status, team_id = excluded.team_id, updated_at = now();
  if v_old is distinct from p_status then
    perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'availability_set',
      jsonb_build_object('player_id', v_pid, 'from', v_old, 'to', p_status));
  end if;
  return jsonb_build_object('match_id', m.id, 'team_id', v_team, 'status', p_status);
end $$;

-- set_match_lineup(match, player_ids[]) → {match_id, team_id, count, stats_removed}
-- A leader of a team in the match; match scheduled or played; ≤ 22 distinct
-- ids, all ACTIVE members of THAT team. Replaces that team's lineup. Stats
-- rows of that team for players who are no longer in a non-empty lineup are
-- dropped (so a scorer is always a lineup player).
create or replace function public.set_match_lineup(p_match_id uuid, p_player_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid     uuid := public.my_player_id();
  m         public.team_matches%rowtype;
  v_team    uuid;
  v_n       int;
  v_removed int := 0;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_leader_team(m);
  if v_team is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  if m.match_status not in ('scheduled','played') then raise exception 'rivals:match_not_scheduled'; end if;

  if p_player_ids is null then raise exception 'rivals:invalid_lineup'; end if;
  v_n := coalesce(cardinality(p_player_ids), 0);
  if v_n > 22 then raise exception 'rivals:invalid_lineup'; end if;
  if exists (select 1 from unnest(p_player_ids) as u(pid) where u.pid is null) then raise exception 'rivals:invalid_lineup'; end if;
  if (select count(distinct u.pid) from unnest(p_player_ids) as u(pid)) <> v_n then raise exception 'rivals:invalid_lineup'; end if;
  if exists (
    select 1 from unnest(p_player_ids) as u(pid)
     where not exists (select 1 from public.team_members tm
                        where tm.team_id = v_team and tm.player_id = u.pid and tm.status = 'active')) then
    raise exception 'rivals:invalid_lineup';
  end if;

  delete from public.team_match_lineup where match_id = m.id and team_id = v_team;
  insert into public.team_match_lineup (match_id, player_id, team_id, set_by_player_id)
  select m.id, u.pid, v_team, v_pid from unnest(p_player_ids) as u(pid);
  if v_n > 0 then
    delete from public.team_match_player_stats
     where match_id = m.id and team_id = v_team and not (player_id = any (p_player_ids));
    get diagnostics v_removed = row_count;
  end if;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'lineup_set',
    jsonb_build_object('count', v_n, 'stats_removed', v_removed));
  return jsonb_build_object('match_id', m.id, 'team_id', v_team, 'count', v_n, 'stats_removed', v_removed);
end $$;

-- set_match_player_stats(match, [{player_id, goals, assists}]) → {match_id, team_id, count}
-- A leader, after kickoff, match scheduled or played. Players must be in the
-- team's lineup (or active members when no lineup was set). goals/assists
-- 0..30, ≤ 22 entries, no duplicates. Replaces the team's rows.
create or replace function public.set_match_player_stats(p_match_id uuid, p_stats jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid      uuid := public.my_player_id();
  m          public.team_matches%rowtype;
  v_team     uuid;
  v_has_lu   boolean;
  e          jsonb;
  v_player   uuid;
  v_goals    int;
  v_assists  int;
  v_seen     uuid[] := '{}';
  v_n        int := 0;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_leader_team(m);
  if v_team is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  if m.match_status not in ('scheduled','played') then raise exception 'rivals:match_not_scheduled'; end if;
  if m.kickoff_at > now() then raise exception 'rivals:too_early'; end if;

  if p_stats is null or jsonb_typeof(p_stats) <> 'array' or jsonb_array_length(p_stats) > 22 then
    raise exception 'rivals:invalid_stats';
  end if;
  v_has_lu := exists (select 1 from public.team_match_lineup l where l.match_id = m.id and l.team_id = v_team);

  for e in select x from jsonb_array_elements(p_stats) as t(x) loop
    if jsonb_typeof(e) <> 'object' then raise exception 'rivals:invalid_stats'; end if;
    begin
      v_player  := (e->>'player_id')::uuid;
      v_goals   := coalesce((e->>'goals')::int, 0);
      v_assists := coalesce((e->>'assists')::int, 0);
    exception when others then
      raise exception 'rivals:invalid_stats';
    end;
    if v_player is null or v_goals not between 0 and 30 or v_assists not between 0 and 30 then
      raise exception 'rivals:invalid_stats';
    end if;
    if v_player = any (v_seen) then raise exception 'rivals:invalid_stats'; end if;
    v_seen := v_seen || v_player;
    if v_has_lu then
      if not exists (select 1 from public.team_match_lineup l where l.match_id = m.id and l.team_id = v_team and l.player_id = v_player) then
        raise exception 'rivals:invalid_stats';
      end if;
    elsif not exists (select 1 from public.team_members tm where tm.team_id = v_team and tm.player_id = v_player and tm.status = 'active') then
      raise exception 'rivals:invalid_stats';
    end if;
    v_n := v_n + 1;
  end loop;

  delete from public.team_match_player_stats where match_id = m.id and team_id = v_team;
  insert into public.team_match_player_stats (match_id, player_id, team_id, goals, assists, set_by_player_id)
  select m.id, (x->>'player_id')::uuid, v_team, coalesce((x->>'goals')::int, 0), coalesce((x->>'assists')::int, 0), v_pid
    from jsonb_array_elements(p_stats) as t(x);
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'stats_set', jsonb_build_object('count', v_n));
  return jsonb_build_object('match_id', m.id, 'team_id', v_team, 'count', v_n);
end $$;

-- report_match_result(match, home, away, note) → result object (+ match)
-- A leader of either team, after kickoff, match scheduled, no result yet.
-- Revision 1 'report' / 'proposed'; result_status 'reported' (provisional).
create or replace function public.report_match_result(p_match_id uuid, p_home_score int, p_away_score int,
                                                      p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  m      public.team_matches%rowtype;
  r      public.team_match_results%rowtype;
  v_team uuid;
  v_note text;
  v_rev  int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_leader_team(m);
  if v_team is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  perform public.rivals_check_scores(p_home_score, p_away_score);
  v_note := public.rivals_clean_note(p_note);
  if m.result_status <> 'none' then raise exception 'rivals:result_exists'; end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  if m.kickoff_at > now() then raise exception 'rivals:too_early'; end if;

  select coalesce(max(revision), 0) + 1 into v_rev from public.team_match_results where match_id = m.id;
  if v_rev > 30 then raise exception 'rivals:needs_help'; end if;
  insert into public.team_match_results (match_id, revision, kind, home_score, away_score,
                                         reported_by_team_id, reported_by_player_id, status, note)
  values (m.id, v_rev, 'report', p_home_score, p_away_score, v_team, v_pid, 'proposed', v_note)
  returning * into r;
  update public.team_matches set result_status = 'reported', updated_at = now() where id = m.id returning * into m;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'result_reported',
    jsonb_build_object('revision', v_rev, 'home_score', p_home_score, 'away_score', p_away_score));
  return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m));
end $$;

-- confirm_match_result(match, revision) → result object (+ match)
-- A leader of the team that did NOT propose the revision; it must be the
-- open ('proposed') one. Writes the official score + result_status
-- 'confirmed' + match_status 'played' in the same transaction. A previously
-- confirmed revision (correction flow) becomes 'superseded'. Repeating a
-- confirm of the already-confirmed revision returns it (already_confirmed).
create or replace function public.confirm_match_result(p_match_id uuid, p_revision int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  m      public.team_matches%rowtype;
  r      public.team_match_results%rowtype;
  v_team uuid;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if public.rivals_leader_team(m) is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;

  select * into r from public.team_match_results where match_id = m.id and status = 'proposed';
  if not found then
    select * into r from public.team_match_results where match_id = m.id and revision = p_revision and status = 'confirmed';
    if found then
      perform public.rivals_answering_team(m, r);
      return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m), 'already_confirmed', true);
    end if;
    raise exception 'rivals:no_open_proposal';
  end if;
  v_team := public.rivals_answering_team(m, r);
  if p_revision is distinct from r.revision then raise exception 'rivals:stale_revision'; end if;
  if m.match_status not in ('scheduled','played') then raise exception 'rivals:match_not_scheduled'; end if;

  update public.team_match_results set status = 'superseded' where match_id = m.id and status = 'confirmed';
  update public.team_match_results
     set status = 'confirmed', responded_by_player_id = v_pid, responded_at = now()
   where id = r.id
   returning * into r;
  update public.team_matches
     set official_home_score = r.home_score, official_away_score = r.away_score,
         result_status = 'confirmed', confirmed_revision = r.revision, result_confirmed_at = now(),
         match_status = 'played', updated_at = now()
   where id = m.id
   returning * into m;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'result_confirmed',
    jsonb_build_object('revision', r.revision, 'kind', r.kind, 'home_score', r.home_score, 'away_score', r.away_score));
  return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m));
end $$;

-- contest_match_result(match, revision, home, away, note) → new counter revision (+ match)
-- The non-proposing leader answers an open proposal with a different score:
-- the old revision becomes 'disputed', a 'counter' revision is proposed by
-- the contester (who is then waiting; the OTHER team must answer). Same
-- score → rivals:same_score. The 4th revision of a dispute chain →
-- rivals:needs_help (support). While a confirmed result is being corrected,
-- result_status stays 'confirmed' (the official score keeps counting).
create or replace function public.contest_match_result(p_match_id uuid, p_revision int, p_home_score int,
                                                       p_away_score int, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  m       public.team_matches%rowtype;
  r       public.team_match_results%rowtype;
  n       public.team_match_results%rowtype;
  v_team  uuid;
  v_note  text;
  v_rev   int;
  v_chain int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if public.rivals_leader_team(m) is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;

  select * into r from public.team_match_results where match_id = m.id and status = 'proposed';
  if not found then raise exception 'rivals:no_open_proposal'; end if;
  v_team := public.rivals_answering_team(m, r);
  if p_revision is distinct from r.revision then raise exception 'rivals:stale_revision'; end if;
  if m.match_status not in ('scheduled','played') then raise exception 'rivals:match_not_scheduled'; end if;
  perform public.rivals_check_scores(p_home_score, p_away_score);
  v_note := public.rivals_clean_note(p_note);
  if p_home_score = r.home_score and p_away_score = r.away_score then raise exception 'rivals:same_score'; end if;

  select coalesce(max(revision), 0) + 1 into v_rev from public.team_match_results where match_id = m.id;
  -- Revisions of the current chain (after the last confirmed one) + the new one.
  select count(*) + 1 into v_chain from public.team_match_results
   where match_id = m.id and revision > coalesce(m.confirmed_revision, 0);
  if v_chain >= 4 or v_rev > 30 then raise exception 'rivals:needs_help'; end if;

  update public.team_match_results
     set status = 'disputed', responded_by_player_id = v_pid, responded_at = now()
   where id = r.id;
  insert into public.team_match_results (match_id, revision, kind, home_score, away_score,
                                         reported_by_team_id, reported_by_player_id, status, note)
  values (m.id, v_rev, 'counter', p_home_score, p_away_score, v_team, v_pid, 'proposed', v_note)
  returning * into n;
  update public.team_matches
     set result_status = case when m.confirmed_revision is null then 'disputed' else 'confirmed' end,
         updated_at = now()
   where id = m.id
   returning * into m;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'result_contested',
    jsonb_build_object('contested_revision', r.revision, 'revision', v_rev, 'home_score', p_home_score, 'away_score', p_away_score));
  return public.rivals_result_json(n) || jsonb_build_object('match', public.rivals_match_summary(m));
end $$;

-- propose_result_correction(match, home, away, note) → correction revision (+ match)
-- A leader of either team, on a CONFIRMED result. The official score does
-- NOT change until the other team confirms the correction.
create or replace function public.propose_result_correction(p_match_id uuid, p_home_score int, p_away_score int,
                                                            p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  m      public.team_matches%rowtype;
  r      public.team_match_results%rowtype;
  v_team uuid;
  v_note text;
  v_rev  int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_leader_team(m);
  if v_team is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  perform public.rivals_check_scores(p_home_score, p_away_score);
  v_note := public.rivals_clean_note(p_note);
  if m.result_status <> 'confirmed' then raise exception 'rivals:result_not_confirmed'; end if;
  if exists (select 1 from public.team_match_results where match_id = m.id and status = 'proposed') then
    raise exception 'rivals:proposal_open';
  end if;
  if p_home_score = m.official_home_score and p_away_score = m.official_away_score then
    raise exception 'rivals:same_score';
  end if;

  select coalesce(max(revision), 0) + 1 into v_rev from public.team_match_results where match_id = m.id;
  if v_rev > 30 then raise exception 'rivals:needs_help'; end if;
  insert into public.team_match_results (match_id, revision, kind, home_score, away_score,
                                         reported_by_team_id, reported_by_player_id, status, note)
  values (m.id, v_rev, 'correction', p_home_score, p_away_score, v_team, v_pid, 'proposed', v_note)
  returning * into r;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'result_correction_proposed',
    jsonb_build_object('revision', v_rev, 'home_score', p_home_score, 'away_score', p_away_score,
                       'official_home_score', m.official_home_score, 'official_away_score', m.official_away_score));
  return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m));
end $$;

-- withdraw_result_proposal(match, revision) → withdrawn revision (+ match)
-- A leader of the PROPOSING team, revision still 'proposed'.
--   • first report      → result_status back to 'none' (a new report may follow)
--   • correction        → nothing else changes (result stays 'confirmed')
--   • counter (contest) → the revision it contested is re-opened ('proposed')
--                         so the dispute never dead-ends.
-- Repeating it on an already-withdrawn revision is a no-op.
create or replace function public.withdraw_result_proposal(p_match_id uuid, p_revision int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid  uuid := public.my_player_id();
  m      public.team_matches%rowtype;
  r      public.team_match_results%rowtype;
  v_prev int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if public.rivals_leader_team(m) is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;

  select * into r from public.team_match_results where match_id = m.id and revision = p_revision;
  if not found then raise exception 'rivals:no_open_proposal'; end if;
  if not public.is_team_leader(r.reported_by_team_id) then raise exception 'rivals:not_proposer' using errcode = '42501'; end if;
  if r.status = 'withdrawn' then
    return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m), 'already_withdrawn', true);
  end if;
  if r.status <> 'proposed' then raise exception 'rivals:stale_revision'; end if;

  update public.team_match_results
     set status = 'withdrawn', responded_by_player_id = v_pid, responded_at = now()
   where id = r.id
   returning * into r;

  if r.kind = 'report' then
    update public.team_matches set result_status = 'none', updated_at = now() where id = m.id returning * into m;
  elsif r.kind = 'counter' then
    select max(revision) into v_prev from public.team_match_results
     where match_id = m.id and revision < r.revision and status = 'disputed';
    if v_prev is not null then
      update public.team_match_results
         set status = 'proposed', responded_by_player_id = null, responded_at = null
       where match_id = m.id and revision = v_prev;
    end if;
    update public.team_matches
       set result_status = case when m.confirmed_revision is null then 'reported' else 'confirmed' end, updated_at = now()
     where id = m.id
     returning * into m;
  end if;
  perform public.rivals_audit_challenge(r.reported_by_team_id, m.challenge_id, m.id, 'result_withdrawn',
    jsonb_build_object('revision', r.revision, 'kind', r.kind, 'reopened_revision', v_prev));
  return public.rivals_result_json(r) || jsonb_build_object('match', public.rivals_match_summary(m));
end $$;

-- mark_match_not_played(match, reason) → {match_id, match_status, reason}
-- A leader, after kickoff, no result yet. Informational: never a loss, never
-- in the W-D-L (it is counted separately as `not_played`).
create or replace function public.mark_match_not_played(p_match_id uuid, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  m        public.team_matches%rowtype;
  v_team   uuid;
  v_reason text;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_leader_team(m);
  if v_team is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  v_reason := public.rivals_clean_note(p_reason);
  if m.match_status = 'not_played' then
    return jsonb_build_object('match_id', m.id, 'match_status', 'not_played', 'reason', m.not_played_reason);
  end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  if m.result_status <> 'none' then raise exception 'rivals:not_played_blocked'; end if;
  if m.kickoff_at > now() then raise exception 'rivals:too_early'; end if;

  update public.team_matches
     set match_status = 'not_played', not_played_reason = v_reason, not_played_at = now(), updated_at = now()
   where id = m.id;
  perform public.rivals_audit_challenge(v_team, m.challenge_id, m.id, 'match_not_played', jsonb_build_object('reason', v_reason));
  return jsonb_build_object('match_id', m.id, 'match_status', 'not_played', 'reason', v_reason);
end $$;

-- create_rematch(match, terms, client_ref) → same shape as create_challenge
-- A leader of either team, on a PLAYED match with a CONFIRMED result. The
-- caller's team challenges the OTHER team (directed), linked through
-- team_challenges.rematch_of_match_id. Terms default to the match's (the
-- two "relative" fields field_responsible / cost_split are flipped when the
-- caller is the away team, so they keep pointing at the same real team);
-- `kickoff_at` is REQUIRED in p_terms; everything else goes through
-- create_challenge (kickoff window, one open challenge per pair, ≤ 10
-- pending per team, client_ref idempotency).
create or replace function public.create_rematch(p_match_id uuid, p_terms jsonb, p_client_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  m       public.team_matches%rowtype;
  v_from  uuid;
  v_to    uuid;
  v_terms jsonb;
  v_res   jsonb;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_from := public.rivals_leader_team(m);
  if v_from is null then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  if m.match_status <> 'played' or m.result_status <> 'confirmed' then raise exception 'rivals:not_eligible_rematch'; end if;
  if p_terms is null or jsonb_typeof(p_terms) <> 'object' or not (p_terms ? 'kickoff_at') then
    raise exception 'rivals:invalid_kickoff';
  end if;

  v_to := case when v_from = m.home_team_id then m.away_team_id else m.home_team_id end;
  v_terms := public.rivals_match_terms(m) || jsonb_build_object('note', null);
  if v_from <> m.home_team_id then
    v_terms := v_terms || jsonb_build_object(
      'field_responsible', case m.field_responsible when 'challenger' then 'challenged' else 'challenger' end,
      'cost_split', case m.cost_split when 'challenger' then 'challenged' when 'challenged' then 'challenger' else m.cost_split end);
  end if;
  v_terms := v_terms || p_terms;

  v_res := public.create_challenge(v_from, v_to, v_terms, p_client_ref);
  update public.team_challenges set rematch_of_match_id = m.id
   where id = (v_res->>'challenge_id')::uuid and rematch_of_match_id is null;
  if (v_res->>'created')::boolean then
    perform public.rivals_audit_challenge(v_from, (v_res->>'challenge_id')::uuid, m.id, 'rematch_created',
      jsonb_build_object('rematch_of_match_id', m.id));
  end if;
  return v_res;
end $$;

-- ── 6. Derived metrics (confirmed matches only) ──────────

-- Internal: one row per CONFIRMED match of the team, from the team's side.
create or replace function public.rivals_team_results(p_team uuid)
returns table (match_id uuid, kickoff_at timestamptz, opponent_id uuid, gf int, ga int, res text)
language sql stable security definer set search_path = public as $$
  select x.id, x.kickoff_at, x.opp, x.gf, x.ga,
         case when x.gf > x.ga then 'W' when x.gf = x.ga then 'D' else 'L' end
    from (select m.id, m.kickoff_at,
                 case when m.home_team_id = p_team then m.away_team_id else m.home_team_id end as opp,
                 case when m.home_team_id = p_team then m.official_home_score else m.official_away_score end as gf,
                 case when m.home_team_id = p_team then m.official_away_score else m.official_home_score end as ga
            from public.team_matches m
           where (m.home_team_id = p_team or m.away_team_id = p_team)
             and m.result_status = 'confirmed'
             and m.official_home_score is not null and m.official_away_score is not null) x;
$$;

-- Internal: the full team_record object (no auth check; callers add their own).
create or replace function public.rivals_team_record(p_team uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  rec     record;
  agg     record;
  v_form  jsonb := '[]'::jsonb;
  v_i     int := 0;
  v_stype text;
  v_sn    int := 0;
  v_stop  boolean := false;
  v_big   jsonb;
  v_canc  int;
  v_late  int;
  v_np    int;
begin
  for rec in select r.res from public.rivals_team_results(p_team) r order by r.kickoff_at desc, r.match_id desc loop
    v_i := v_i + 1;
    if v_i <= 5 then v_form := v_form || to_jsonb(rec.res); end if;
    if not v_stop then
      if v_stype is null then v_stype := rec.res; v_sn := 1;
      elsif rec.res = v_stype then v_sn := v_sn + 1;
      else v_stop := true;
      end if;
    end if;
    exit when v_stop and v_i >= 5;
  end loop;

  select count(*) as played,
         count(*) filter (where r.res = 'W') as wins,
         count(*) filter (where r.res = 'D') as draws,
         count(*) filter (where r.res = 'L') as losses,
         coalesce(sum(r.gf), 0) as gf, coalesce(sum(r.ga), 0) as ga,
         count(*) filter (where r.ga = 0) as clean_sheets
    into agg
    from public.rivals_team_results(p_team) r;

  select jsonb_build_object('opponent', t.name, 'opponent_slug', t.slug,
                            'score', r.gf::text || '-' || r.ga::text, 'kickoff_at', r.kickoff_at)
    into v_big
    from public.rivals_team_results(p_team) r join public.teams t on t.id = r.opponent_id
   where r.res = 'W'
   order by r.gf - r.ga desc, r.kickoff_at desc
   limit 1;

  select count(*) filter (where m.match_status = 'cancelled' and m.cancelled_by_team_id = p_team
                            and coalesce(m.cancel_reason, '') <> 'team_archived'),
         count(*) filter (where m.match_status = 'cancelled' and m.cancelled_by_team_id = p_team
                            and coalesce(m.cancel_reason, '') <> 'team_archived'
                            and m.cancelled_at is not null and m.kickoff_at - m.cancelled_at < interval '24 hours'),
         count(*) filter (where m.match_status = 'not_played')
    into v_canc, v_late, v_np
    from public.team_matches m
   where m.home_team_id = p_team or m.away_team_id = p_team;

  return jsonb_build_object(
    'played', agg.played, 'wins', agg.wins, 'draws', agg.draws, 'losses', agg.losses,
    'gf', agg.gf, 'ga', agg.ga, 'gd', agg.gf - agg.ga,
    'form', v_form,
    'streak', jsonb_build_object('type', v_stype, 'n', v_sn),
    'biggest_win', v_big,
    'clean_sheets', agg.clean_sheets,
    'cancellations', v_canc, 'late_cancellations', v_late, 'not_played', v_np);
end $$;

-- Internal: roster with confirmed-match appearances / goals / assists.
-- p_full = true  → team_player_stats (own team): + name, member_since.
-- p_full = false → scout_opponent: nick only, never a full name.
create or replace function public.rivals_roster_stats(p_team uuid, p_full boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when p_full then
      jsonb_build_object('player_id', s.player_id, 'nick', s.nick, 'name', s.pname, 'photo_url', s.photo_url,
                         'position', s.pos, 'attrs', s.attrs, 'appearances', s.appearances,
                         'goals', s.goals, 'assists', s.assists, 'member_since', s.joined_at)
    else
      jsonb_build_object('player_id', s.player_id, 'nick', s.nick, 'photo_url', s.photo_url,
                         'position', s.pos, 'attrs', s.attrs, 'appearances', s.appearances,
                         'goals', s.goals, 'assists', s.assists)
    end
    order by s.appearances desc, s.goals desc, s.assists desc, s.nick, s.player_id), '[]'::jsonb)
  from (
    select p.id as player_id,
           coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) as nick,
           p.name as pname, p.photo_url, p."position" as pos, p.attrs, tm.joined_at,
           (select count(*) from public.team_match_lineup l join public.team_matches m on m.id = l.match_id
             where l.team_id = p_team and l.player_id = p.id and m.result_status = 'confirmed')::int as appearances,
           (select coalesce(sum(st.goals), 0) from public.team_match_player_stats st join public.team_matches m on m.id = st.match_id
             where st.team_id = p_team and st.player_id = p.id and m.result_status = 'confirmed')::int as goals,
           (select coalesce(sum(st.assists), 0) from public.team_match_player_stats st join public.team_matches m on m.id = st.match_id
             where st.team_id = p_team and st.player_id = p.id and m.result_status = 'confirmed')::int as assists
      from public.team_members tm join public.players p on p.id = tm.player_id
     where tm.team_id = p_team and tm.status = 'active') s;
$$;

-- team_record(team) → record object. Any signed-in user (public stats card).
create or replace function public.team_record(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'rivals:team_not_found'; end if;
  return public.rivals_team_record(p_team_id);
end $$;

-- team_head_to_head(team, opponent) → {played, wins, draws, losses, gf, ga, last, confronto_n}
-- Confirmed meetings only, from p_team's side. last = the most recent one.
-- confronto_n = confirmed meetings + 1 ("Confronto #N").
create or replace function public.team_head_to_head(p_team_id uuid, p_opponent_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  agg    record;
  v_last jsonb;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) or not exists (select 1 from public.teams where id = p_opponent_id) then
    raise exception 'rivals:team_not_found';
  end if;
  select count(*) as played,
         count(*) filter (where r.res = 'W') as wins,
         count(*) filter (where r.res = 'D') as draws,
         count(*) filter (where r.res = 'L') as losses,
         coalesce(sum(r.gf), 0) as gf, coalesce(sum(r.ga), 0) as ga
    into agg
    from public.rivals_team_results(p_team_id) r
   where r.opponent_id = p_opponent_id;
  select jsonb_build_object('match_id', r.match_id, 'kickoff_at', r.kickoff_at,
                            'score', r.gf::text || '-' || r.ga::text, 'gf', r.gf, 'ga', r.ga, 'result', r.res)
    into v_last
    from public.rivals_team_results(p_team_id) r
   where r.opponent_id = p_opponent_id
   order by r.kickoff_at desc, r.match_id desc
   limit 1;
  return jsonb_build_object(
    'played', agg.played, 'wins', agg.wins, 'draws', agg.draws, 'losses', agg.losses,
    'gf', agg.gf, 'ga', agg.ga, 'last', v_last, 'confronto_n', agg.played + 1);
end $$;

-- team_player_stats(team) → {items:[…]}. Members of that team (own roster,
-- with names). The opponent's roster is only reachable through scout_opponent.
create or replace function public.team_player_stats(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.teams where id = p_team_id) then raise exception 'rivals:team_not_found'; end if;
  if not (public.is_team_member(p_team_id) or public.is_admin()) then
    raise exception 'rivals:not_team_member' using errcode = '42501';
  end if;
  return jsonb_build_object('items', public.rivals_roster_stats(p_team_id, true));
end $$;

-- scout_opponent(match) → {team, record, h2h, items}
-- Members of either team, only while the challenge is 'agreed' and the match
-- is scheduled or played. Shows the OTHER team: card, record, head-to-head
-- and a nick-only roster with forma stats. No phone / email / full name.
create or replace function public.scout_opponent(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m      public.team_matches%rowtype;
  v_mine uuid;
  v_opp  uuid;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_mine := public.rivals_member_team(m);
  if v_mine is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;
  if m.match_status not in ('scheduled','played')
     or not exists (select 1 from public.team_challenges c where c.id = m.challenge_id and c.status = 'agreed') then
    raise exception 'rivals:scout_unavailable';
  end if;
  v_opp := case when v_mine = m.home_team_id then m.away_team_id else m.home_team_id end;
  return jsonb_build_object(
    'team', public.rivals_team_card(v_opp),
    'record', public.rivals_team_record(v_opp),
    'h2h', public.team_head_to_head(v_mine, v_opp),
    'items', public.rivals_roster_stats(v_opp, false));
end $$;

-- my_team_career() → {items:[{team_id, name, slug, appearances, goals, assists, wins, draws, losses}]}
-- The caller's player across the teams they are in (or played for), from
-- CONFIRMED matches where they were in the lineup.
create or replace function public.my_team_career()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_items jsonb;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'team_id', c.team_id, 'name', c.name, 'slug', c.slug,
           'appearances', c.appearances, 'goals', c.goals, 'assists', c.assists,
           'wins', c.wins, 'draws', c.draws, 'losses', c.losses)
         order by c.appearances desc, c.name), '[]'::jsonb)
    into v_items
    from (
      select t.id as team_id, t.name, t.slug,
             (select count(*) from public.team_match_lineup l join public.team_matches m on m.id = l.match_id
               where l.player_id = v_pid and l.team_id = t.id and m.result_status = 'confirmed')::int as appearances,
             (select coalesce(sum(st.goals), 0) from public.team_match_player_stats st join public.team_matches m on m.id = st.match_id
               where st.player_id = v_pid and st.team_id = t.id and m.result_status = 'confirmed')::int as goals,
             (select coalesce(sum(st.assists), 0) from public.team_match_player_stats st join public.team_matches m on m.id = st.match_id
               where st.player_id = v_pid and st.team_id = t.id and m.result_status = 'confirmed')::int as assists,
             (select count(*) from public.team_match_lineup l join public.team_matches m on m.id = l.match_id
               where l.player_id = v_pid and l.team_id = t.id and m.result_status = 'confirmed'
                 and ((l.team_id = m.home_team_id and m.official_home_score > m.official_away_score)
                   or (l.team_id = m.away_team_id and m.official_away_score > m.official_home_score)))::int as wins,
             (select count(*) from public.team_match_lineup l join public.team_matches m on m.id = l.match_id
               where l.player_id = v_pid and l.team_id = t.id and m.result_status = 'confirmed'
                 and m.official_home_score = m.official_away_score)::int as draws,
             (select count(*) from public.team_match_lineup l join public.team_matches m on m.id = l.match_id
               where l.player_id = v_pid and l.team_id = t.id and m.result_status = 'confirmed'
                 and ((l.team_id = m.home_team_id and m.official_home_score < m.official_away_score)
                   or (l.team_id = m.away_team_id and m.official_away_score < m.official_home_score)))::int as losses
        from public.teams t
       where t.id in (select tm.team_id from public.team_members tm where tm.player_id = v_pid and tm.status = 'active'
                      union
                      select l.team_id from public.team_match_lineup l where l.player_id = v_pid)
    ) c;
  return jsonb_build_object('items', v_items);
end $$;

-- ── 7. Reads (per match) ─────────────────────────────────

-- get_match_availability(match) → {items, counts}. OWN team only: every
-- active member with their answer (null = no answer yet).
create or replace function public.get_match_availability(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m      public.team_matches%rowtype;
  v_team uuid;
  v_items  jsonb;
  v_counts jsonb;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_member_team(m);
  if v_team is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', s.player_id, 'nick', s.nick, 'name', s.pname, 'photo_url', s.photo_url,
           'position', s.pos, 'role', s.role, 'status', s.status, 'updated_at', s.updated_at)
         order by case s.status when 'yes' then 1 when 'maybe' then 2 when 'no' then 3 else 4 end, s.nick, s.player_id), '[]'::jsonb),
         jsonb_build_object(
           'yes',     count(*) filter (where s.status = 'yes'),
           'no',      count(*) filter (where s.status = 'no'),
           'maybe',   count(*) filter (where s.status = 'maybe'),
           'pending', count(*) filter (where s.status is null))
    into v_items, v_counts
    from (
      select p.id as player_id, coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) as nick,
             p.name as pname, p.photo_url, p."position" as pos, tm.role, a.status, a.updated_at
        from public.team_members tm
        join public.players p on p.id = tm.player_id
        left join public.team_match_availability a on a.match_id = m.id and a.player_id = tm.player_id
       where tm.team_id = v_team and tm.status = 'active') s;
  return jsonb_build_object('items', v_items, 'counts', v_counts);
end $$;

-- get_match_lineup(match) → {items}. Own team always; both teams once the
-- match is 'played'. Opponent players are shown by first name only.
create or replace function public.get_match_lineup(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m      public.team_matches%rowtype;
  v_team uuid;
  v_items jsonb;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_team := public.rivals_member_team(m);
  if v_team is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'team_id', l.team_id, 'player_id', p.id,
           'nick', coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)),
           'name', case when l.team_id = v_team then p.name else split_part(p.name, ' ', 1) end,
           'photo_url', p.photo_url, 'position', p."position")
         order by (l.team_id <> v_team), p."position", coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)), p.id), '[]'::jsonb)
    into v_items
    from public.team_match_lineup l join public.players p on p.id = l.player_id
   where l.match_id = m.id and (l.team_id = v_team or m.match_status = 'played');
  return jsonb_build_object('items', v_items);
end $$;

-- get_match_results(match) → {items:[result…], official}. Members of either team.
create or replace function public.get_match_results(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m       public.team_matches%rowtype;
  v_items jsonb;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if public.rivals_member_team(m) is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(public.rivals_result_json(r) order by r.revision), '[]'::jsonb)
    into v_items from public.team_match_results r where r.match_id = m.id;
  return jsonb_build_object(
    'items', v_items,
    'official', jsonb_build_object(
      'status', m.result_status, 'home_score', m.official_home_score, 'away_score', m.official_away_score,
      'confirmed_revision', m.confirmed_revision, 'confirmed_at', m.result_confirmed_at));
end $$;

-- get_match_player_stats(match) → {items:[{team_id, player_id, nick, goals, assists}]}. Members of either team.
create or replace function public.get_match_player_stats(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m       public.team_matches%rowtype;
  v_items jsonb;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into m from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if public.rivals_member_team(m) is null then raise exception 'rivals:not_team_member' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'team_id', s.team_id, 'player_id', s.player_id,
           'nick', coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)),
           'goals', s.goals, 'assists', s.assists)
         order by (s.team_id <> m.home_team_id), s.goals desc, s.assists desc,
                  coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)), s.player_id), '[]'::jsonb)
    into v_items
    from public.team_match_player_stats s join public.players p on p.id = s.player_id
   where s.match_id = m.id;
  return jsonb_build_object('items', v_items);
end $$;

-- ── 8. Extended reads ────────────────────────────────────

-- my_challenges() — 007100 version + the new `match` keys (result,
-- my_availability, availability_counts, lineup_count, stats_recorded).
-- Every pre-existing key is unchanged.
create or replace function public.my_challenges()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_items jsonb;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  with mine as (
    select m.team_id, m.role from public.team_members m join public.teams t on t.id = m.team_id
     where m.player_id = v_pid and m.status = 'active'
  ), chs as (
    select ch.*,
           case when exists (select 1 from mine where team_id = ch.turn_team_id) then ch.turn_team_id
                when exists (select 1 from mine where team_id = ch.challenger_team_id) then ch.challenger_team_id
                else ch.challenged_team_id end as my_team_id
      from public.team_challenges ch
     where ch.challenger_team_id in (select team_id from mine) or ch.challenged_team_id in (select team_id from mine)
     order by ch.updated_at desc
     limit 200
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'mode', r.mode, 'status', r.status,
    'effective_status', case when r.status = 'pending' and r.expires_at <= now() then 'expired' else r.status end,
    'current_version', r.current_version, 'turn_team_id', r.turn_team_id, 'expires_at', r.expires_at,
    'pending_change_version', r.pending_change_version,
    'invite_token', case when exists (select 1 from mine where team_id = r.challenger_team_id) then r.invite_token end,
    'created_at', r.created_at, 'updated_at', r.updated_at, 'decided_at', r.decided_at,
    'decided_by_team_id', r.decided_by_team_id, 'reason', r.reason, 'rematch_of_match_id', r.rematch_of_match_id,
    'challenger', public.rivals_team_card(r.challenger_team_id),
    'challenged', case when r.challenged_team_id is null then null else public.rivals_team_card(r.challenged_team_id) end,
    'my_team_id', r.my_team_id,
    'my_role', (select role from mine where team_id = r.my_team_id),
    'versions', (select coalesce(jsonb_agg(public.rivals_version_terms(v) || jsonb_build_object(
                    'version', v.version, 'kind', v.kind, 'proposed_by_team_id', v.proposed_by_team_id,
                    'outcome', v.outcome, 'responded_at', v.responded_at, 'created_at', v.created_at) order by v.version), '[]'::jsonb)
                   from public.team_challenge_versions v where v.challenge_id = r.id),
    'match', (select public.rivals_match_terms(m) || jsonb_build_object(
                'id', m.id, 'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id,
                'agreed_version', m.agreed_version, 'match_status', m.match_status,
                'field_status', m.field_status, 'field_note', m.field_note, 'field_status_at', m.field_status_at,
                'result_status', m.result_status, 'official_home_score', m.official_home_score,
                'official_away_score', m.official_away_score,
                'cancelled_by_team_id', m.cancelled_by_team_id, 'cancelled_at', m.cancelled_at, 'cancel_reason', m.cancel_reason)
                || public.rivals_match_extras(m, v_pid)
                from public.team_matches m where m.challenge_id = r.id)
  ) order by r.updated_at desc), '[]'::jsonb)
  into v_items
  from chs r;
  return jsonb_build_object('items', v_items);
end $$;

-- team_profile(slug) — anon OK. 007000 shape + a REAL record / form (confirmed
-- results only); signed-in callers also get top scorers / assisters (top 3).
-- Still no roster. `record` keeps the 007000 keys goals_for / goals_against.
create or replace function public.team_profile(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_rec  jsonb;
  v_out  jsonb;
begin
  select * into v_team from public.teams where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then return null; end if;
  v_rec := public.rivals_team_record(v_team.id);
  v_out := jsonb_build_object(
    'id', v_team.id, 'name', v_team.name, 'slug', v_team.slug, 'city', v_team.city,
    'region', v_team.region, 'country', v_team.country,
    'color', v_team.color, 'secondary_color', v_team.secondary_color, 'logo_url', v_team.logo_url,
    'preferred_format', v_team.preferred_format, 'home_venue', v_team.home_venue,
    'created_at', v_team.created_at, 'archived', v_team.archived_at is not null,
    'member_count', (select count(*) from public.team_members m where m.team_id = v_team.id and m.status = 'active'),
    'my_role', public.team_role(v_team.id),
    'record', jsonb_build_object(
      'played', v_rec->'played', 'wins', v_rec->'wins', 'draws', v_rec->'draws', 'losses', v_rec->'losses',
      'goals_for', v_rec->'gf', 'goals_against', v_rec->'ga', 'gf', v_rec->'gf', 'ga', v_rec->'ga', 'gd', v_rec->'gd',
      'clean_sheets', v_rec->'clean_sheets', 'streak', v_rec->'streak'),
    'form', v_rec->'form');
  if auth.uid() is not null then
    v_out := v_out || jsonb_build_object(
      'top_scorers', (
        select coalesce(jsonb_agg(jsonb_build_object('nick', q.nick, 'n', q.n) order by q.n desc, q.nick), '[]'::jsonb)
          from (select coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) as nick, sum(s.goals)::int as n
                  from public.team_match_player_stats s
                  join public.team_matches m on m.id = s.match_id and m.result_status = 'confirmed'
                  join public.players p on p.id = s.player_id
                 where s.team_id = v_team.id
                 group by p.id, p.nick, p.name
                having sum(s.goals) > 0
                 order by sum(s.goals) desc, coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1))
                 limit 3) q),
      'top_assisters', (
        select coalesce(jsonb_agg(jsonb_build_object('nick', q.nick, 'n', q.n) order by q.n desc, q.nick), '[]'::jsonb)
          from (select coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) as nick, sum(s.assists)::int as n
                  from public.team_match_player_stats s
                  join public.team_matches m on m.id = s.match_id and m.result_status = 'confirmed'
                  join public.players p on p.id = s.player_id
                 where s.team_id = v_team.id
                 group by p.id, p.nick, p.name
                having sum(s.assists) > 0
                 order by sum(s.assists) desc, coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1))
                 limit 3) q));
  end if;
  return v_out;
end $$;

-- list_teams(...) — 007000 directory, with the placeholder record / form
-- replaced by the real confirmed-results ones (same filters, same order).
create or replace function public.list_teams(
  p_country text default 'PT', p_region text default null, p_city text default null,
  p_format text default null, p_query text default null,
  p_limit int default 30, p_offset int default 0, p_only_near boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  v_region text := nullif(lower(btrim(coalesce(p_region, ''))), '');
  v_city   text := nullif(lower(btrim(coalesce(p_city, ''))), '');
  v_q      text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit  int := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_items  jsonb;
  v_count  int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if v_q is not null then v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_'); end if;

  with base as (
    select t.*,
           (v_city is not null and lower(t.city) = v_city) as same_city,
           (v_region is not null and lower(t.region) = v_region) as same_region
      from public.teams t
     where t.listed and t.archived_at is null
       and t.country = coalesce(nullif(p_country, ''), 'PT')
       and (p_format is null or p_format = '' or t.preferred_format = p_format)
       and (v_q is null or lower(t.name) like '%' || v_q || '%' or lower(coalesce(t.city, '')) like '%' || v_q || '%'
            or lower(coalesce(t.region, '')) like '%' || v_q || '%')
       and (not coalesce(p_only_near, false)
            or (v_region is not null and lower(t.region) = v_region)
            or (v_region is null and v_city is not null and lower(t.city) = v_city))
  ), page as (
    select b.* from base b
     order by b.same_city desc, b.same_region desc, b.updated_at desc, b.created_at desc, b.id
     limit v_limit + 1 offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'slug', p.slug, 'city', p.city, 'region', p.region, 'country', p.country,
           'color', p.color, 'secondary_color', p.secondary_color, 'logo_url', p.logo_url,
           'preferred_format', p.preferred_format, 'created_at', p.created_at,
           'same_city', p.same_city, 'same_region', p.same_region,
           'member_count', (select count(*) from public.team_members m where m.team_id = p.id and m.status = 'active'),
           'captain', (select jsonb_build_object('id', pl.id, 'nick', coalesce(nullif(pl.nick, ''), split_part(pl.name, ' ', 1)), 'photo_url', pl.photo_url)
                         from public.team_members m join public.players pl on pl.id = m.player_id
                        where m.team_id = p.id and m.role = 'captain' and m.status = 'active' limit 1),
           'vice', (select jsonb_build_object('id', pl.id, 'nick', coalesce(nullif(pl.nick, ''), split_part(pl.name, ' ', 1)), 'photo_url', pl.photo_url)
                      from public.team_members m join public.players pl on pl.id = m.player_id
                     where m.team_id = p.id and m.role = 'vice' and m.status = 'active' limit 1),
           'my_role', (select m.role from public.team_members m where m.team_id = p.id and m.player_id = v_pid and m.status = 'active'),
           'record', jsonb_build_object('played', rr.rec->'played', 'wins', rr.rec->'wins', 'draws', rr.rec->'draws', 'losses', rr.rec->'losses'),
           'form', rr.rec->'form'
         ) order by p.same_city desc, p.same_region desc, p.updated_at desc, p.created_at desc, p.id), '[]'::jsonb),
         count(*)
    into v_items, v_count
    from page p
   cross join lateral (select public.rivals_team_record(p.id) as rec) rr;

  if v_count > v_limit then
    v_items := v_items - v_limit;  -- drop the look-ahead row
  end if;
  return jsonb_build_object('items', v_items, 'has_more', v_count > v_limit);
end $$;

-- ── 9. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  -- RLS helper: signed-in users (policies run as the caller).
  execute 'revoke execute on function public.can_see_match(uuid) from public, anon';
  execute 'grant execute on function public.can_see_match(uuid) to authenticated, service_role';
  -- App RPCs: signed-in users only.
  foreach f in array array[
    'public.set_match_availability(uuid, text)',
    'public.set_match_lineup(uuid, uuid[])',
    'public.set_match_player_stats(uuid, jsonb)',
    'public.report_match_result(uuid, int, int, text)',
    'public.confirm_match_result(uuid, int)',
    'public.contest_match_result(uuid, int, int, int, text)',
    'public.propose_result_correction(uuid, int, int, text)',
    'public.withdraw_result_proposal(uuid, int)',
    'public.mark_match_not_played(uuid, text)',
    'public.create_rematch(uuid, jsonb, text)',
    'public.get_match_availability(uuid)',
    'public.get_match_lineup(uuid)',
    'public.get_match_results(uuid)',
    'public.get_match_player_stats(uuid)',
    'public.team_record(uuid)',
    'public.team_head_to_head(uuid, uuid)',
    'public.team_player_stats(uuid)',
    'public.scout_opponent(uuid)',
    'public.my_team_career()',
    'public.my_challenges()',
    'public.list_teams(text, text, text, text, text, int, int, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Public team page / OG function: also anonymous.
  execute 'revoke execute on function public.team_profile(text) from public';
  execute 'grant execute on function public.team_profile(text) to anon, authenticated, service_role';
  -- Internal only (RPC plumbing).
  foreach f in array array[
    'public.rivals_leader_team(public.team_matches)', 'public.rivals_member_team(public.team_matches)',
    'public.rivals_check_scores(int, int)', 'public.rivals_clean_note(text)',
    'public.rivals_result_json(public.team_match_results)', 'public.rivals_match_summary(public.team_matches)',
    'public.rivals_answering_team(public.team_matches, public.team_match_results)',
    'public.rivals_match_extras(public.team_matches, uuid)',
    'public.rivals_team_results(uuid)', 'public.rivals_team_record(uuid)', 'public.rivals_roster_stats(uuid, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
