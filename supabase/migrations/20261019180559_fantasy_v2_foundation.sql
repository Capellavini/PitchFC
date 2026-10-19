-- ─────────────────────────────────────────────────────────
-- Pitch Manager (Fantasy) v2 — Phase A "Fundação" (owner decisions
-- 2026-10-19). Moves the game's integrity to the server:
--
--   1. Rules as pure plpgsql (fantasy_v2_*), the SOURCE OF TRUTH.
--      src/lib/core/fantasyRules.js mirrors them; shared vectors
--      (src/lib/core/fixtures/fantasyVectors.json) run through both
--      (npm test + supabase/tests/fantasy_v2_check.sql).
--   2. Lock at kickoff, in the DB: a round is created when the group's
--      game scheduled_at passes (pg_cron every 5 min AND lazily inside
--      every write RPC / the matchday trigger) and each participant's
--      squad is copied to fantasy_round_lineups. Scoring only ever reads
--      that snapshot; edits after the lock land in the next round.
--   3. Squad writes only via save_fantasy_squad (security definer):
--      budget, price by form, ownership cap max(2, ceil(n/2)), injured,
--      captain/vice/bench normalisation. Direct table writes on
--      fantasy_squads / fantasy_scores are revoked. accept_fantasy_trade
--      keeps its signature but now computes both squads server-side
--      (the client arrays are ignored).
--   4. Server scoring: AFTER INSERT on matchdays attaches the night to the
--      league's latest locked round (fallback: lock at commit) and scores
--      it; AFTER UPDATE of summary / podium re-scores the round (MVP bonus
--      = podium update; corrections = summary update). fantasy_scores gets
--      breakdown/revision/updated_at; the bank delta is re-applied.
--   5. Transfers: unlimited until a participant's first lock in the
--      Campeonato; then 1 free per round, bankable up to 2, −4 per extra
--      (charged in the round score, shown in the breakdown).
--   6. Seasons that renew: Taça do Mês (calendar month) + Campeonato da
--      Época (1 Aug → 31 Jul), Europe/Lisbon. A cron closes finished
--      periods, snapshots standings, writes fantasy_trophies and opens the
--      next one (squads are kept). duration_months is legacy.
--   7. Restart (idempotent, rules_version < 2): every existing league's
--      current run is closed as a 'legacy' season (standings snapshot,
--      champion(s) = rank 1 incl. ties, trophies for ranks 1–3), squads
--      are emptied, pending trades cancelled, and the league reopens on
--      v2 with a fresh Taça do Mês + Campeonato. Only the newest league of
--      a group stays active; older ones are archived.
--
-- Fallbacks documented (summary shape, see endMatchday in PitchApp.jsx):
--   • per-game rosters come from summary.teamResults[].players matched by
--     team NAME to matches[].homeName/awayName; duplicated/missing names →
--     no CS / win for that side. Legacy summaries without rosters: everyone
--     in candidates counts as played and nobody is a no-show.
--   • no-show = summary.candidates (confirmed & within spots when the day
--     was ended) minus everyone who appeared. games.attendances is reset
--     weekly, so the summary is the only stable record.
--   • saves/own goals use matches[].events; summaries without events fall
--     back to lines[].epicSaves (own goals then 0). An epic save is worth
--     the GR value for the keeper of that game (homeGk/awayGk) or a GR,
--     otherwise 2 (DEF value; spec silent for MED/AVA).
--   • clean sheet value: that game's keeper gets the GR value, everyone
--     else by players.position.
--
-- Never touches games / attendances policies. Every new table: RLS on,
-- explicit grants (select to authenticated, all to service_role).
-- ─────────────────────────────────────────────────────────

-- ═════════ 1. Pure rules (immutable — no table access) ═════════

create or replace function public.fantasy_v2_rules()
returns jsonb language sql immutable set search_path = '' as $$
-- RULES:BEGIN
  select '{"played":2,"goal":{"GR":8,"DEF":7,"MED":5,"AVA":4},"assist":{"GR":4,"DEF":4,"MED":4,"AVA":3},"save":{"GR":3,"DEF":2,"MED":2,"AVA":2},"cleanSheet":{"GR":4,"DEF":3,"MED":1,"AVA":0},"win":1,"hatTrick":3,"hatTrickGoals":3,"ownGoal":-2,"noShow":-3,"mvp":[10,6,3],"captain":2,"transferCost":4,"freeTransfersPerRound":1,"maxBankedTransfers":2,"priceBase":20,"priceScale":1.5,"priceForm":3,"priceMin":5}'::jsonb
-- RULES:END
$$;

create or replace function public.fantasy_v2_pos(p_pos text)
returns text language sql immutable set search_path = '' as $$
  select case p_pos when 'Guarda-redes' then 'GR' when 'Defesa' then 'DEF' when 'Médio' then 'MED' when 'Avançado' then 'AVA' else 'MED' end;
$$;

create or replace function public.fantasy_v2_int(p jsonb)
returns int language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p) = 'number' then trunc((p #>> '{}')::numeric)::int
    when jsonb_typeof(p) = 'string' and (p #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then trunc(btrim(p #>> '{}')::numeric)::int
    else null end;
$$;

create or replace function public.fantasy_v2_arr(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end;
$$;

-- Facts about one night, independent of any squad (mirror: nightFacts).
create or replace function public.fantasy_v2_night(p_summary jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  s jsonb := coalesce(p_summary, '{}'::jsonb);
  t jsonb; m jsonb; evs jsonb;
  teams jsonb := '{}'::jsonb;
  dupes text[] := '{}';
  team_ids text[] := '{}';
  appeared text[] := '{}';
  cands text[];
  games jsonb := '[]'::jsonb;
  has_events boolean := false;
  nm text; hn text; an text; home jsonb; away jsonb;
begin
  for t in select x from jsonb_array_elements(public.fantasy_v2_arr(s->'teamResults')) x loop
    continue when jsonb_typeof(t->'players') is distinct from 'array';
    nm := coalesce(t->>'name', '');
    if teams ? nm then dupes := dupes || nm; end if;
    teams := teams || jsonb_build_object(nm,
      (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements_text(t->'players') v where v is not null));
    team_ids := team_ids || array(select v from jsonb_array_elements_text(t->'players') v where v is not null);
  end loop;
  appeared := team_ids;
  cands := array(select c->>'key' from jsonb_array_elements(public.fantasy_v2_arr(s->'candidates')) c
                 where jsonb_typeof(c) = 'object' and c->>'key' is not null);
  if cardinality(team_ids) = 0 then appeared := appeared || cands; end if;
  appeared := appeared || array(select l->>'key' from jsonb_array_elements(public.fantasy_v2_arr(s->'lines')) l
                                where jsonb_typeof(l) = 'object' and l->>'key' is not null);
  for m in select x from jsonb_array_elements(public.fantasy_v2_arr(s->'matches')) x loop
    if jsonb_typeof(m->'events') = 'array' then has_events := true; end if;
    evs := (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(public.fantasy_v2_arr(m->'events')) e where jsonb_typeof(e) = 'object');
    appeared := appeared
      || array(select e->>'by' from jsonb_array_elements(evs) e where e->>'by' is not null)
      || array(select e->>'ast' from jsonb_array_elements(evs) e where e->>'ast' is not null);
    if m->>'homeGk' is not null then appeared := appeared || (m->>'homeGk'); end if;
    if m->>'awayGk' is not null then appeared := appeared || (m->>'awayGk'); end if;
    hn := coalesce(m->>'homeName', ''); an := coalesce(m->>'awayName', '');
    home := case when hn = an or hn = any(dupes) or not (teams ? hn) then '[]'::jsonb else teams->hn end;
    away := case when hn = an or an = any(dupes) or not (teams ? an) then '[]'::jsonb else teams->an end;
    games := games || jsonb_build_array(jsonb_build_object(
      'home', home, 'away', away,
      'hg', coalesce(public.fantasy_v2_int(m->'homeGoals'),
                     (select count(*)::int from jsonb_array_elements(evs) e where e->>'side' = 'h' and coalesce(e->>'type', '') <> 'save')),
      'ag', coalesce(public.fantasy_v2_int(m->'awayGoals'),
                     (select count(*)::int from jsonb_array_elements(evs) e where e->>'side' = 'a' and coalesce(e->>'type', '') <> 'save')),
      'hgk', m->>'homeGk', 'agk', m->>'awayGk',
      'saves', (select coalesce(jsonb_agg(e->>'by'), '[]'::jsonb) from jsonb_array_elements(evs) e where e->>'type' = 'save' and e->>'by' is not null),
      'ogs', (select coalesce(jsonb_agg(e->>'by'), '[]'::jsonb) from jsonb_array_elements(evs) e where e->>'type' = 'og' and e->>'by' is not null)));
  end loop;
  return jsonb_build_object(
    'appeared', to_jsonb(array(select distinct x from unnest(appeared) x)),
    'noShows', to_jsonb(array(select distinct c from unnest(cands) c where not (c = any(appeared)))),
    'games', games, 'hasEvents', has_events);
end $$;

-- One real player's points for one night, no captaincy (mirror: playerNightPoints).
create or replace function public.fantasy_v2_player_night(p_night jsonb, p_summary jsonb, p_pid text, p_pos text, p_podium jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  r jsonb := public.fantasy_v2_rules();
  pc text := public.fantasy_v2_pos(p_pos);
  pod jsonb := coalesce(p_podium, '{}'::jsonb);
  line jsonb; g jsonb; b text;
  goals int; assists int;
  cs_n int := 0; cs_pts int := 0; wins int := 0; sv_n int := 0; sv_pts int := 0; og_n int := 0; rk int;
  is_home boolean; is_away boolean;
  items jsonb := '{}'::jsonb;
begin
  if not coalesce((p_night->'appeared') ? p_pid, false) then
    if coalesce((p_night->'noShows') ? p_pid, false) then
      return jsonb_build_object('played', false, 'noShow', true, 'pts', (r->>'noShow')::int,
        'items', jsonb_build_object('noShow', jsonb_build_object('n', 1, 'pts', (r->>'noShow')::int)));
    end if;
    return jsonb_build_object('played', false, 'noShow', false, 'pts', 0, 'items', '{}'::jsonb);
  end if;
  select l into line from jsonb_array_elements(public.fantasy_v2_arr(p_summary->'lines')) l
   where jsonb_typeof(l) = 'object' and l->>'key' = p_pid limit 1;
  goals := coalesce(public.fantasy_v2_int(line->'goals'), 0);
  assists := coalesce(public.fantasy_v2_int(line->'assists'), 0);
  for g in select x from jsonb_array_elements(p_night->'games') x loop
    is_home := (g->'home') ? p_pid;
    is_away := (g->'away') ? p_pid;
    if is_home and (g->>'ag')::int = 0 then
      cs_n := cs_n + 1;
      cs_pts := cs_pts + (r->'cleanSheet'->>(case when g->>'hgk' = p_pid then 'GR' else pc end))::int;
    end if;
    if is_away and (g->>'hg')::int = 0 then
      cs_n := cs_n + 1;
      cs_pts := cs_pts + (r->'cleanSheet'->>(case when g->>'agk' = p_pid then 'GR' else pc end))::int;
    end if;
    if (is_home and (g->>'hg')::int > (g->>'ag')::int) or (is_away and (g->>'ag')::int > (g->>'hg')::int) then
      wins := wins + 1;
    end if;
    for b in select jsonb_array_elements_text(g->'saves') loop
      if b = p_pid then
        sv_n := sv_n + 1;
        sv_pts := sv_pts + (r->'save'->>(case when b = g->>'hgk' or b = g->>'agk' or pc = 'GR' then 'GR' else pc end))::int;
      end if;
    end loop;
    og_n := og_n + (select count(*)::int from jsonb_array_elements_text(g->'ogs') o where o = p_pid);
  end loop;
  if not (p_night->>'hasEvents')::boolean then
    sv_n := coalesce(public.fantasy_v2_int(line->'epicSaves'), 0);
    sv_pts := sv_n * (r->'save'->>pc)::int;
  end if;
  items := jsonb_build_object('played', jsonb_build_object('n', 1, 'pts', (r->>'played')::int));
  if goals <> 0 then items := items || jsonb_build_object('goals', jsonb_build_object('n', goals, 'pts', goals * (r->'goal'->>pc)::int)); end if;
  if assists <> 0 then items := items || jsonb_build_object('assists', jsonb_build_object('n', assists, 'pts', assists * (r->'assist'->>pc)::int)); end if;
  if sv_n <> 0 then items := items || jsonb_build_object('saves', jsonb_build_object('n', sv_n, 'pts', sv_pts)); end if;
  if cs_n <> 0 then items := items || jsonb_build_object('cleanSheets', jsonb_build_object('n', cs_n, 'pts', cs_pts)); end if;
  if wins <> 0 then items := items || jsonb_build_object('wins', jsonb_build_object('n', wins, 'pts', wins * (r->>'win')::int)); end if;
  if goals >= (r->>'hatTrickGoals')::int then items := items || jsonb_build_object('hatTrick', jsonb_build_object('n', 1, 'pts', (r->>'hatTrick')::int)); end if;
  if og_n <> 0 then items := items || jsonb_build_object('ownGoals', jsonb_build_object('n', og_n, 'pts', og_n * (r->>'ownGoal')::int)); end if;
  rk := case when pod->>'mvp' = p_pid then 1 when pod->>'second' = p_pid then 2 when pod->>'third' = p_pid then 3 else 0 end;
  if rk > 0 then items := items || jsonb_build_object('mvp', jsonb_build_object('n', rk, 'pts', (r->'mvp'->>(rk - 1))::int)); end if;
  return jsonb_build_object('played', true, 'noShow', false,
    'pts', (select coalesce(sum((v->>'pts')::int), 0)::int from jsonb_each(items) e(k, v)), 'items', items);
end $$;

-- Score one locked lineup against one night (mirror: scoreLineup).
create or replace function public.fantasy_v2_score_lineup(p_lineup jsonb, p_summary jsonb, p_positions jsonb, p_podium jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  r jsonb := public.fantasy_v2_rules();
  night jsonb := public.fantasy_v2_night(p_summary);
  starters text[] := array(select v from jsonb_array_elements_text(public.fantasy_v2_arr(p_lineup->'starters')) v where v is not null);
  bench text[] := array(select v from jsonb_array_elements_text(public.fantasy_v2_arr(p_lineup->'bench')) v where v is not null);
  pn jsonb := '{}'::jsonb;
  used text[] := '{}';
  subbed jsonb := '{}'::jsonb;   -- starter → bench player who replaced him
  sub_for jsonb := '{}'::jsonb;  -- bench player → starter he replaced
  cap text := p_lineup->>'captain';
  vice text := p_lineup->>'vice';
  eff text;
  tc int := coalesce(public.fantasy_v2_int(p_lineup->'transferCost'), 0);
  total int; players jsonb := '[]'::jsonb;
  pid text; b text; counted boolean; mult int; pts int; slot text; i int;
begin
  foreach pid in array starters || bench loop
    if not (pn ? pid) then
      pn := pn || jsonb_build_object(pid, public.fantasy_v2_player_night(night, p_summary, pid, p_positions->>pid, p_podium));
    end if;
  end loop;
  foreach pid in array starters loop
    if not (pn->pid->>'played')::boolean then
      b := null;
      select u.bb into b from unnest(bench) with ordinality u(bb, o)
       where not (u.bb = any(used)) and (pn->u.bb->>'played')::boolean order by u.o limit 1;
      if b is not null then
        used := used || b;
        subbed := subbed || jsonb_build_object(pid, b);
        sub_for := sub_for || jsonb_build_object(b, pid);
      end if;
    end if;
  end loop;
  eff := case
    when cap is not null and cap = any(starters) and (pn->cap->>'played')::boolean then cap
    when vice is not null and vice = any(starters) and (pn->vice->>'played')::boolean then vice
    else null end;
  total := -tc;
  for i in 1 .. coalesce(cardinality(starters), 0) + coalesce(cardinality(bench), 0) loop
    if i <= coalesce(cardinality(starters), 0) then
      pid := starters[i]; slot := 'starter'; counted := not (subbed ? pid);
    else
      pid := bench[i - cardinality(starters)]; slot := 'bench'; counted := pid = any(used);
    end if;
    mult := case when counted and pid = eff then (r->>'captain')::int else 1 end;
    pts := case when counted then (pn->pid->>'pts')::int * mult else 0 end;
    total := total + pts;
    players := players || jsonb_build_array(jsonb_build_object(
      'id', pid, 'slot', slot, 'played', (pn->pid->>'played')::boolean, 'noShow', (pn->pid->>'noShow')::boolean,
      'counted', counted, 'subFor', sub_for->>pid, 'subbedBy', subbed->>pid, 'mult', mult,
      'base', (pn->pid->>'pts')::int, 'pts', pts, 'items', pn->pid->'items'));
  end loop;
  return jsonb_build_object('total', total, 'transferCost', tc, 'captain', eff, 'players', players);
end $$;

-- Price by form (mirror: priceFromForm). p_form = newest first.
create or replace function public.fantasy_v2_price(p_form numeric[], p_base numeric, p_scale numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case when coalesce(cardinality(f), 0) = 0 then p_base
    else greatest((public.fantasy_v2_rules()->>'priceMin')::numeric,
                  round(p_base + ((select sum(x) from unnest(f) x) * p_scale) / cardinality(f))) end
  from (select (p_form)[1:(public.fantasy_v2_rules()->>'priceForm')::int] as f) q;
$$;

create or replace function public.fantasy_ownership_cap(p_participants int)
returns int language sql immutable set search_path = '' as $$
  select greatest(2, ceil(coalesce(p_participants, 0) / 2.0))::int;
$$;

-- Transfers since the last lock (mirror: transferState + nextFreeTransfers).
create or replace function public.fantasy_v2_transfer(p_locked text[], p_current text[], p_free int)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  r jsonb := public.fantasy_v2_rules();
  per int := (r->>'freeTransfersPerRound')::int;
  made int; f int; extra int;
begin
  if p_locked is null then
    return jsonb_build_object('unlimited', true, 'made', 0, 'extra', 0, 'cost', 0, 'nextFree', per);
  end if;
  made := (select count(distinct x)::int from unnest(coalesce(p_current, '{}')) x where x is not null and not (x = any(p_locked)));
  f := greatest(0, coalesce(p_free, per));
  extra := greatest(0, made - f);
  return jsonb_build_object('unlimited', false, 'made', made, 'extra', extra,
    'cost', extra * (r->>'transferCost')::int,
    'nextFree', least((r->>'maxBankedTransfers')::int, greatest(0, f - made) + per));
end $$;

-- ═════════ 2. Schema ═════════

alter table public.fantasy_leagues
  add column if not exists mode text not null default 'classic',
  add column if not exists rules_version int not null default 1,
  add column if not exists v2_started_at timestamptz,
  add column if not exists archived_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fantasy_leagues_mode_check') then
    alter table public.fantasy_leagues add constraint fantasy_leagues_mode_check check (mode in ('classic', 'draft'));
  end if;
end $$;

alter table public.fantasy_squads
  add column if not exists vice_captain_id uuid references public.players(id) on delete set null,
  add column if not exists free_transfers int not null default 1,
  add column if not exists locked_player_ids uuid[];

create table if not exists public.fantasy_rounds (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.fantasy_leagues(id) on delete cascade,
  game_id      uuid references public.games(id) on delete set null,
  kickoff_at   timestamptz not null,
  locked_at    timestamptz not null default now(),
  matchday_id  uuid unique references public.matchdays(id) on delete cascade,
  status       text not null default 'locked' check (status in ('locked', 'scored', 'void')),
  scored_at    timestamptz,
  revision     int not null default 0,
  created_at   timestamptz not null default now(),
  unique (league_id, kickoff_at)
);
create index if not exists fantasy_rounds_league_idx on public.fantasy_rounds (league_id, kickoff_at desc);

create table if not exists public.fantasy_round_lineups (
  round_id         uuid not null references public.fantasy_rounds(id) on delete cascade,
  participant_id   uuid not null references public.players(id) on delete cascade,
  starter_ids      uuid[] not null default '{}',
  bench_ids        uuid[] not null default '{}',
  captain_id       uuid,
  vice_captain_id  uuid,
  transfers_made   int not null default 0,
  free_transfers   int,            -- available that round; null = unlimited (first lock)
  transfer_cost    int not null default 0,
  created_at       timestamptz not null default now(),
  primary key (round_id, participant_id)
);

create table if not exists public.fantasy_round_players (
  round_id    uuid not null references public.fantasy_rounds(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  points      int not null default 0,
  breakdown   jsonb not null default '{}'::jsonb,
  primary key (round_id, player_id)
);

create table if not exists public.fantasy_seasons (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.fantasy_leagues(id) on delete cascade,
  kind          text not null check (kind in ('month', 'season', 'legacy')),
  label         text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'open' check (status in ('open', 'closed')),
  standings     jsonb,
  champion_ids  uuid[] not null default '{}',
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (league_id, kind, starts_at)
);
create index if not exists fantasy_seasons_open_idx on public.fantasy_seasons (status, ends_at);

create table if not exists public.fantasy_trophies (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  league_id   uuid not null references public.fantasy_leagues(id) on delete cascade,
  season_id   uuid not null references public.fantasy_seasons(id) on delete cascade,
  kind        text not null check (kind in ('month', 'season', 'legacy')),
  rank        int not null check (rank between 1 and 3),
  points      numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (season_id, player_id)
);
create index if not exists fantasy_trophies_player_idx on public.fantasy_trophies (player_id);

alter table public.fantasy_scores
  add column if not exists round_id uuid references public.fantasy_rounds(id) on delete cascade,
  add column if not exists vice_captain_id uuid,
  add column if not exists breakdown jsonb,
  add column if not exists transfer_cost int not null default 0,
  add column if not exists revision int not null default 0,
  add column if not exists updated_at timestamptz default now();

-- RLS + explicit grants (Supabase stops auto-granting on 2026-10-30).
do $$
declare t text;
begin
  foreach t in array array['fantasy_rounds', 'fantasy_round_lineups', 'fantasy_round_players', 'fantasy_seasons', 'fantasy_trophies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists "%s select" on public.%I', t, t);
    execute format('create policy "%s select" on public.%I for select using (auth.uid() is not null)', t, t);
  end loop;
end $$;

-- Direct writes that bypass the rules: gone. Squads only via
-- save_fantasy_squad / accept_fantasy_trade; scores only via the server.
drop policy if exists "fs insert" on public.fantasy_squads;
drop policy if exists "fs update" on public.fantasy_squads;
drop policy if exists "fs delete" on public.fantasy_squads;
create policy "fs delete" on public.fantasy_squads for delete using (public.is_admin());
drop policy if exists "fsc insert" on public.fantasy_scores;
drop policy if exists "fsc update" on public.fantasy_scores;
drop policy if exists "fsc delete" on public.fantasy_scores;
revoke insert, update on public.fantasy_squads from anon, authenticated;
revoke insert, update, delete on public.fantasy_scores from anon, authenticated;

do $$ begin alter publication supabase_realtime add table fantasy_rounds;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table fantasy_seasons; exception when others then null; end $$;

-- ═════════ 3. Seasons (Europe/Lisbon) ═════════

create or replace function public.fantasy_period(p_kind text, p_at timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, label text)
language plpgsql stable set search_path = '' as $$
declare loc timestamp := p_at at time zone 'Europe/Lisbon'; y int; s timestamp;
begin
  if p_kind = 'month' then
    s := date_trunc('month', loc);
    return query select s at time zone 'Europe/Lisbon', (s + interval '1 month') at time zone 'Europe/Lisbon', to_char(s, 'YYYY-MM');
  else
    y := extract(year from loc)::int - case when extract(month from loc) >= 8 then 0 else 1 end;
    s := make_timestamp(y, 8, 1, 0, 0, 0);
    return query select s at time zone 'Europe/Lisbon', (s + interval '1 year') at time zone 'Europe/Lisbon',
      y::text || '/' || lpad(((y + 1) % 100)::text, 2, '0');
  end if;
end $$;

create or replace function public.fantasy_season_standings(p_season uuid)
returns table (participant_id uuid, points numeric, rounds int, rank int)
language sql stable security definer set search_path = public as $$
  select sc.participant_id, sum(sc.points), count(*)::int, (rank() over (order by sum(sc.points) desc))::int
  from public.fantasy_seasons s
  join public.fantasy_rounds r on r.league_id = s.league_id and r.status = 'scored'
   and r.kickoff_at >= s.starts_at and r.kickoff_at < s.ends_at
  join public.fantasy_scores sc on sc.round_id = r.id
  where s.id = p_season
  group by sc.participant_id;
$$;

create or replace function public.fantasy_close_season(p_season uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.fantasy_seasons;
begin
  select * into s from public.fantasy_seasons where id = p_season for update;
  if s.id is null or s.status = 'closed' then return; end if;
  update public.fantasy_seasons set
    status = 'closed', closed_at = now(),
    standings = (select coalesce(jsonb_agg(jsonb_build_object('participant_id', x.participant_id, 'points', x.points,
                   'rounds', x.rounds, 'rank', x.rank) order by x.rank, x.participant_id), '[]'::jsonb)
                 from public.fantasy_season_standings(p_season) x),
    champion_ids = (select coalesce(array_agg(x.participant_id order by x.participant_id), '{}')
                    from public.fantasy_season_standings(p_season) x where x.rank = 1)
  where id = p_season;
  insert into public.fantasy_trophies (player_id, league_id, season_id, kind, rank, points)
  select x.participant_id, s.league_id, s.id, s.kind, x.rank, x.points
  from public.fantasy_season_standings(p_season) x where x.rank <= 3
  on conflict (season_id, player_id) do nothing;
end $$;

-- Every active league always has one open Taça do Mês + one open Campeonato.
create or replace function public.fantasy_ensure_seasons(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k text; per record;
begin
  if not exists (select 1 from public.fantasy_leagues where id = p_league and archived_at is null and rules_version >= 2) then return; end if;
  foreach k in array array['month', 'season'] loop
    if not exists (select 1 from public.fantasy_seasons where league_id = p_league and kind = k and status = 'open') then
      select * into per from public.fantasy_period(k, now());
      insert into public.fantasy_seasons (league_id, kind, label, starts_at, ends_at)
      values (p_league, k, per.label, per.starts_at, per.ends_at)
      on conflict (league_id, kind, starts_at) do nothing;
    end if;
  end loop;
end $$;

-- Close finished periods (trophies), open the next ones; squads are kept.
-- A new Campeonato also gives everyone unlimited transfers until their
-- first lock in it.
create or replace function public.fantasy_roll_seasons(p_league uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare s record; per record; n int := 0; active boolean;
begin
  loop
    select * into s from public.fantasy_seasons
     where status = 'open' and kind in ('month', 'season') and ends_at <= now()
       and (p_league is null or league_id = p_league)
     order by ends_at limit 1;
    exit when s.id is null;
    perform public.fantasy_close_season(s.id);
    n := n + 1;
    select (archived_at is null and rules_version >= 2) into active from public.fantasy_leagues where id = s.league_id;
    if coalesce(active, false) then
      select * into per from public.fantasy_period(s.kind, s.ends_at);
      insert into public.fantasy_seasons (league_id, kind, label, starts_at, ends_at)
      values (s.league_id, s.kind, per.label, per.starts_at, per.ends_at)
      on conflict (league_id, kind, starts_at) do nothing;
      if s.kind = 'season' then
        update public.fantasy_squads set locked_player_ids = null, free_transfers = 1 where league_id = s.league_id;
      end if;
    end if;
  end loop;
  for s in select id from public.fantasy_leagues where archived_at is null and rules_version >= 2 and (p_league is null or id = p_league) loop
    perform public.fantasy_ensure_seasons(s.id);
  end loop;
  return n;
end $$;

-- ═════════ 4. Lock at kickoff ═════════

-- Snapshot every squad of a league into a new round. p_account = false is
-- the recovery path (fantasy_recompute): lineups only, no transfer
-- accounting and no squad change.
create or replace function public.fantasy_lock_league(p_league uuid, p_kickoff timestamptz, p_game uuid, p_account boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; s public.fantasy_squads; bench uuid[]; starters uuid[]; tr jsonb;
begin
  insert into public.fantasy_rounds (league_id, game_id, kickoff_at)
  values (p_league, p_game, p_kickoff)
  on conflict (league_id, kickoff_at) do nothing
  returning id into rid;
  if rid is null then
    select id into rid from public.fantasy_rounds where league_id = p_league and kickoff_at = p_kickoff;
    return rid;
  end if;
  if p_account then
    -- A kickoff that never got a matchday (cancelled game) is void: its
    -- transfer cost is never charged.
    update public.fantasy_rounds set status = 'void'
     where league_id = p_league and status = 'locked' and matchday_id is null and id <> rid and kickoff_at < p_kickoff;
  end if;
  for s in select * from public.fantasy_squads where league_id = p_league and coalesce(cardinality(player_ids), 0) > 0 for update loop
    bench := array(select x from unnest(coalesce(s.reserve_ids, '{}')) with ordinality u(x, o) where x = any(s.player_ids) order by o);
    starters := array(select x from unnest(s.player_ids) with ordinality u(x, o) where not (x = any(bench)) order by o);
    tr := case when p_account then public.fantasy_v2_transfer(s.locked_player_ids::text[], s.player_ids::text[], s.free_transfers)
               else '{"made":0,"cost":0}'::jsonb end;
    insert into public.fantasy_round_lineups (round_id, participant_id, starter_ids, bench_ids, captain_id, vice_captain_id,
                                              transfers_made, free_transfers, transfer_cost)
    values (rid, s.participant_id, starters, bench,
            case when s.captain_id = any(starters) then s.captain_id end,
            case when s.vice_captain_id = any(starters) and s.vice_captain_id is distinct from s.captain_id then s.vice_captain_id end,
            (tr->>'made')::int, case when s.locked_player_ids is null then null else s.free_transfers end, (tr->>'cost')::int)
    on conflict (round_id, participant_id) do nothing;
    if p_account then
      update public.fantasy_squads set locked_player_ids = s.player_ids, free_transfers = (tr->>'nextFree')::int where id = s.id;
    end if;
  end loop;
  return rid;
end $$;

-- Lock every active league whose group's game has kicked off and has no
-- round yet (cron + lazily from the RPCs/trigger). Idempotent.
create or replace function public.fantasy_lock_due(p_group uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare l record; g record; n int := 0;
begin
  for l in select * from public.fantasy_leagues
            where archived_at is null and rules_version >= 2 and (p_group is null or group_id = p_group) loop
    select * into g from public.games
     where group_id = l.group_id and status is distinct from 'cancelled'
       and scheduled_at <= now() and scheduled_at >= coalesce(l.v2_started_at, l.created_at)
     order by scheduled_at desc limit 1;
    continue when g.id is null;
    -- Already locked for this kickoff (or a lock-at-commit just before it).
    continue when exists (select 1 from public.fantasy_rounds where league_id = l.id and kickoff_at > g.scheduled_at - interval '20 hours');
    perform public.fantasy_lock_league(l.id, g.scheduled_at, g.id, true);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ═════════ 5. Server scoring ═════════

create or replace function public.fantasy_score_round(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.fantasy_rounds; md public.matchdays; l public.fantasy_leagues; lu public.fantasy_round_lineups;
  night jsonb; podium jsonb; positions jsonb; res jsonb; old numeric; bpp numeric;
begin
  select * into r from public.fantasy_rounds where id = p_round for update;
  if r.id is null or r.matchday_id is null then return; end if;
  select * into md from public.matchdays where id = r.matchday_id;
  select * into l from public.fantasy_leagues where id = r.league_id;
  podium := jsonb_build_object('mvp', md.mvp_id, 'second', md.runner_up_id, 'third', md.third_id);
  night := public.fantasy_v2_night(md.summary);
  positions := (select coalesce(jsonb_object_agg(p.id::text, p.position), '{}'::jsonb) from public.players p
    where p.id::text in (select jsonb_array_elements_text(night->'appeared')
                         union select jsonb_array_elements_text(night->'noShows')
                         union select unnest(x.starter_ids || x.bench_ids)::text from public.fantasy_round_lineups x where x.round_id = p_round));

  delete from public.fantasy_round_players where round_id = p_round;
  insert into public.fantasy_round_players (round_id, player_id, points, breakdown)
  select p_round, p.id, (q.x->>'pts')::int, q.x
  from public.players p
  cross join lateral (select public.fantasy_v2_player_night(night, md.summary, p.id::text, p.position, podium) as x) q
  where p.id::text in (select jsonb_array_elements_text(night->'appeared') union select jsonb_array_elements_text(night->'noShows'));

  bpp := coalesce((l.scoring_weights->>'bankPerPoint')::numeric, 1);
  for lu in select * from public.fantasy_round_lineups where round_id = p_round loop
    res := public.fantasy_v2_score_lineup(jsonb_build_object(
      'starters', to_jsonb(lu.starter_ids::text[]), 'bench', to_jsonb(lu.bench_ids::text[]),
      'captain', lu.captain_id::text, 'vice', lu.vice_captain_id::text, 'transferCost', lu.transfer_cost),
      md.summary, positions, podium);
    old := null;
    select points into old from public.fantasy_scores where matchday_id = md.id and participant_id = lu.participant_id;
    insert into public.fantasy_scores (league_id, matchday_id, participant_id, round_id, player_ids, captain_id, vice_captain_id,
                                       reserve_ids, points, breakdown, transfer_cost, revision, updated_at)
    values (l.id, md.id, lu.participant_id, p_round, lu.starter_ids || lu.bench_ids, lu.captain_id, lu.vice_captain_id,
            lu.bench_ids, (res->>'total')::numeric, res, lu.transfer_cost, 1, now())
    on conflict (matchday_id, participant_id) do update set
      league_id = excluded.league_id, round_id = excluded.round_id, player_ids = excluded.player_ids,
      captain_id = excluded.captain_id, vice_captain_id = excluded.vice_captain_id, reserve_ids = excluded.reserve_ids,
      points = excluded.points, breakdown = excluded.breakdown, transfer_cost = excluded.transfer_cost,
      revision = public.fantasy_scores.revision + 1, updated_at = now();
    if (res->>'total')::numeric - coalesce(old, 0) <> 0 then
      update public.fantasy_squads
         set budget_adjustment = budget_adjustment + ((res->>'total')::numeric - coalesce(old, 0)) * bpp
       where league_id = l.id and participant_id = lu.participant_id;
    end if;
  end loop;
  update public.fantasy_rounds set status = 'scored', scored_at = now(), revision = revision + 1 where id = p_round;
end $$;

-- matchdays INSERT → attach to the latest locked round (or lock at commit)
-- and score; UPDATE of summary/podium → re-score. Never blocks the
-- organizer's write: a failure is a WARNING (fantasy_recompute recovers).
create or replace function public.fantasy_on_matchday()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record; rid uuid; gid uuid;
begin
  begin
    for l in select * from public.fantasy_leagues where group_id = new.group_id and archived_at is null and rules_version >= 2 loop
      rid := null;
      if tg_op = 'INSERT' then
        perform public.fantasy_lock_due(new.group_id);
        select id into rid from public.fantasy_rounds
         where league_id = l.id and status = 'locked' and matchday_id is null order by kickoff_at desc limit 1;
        if rid is null then
          select id into gid from public.games where group_id = new.group_id order by scheduled_at desc limit 1;
          rid := public.fantasy_lock_league(l.id, now(), gid, true);
        end if;
        update public.fantasy_rounds set matchday_id = new.id where id = rid and matchday_id is null;
      else
        select id into rid from public.fantasy_rounds where matchday_id = new.id and league_id = l.id;
        continue when rid is null;
      end if;
      perform public.fantasy_score_round(rid);
    end loop;
  exception when others then
    raise warning 'fantasy scoring failed for matchday %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_fantasy_matchday_ins on public.matchdays;
create trigger trg_fantasy_matchday_ins after insert on public.matchdays
  for each row execute function public.fantasy_on_matchday();
drop trigger if exists trg_fantasy_matchday_upd on public.matchdays;
create trigger trg_fantasy_matchday_upd after update of summary, mvp_id, runner_up_id, third_id on public.matchdays
  for each row when (old.summary is distinct from new.summary or old.mvp_id is distinct from new.mvp_id
                     or old.runner_up_id is distinct from new.runner_up_id or old.third_id is distinct from new.third_id)
  execute function public.fantasy_on_matchday();

-- ═════════ 6. Prices ═════════

create or replace function public.fantasy_price_of(p_league uuid, p_player uuid, p_exclude_round uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select public.fantasy_v2_price(
    array(select rp.points::numeric from public.fantasy_round_players rp
            join public.fantasy_rounds r on r.id = rp.round_id
           where r.league_id = p_league and r.status = 'scored' and rp.player_id = p_player
             and (p_exclude_round is null or r.id <> p_exclude_round)
           order by r.kickoff_at desc limit 3),
    coalesce((select (scoring_weights->>'priceBase')::numeric from public.fantasy_leagues where id = p_league), 20),
    coalesce((select (scoring_weights->>'priceScale')::numeric from public.fantasy_leagues where id = p_league), 1.5));
$$;

create or replace function public.fantasy_is_group_player(p_group uuid, p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players p where p.id = p_player and p.group_id = p_group)
      or exists (select 1 from public.player_group_memberships m where m.player_id = p_player and m.group_id = p_group and not m.banned);
$$;

-- Current price + price before the latest scored round (for ↑/↓).
create or replace function public.fantasy_player_prices(p_league uuid)
returns table (player_id uuid, price numeric, prev_price numeric)
language plpgsql stable security definer set search_path = public as $$
declare gid uuid; last_round uuid;
begin
  select group_id into gid from public.fantasy_leagues where id = p_league;
  if gid is null or not (public.is_group_member(gid) or public.is_admin()) then return; end if;
  select id into last_round from public.fantasy_rounds where league_id = p_league and status = 'scored' order by kickoff_at desc limit 1;
  return query
  select pl.id, public.fantasy_price_of(p_league, pl.id),
         case when last_round is null then null else public.fantasy_price_of(p_league, pl.id, last_round) end
  from public.players pl
  where pl.group_id = gid
     or exists (select 1 from public.player_group_memberships m where m.player_id = pl.id and m.group_id = gid and not m.banned);
end $$;

-- ═════════ 7. RPCs ═════════

-- The only way to change a squad. p_player_ids = everyone owned (order =
-- starters first); p_bench_ids = bench in sub order. Normalises to
-- exactly squad_size starters (extras go to the end of the bench; a short
-- XI is filled from the bench). Raises fantasy:<code>.
create or replace function public.save_fantasy_squad(p_league uuid, p_player_ids uuid[], p_bench_ids uuid[], p_captain_id uuid, p_vice_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_player_id();
  l public.fantasy_leagues; s public.fantasy_squads;
  ids uuid[]; bench uuid[]; starters uuid[]; prev uuid[]; added uuid[];
  x uuid; n int; cap int; paid jsonb; cost numeric; capt uuid; vice uuid;
begin
  if me is null then raise exception 'fantasy:auth'; end if;
  select * into l from public.fantasy_leagues where id = p_league;
  if l.id is null or l.archived_at is not null or l.rules_version < 2 then raise exception 'fantasy:no_league'; end if;
  if not public.fantasy_is_group_player(l.group_id, me) then raise exception 'fantasy:not_member'; end if;
  perform public.fantasy_lock_due(l.group_id);   -- a passed kickoff locks BEFORE this edit
  perform public.fantasy_roll_seasons(l.id);

  ids := array(select u.x from (select distinct on (v) v as x, o from unnest(p_player_ids) with ordinality t(v, o) where v is not null order by v, o) u order by u.o);
  if cardinality(ids) < l.squad_size then raise exception 'fantasy:squad_incomplete'; end if;
  if exists (select 1 from unnest(ids) v where not public.fantasy_is_group_player(l.group_id, v)) then raise exception 'fantasy:not_in_group'; end if;
  bench := array(select u.x from (select distinct on (v) v as x, o from unnest(coalesce(p_bench_ids, '{}')) with ordinality t(v, o)
                                  where v = any(ids) order by v, o) u order by u.o);
  starters := array(select v from unnest(ids) with ordinality t(v, o) where not (v = any(bench)) order by o);
  while cardinality(starters) > l.squad_size loop
    bench := bench || starters[cardinality(starters)];
    starters := starters[1:cardinality(starters) - 1];
  end loop;
  while cardinality(starters) < l.squad_size and cardinality(bench) > 0 loop
    starters := starters || bench[1];
    bench := bench[2:];
  end loop;

  select * into s from public.fantasy_squads where league_id = l.id and participant_id = me for update;
  prev := coalesce(s.player_ids, '{}');
  added := array(select v from unnest(ids) v where not (v = any(prev)));
  if exists (select 1 from public.players p where p.id = any(added) and p.injured) then raise exception 'fantasy:injured'; end if;

  select count(*)::int + 1 into n from public.fantasy_squads
   where league_id = l.id and participant_id <> me and coalesce(cardinality(player_ids), 0) > 0;
  cap := public.fantasy_ownership_cap(n);
  foreach x in array added loop
    if (select count(*) from public.fantasy_squads where league_id = l.id and participant_id <> me and x = any(player_ids)) >= cap then
      raise exception 'fantasy:ownership_cap';
    end if;
  end loop;

  paid := (select coalesce(jsonb_object_agg(v::text, coalesce((s.prices_paid->>(v::text))::numeric, public.fantasy_price_of(l.id, v))), '{}'::jsonb)
           from unnest(ids) v);
  cost := (select coalesce(sum(value::numeric), 0) from jsonb_each_text(paid));
  if cost > l.budget + coalesce(s.budget_adjustment, 0) then raise exception 'fantasy:over_budget'; end if;

  capt := case when p_captain_id = any(starters) then p_captain_id end;
  vice := case when p_vice_id = any(starters) and p_vice_id is distinct from capt then p_vice_id end;

  insert into public.fantasy_squads (league_id, participant_id, player_ids, reserve_ids, captain_id, vice_captain_id, prices_paid, updated_at)
  values (l.id, me, starters || bench, bench, capt, vice, paid, now())
  on conflict (league_id, participant_id) do update set
    player_ids = excluded.player_ids, reserve_ids = excluded.reserve_ids, captain_id = excluded.captain_id,
    vice_captain_id = excluded.vice_captain_id, prices_paid = excluded.prices_paid, reserve_id = null, updated_at = now();
  return jsonb_build_object('player_ids', to_jsonb(starters || bench), 'reserve_ids', to_jsonb(bench),
    'captain_id', capt, 'vice_captain_id', vice, 'prices_paid', paid);
end $$;

-- Same signature as migration 35 (the app keeps calling it the same way),
-- but both squads are now derived here from the offer itself — the
-- client-computed arrays/ledgers are ignored.
create or replace function public.accept_fantasy_trade(
  p_offer_id uuid,
  p_buyer_player_ids uuid[], p_buyer_budget_adjustment numeric, p_buyer_prices_paid jsonb,
  p_seller_player_ids uuid[], p_seller_budget_adjustment numeric, p_seller_prices_paid jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_offer public.fantasy_trade_offers; l public.fantasy_leagues;
  b public.fantasy_squads; sl public.fantasy_squads;
  cash numeric; tgt uuid; give uuid;
  b_ids uuid[]; b_res uuid[]; s_ids uuid[]; s_res uuid[]; b_paid jsonb; s_paid jsonb;
  b_cap uuid; b_vice uuid; s_cap uuid; s_vice uuid; s_start uuid[];
begin
  select o.* into v_offer from public.fantasy_trade_offers o where o.id = p_offer_id;
  if v_offer.id is not null then
    perform public.fantasy_lock_due((select group_id from public.fantasy_leagues where id = v_offer.league_id));
  end if;

  update public.fantasy_trade_offers set status = 'accepted', resolved_at = now()
   where id = p_offer_id and status = 'pending' and to_participant_id = public.my_player_id()
  returning * into v_offer;
  if v_offer.id is null then raise exception 'Esta oferta já não está disponível.'; end if;

  select * into l from public.fantasy_leagues where id = v_offer.league_id;
  select * into b from public.fantasy_squads where league_id = v_offer.league_id and participant_id = v_offer.from_participant_id for update;
  select * into sl from public.fantasy_squads where league_id = v_offer.league_id and participant_id = v_offer.to_participant_id for update;
  if b.id is null or sl.id is null then raise exception 'Escalação não encontrada.'; end if;
  tgt := v_offer.target_player_id; give := v_offer.give_player_id;
  if not (tgt = any(sl.player_ids)) then raise exception 'Esse jogador já não pertence a essa escalação.'; end if;
  if not (give = any(b.player_ids)) then raise exception 'Não tens esse jogador na tua escalação.'; end if;
  if tgt = any(b.player_ids) then raise exception 'Já tens esse jogador.'; end if;
  if v_offer.offer_type = 'swap' and give = any(sl.player_ids) then raise exception 'Esse jogador já está nessa escalação.'; end if;
  if exists (select 1 from public.players where id = tgt and injured) then
    raise exception 'Esse jogador está lesionado — a troca não pode ser aceite.';
  end if;
  cash := case when v_offer.offer_type = 'cash' then greatest(0, coalesce(v_offer.offer_cash, 0)) else 0 end;

  -- Buyer: the target takes the released player's slot (and armband).
  b_ids := array_replace(b.player_ids, give, tgt);
  b_res := array_replace(coalesce(b.reserve_ids, '{}'), give, tgt);
  b_cap := case when b.captain_id = give then tgt else b.captain_id end;
  b_vice := case when b.vice_captain_id = give then tgt else b.vice_captain_id end;
  b_paid := (coalesce(b.prices_paid, '{}'::jsonb) - give::text) || jsonb_build_object(tgt::text, public.fantasy_price_of(l.id, tgt));

  if v_offer.offer_type = 'swap' then
    s_ids := array_replace(sl.player_ids, tgt, give);
    s_res := array_replace(coalesce(sl.reserve_ids, '{}'), tgt, give);
    s_cap := case when sl.captain_id = tgt then give else sl.captain_id end;
    s_vice := case when sl.vice_captain_id = tgt then give else sl.vice_captain_id end;
    s_paid := (coalesce(sl.prices_paid, '{}'::jsonb) - tgt::text) || jsonb_build_object(give::text, public.fantasy_price_of(l.id, give));
  else
    s_ids := array_remove(sl.player_ids, tgt);
    s_res := array_remove(coalesce(sl.reserve_ids, '{}'), tgt);
    s_cap := case when sl.captain_id = tgt then null else sl.captain_id end;
    s_vice := case when sl.vice_captain_id = tgt then null else sl.vice_captain_id end;
    s_paid := coalesce(sl.prices_paid, '{}'::jsonb) - tgt::text;
    -- A short XI is refilled from the front of the bench.
    s_start := array(select v from unnest(s_ids) v where not (v = any(s_res)));
    if cardinality(s_start) < l.squad_size and cardinality(s_res) > 0 then s_res := s_res[2:]; end if;
  end if;

  if l.budget + b.budget_adjustment - cash - (select coalesce(sum(value::numeric), 0) from jsonb_each_text(b_paid)) < 0 then
    raise exception 'O comprador não tem banco suficiente para esta troca.';
  end if;
  if l.budget + sl.budget_adjustment + cash - (select coalesce(sum(value::numeric), 0) from jsonb_each_text(s_paid)) < 0 then
    raise exception 'Isto deixaria o teu banco negativo.';
  end if;

  update public.fantasy_squads set player_ids = b_ids, reserve_ids = b_res, captain_id = b_cap, vice_captain_id = b_vice,
    prices_paid = b_paid, budget_adjustment = budget_adjustment - cash, updated_at = now() where id = b.id;
  update public.fantasy_squads set player_ids = s_ids, reserve_ids = s_res, captain_id = s_cap, vice_captain_id = s_vice,
    prices_paid = s_paid, budget_adjustment = budget_adjustment + cash, updated_at = now() where id = sl.id;
end $$;

-- Organizer/admin "Recalcular": lock what is due, roll seasons, attach
-- any matchday that missed its round (lineups = current squads, no
-- transfer accounting — the only data left) and re-score every round.
create or replace function public.fantasy_recompute(p_league uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.fantasy_leagues; md record; rid uuid; attached int := 0; rescored int := 0; r record;
begin
  select * into l from public.fantasy_leagues where id = p_league;
  if l.id is null then raise exception 'fantasy:no_league'; end if;
  if not (public.can_manage_group(l.group_id) or public.is_admin()) then raise exception 'fantasy:not_allowed'; end if;
  perform public.fantasy_roll_seasons(l.id);
  perform public.fantasy_lock_due(l.group_id);
  for md in select m.* from public.matchdays m
             where m.group_id = l.group_id and m.created_at >= coalesce(l.v2_started_at, l.created_at)
               and not exists (select 1 from public.fantasy_rounds fr where fr.matchday_id = m.id)
             order by m.created_at loop
    rid := null;
    select id into rid from public.fantasy_rounds
     where league_id = l.id and matchday_id is null and status in ('locked', 'void')
       and kickoff_at <= md.created_at and kickoff_at > md.created_at - interval '2 days'
     order by kickoff_at desc limit 1;
    if rid is null then rid := public.fantasy_lock_league(l.id, md.created_at, null, false); end if;
    update public.fantasy_rounds set matchday_id = md.id, status = 'locked' where id = rid and matchday_id is null;
    attached := attached + 1;
  end loop;
  for r in select id from public.fantasy_rounds where league_id = l.id and matchday_id is not null order by kickoff_at loop
    perform public.fantasy_score_round(r.id);
    rescored := rescored + 1;
  end loop;
  return jsonb_build_object('attached', attached, 'rescored', rescored);
end $$;

create or replace function public.fantasy_tick()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fantasy_lock_due(null);
  perform public.fantasy_roll_seasons(null);
end $$;

-- ═════════ 8. Restart of the existing leagues (idempotent) ═════════

do $$
declare l record; sid uuid;
begin
  for l in select * from public.fantasy_leagues where rules_version < 2 order by created_at loop
    sid := null;
    insert into public.fantasy_seasons (league_id, kind, label, starts_at, ends_at, status, standings, champion_ids, closed_at)
    select l.id, 'legacy', 'Temporada 1', coalesce(l.starts_at, l.created_at, now()), now(), 'closed',
           coalesce(jsonb_agg(jsonb_build_object('participant_id', x.participant_id, 'points', x.points, 'rounds', x.rounds, 'rank', x.rk)
                              order by x.rk, x.participant_id), '[]'::jsonb),
           coalesce(array_agg(x.participant_id order by x.participant_id) filter (where x.rk = 1), '{}'), now()
    from (select participant_id, sum(points) as points, count(*)::int as rounds, (rank() over (order by sum(points) desc))::int as rk
          from public.fantasy_scores where league_id = l.id and round_id is null group by participant_id) x
    on conflict (league_id, kind, starts_at) do nothing
    returning id into sid;
    if sid is not null then
      insert into public.fantasy_trophies (player_id, league_id, season_id, kind, rank, points)
      select x.participant_id, l.id, sid, 'legacy', x.rk, x.points
      from (select participant_id, sum(points) as points, (rank() over (order by sum(points) desc))::int as rk
            from public.fantasy_scores where league_id = l.id and round_id is null group by participant_id) x
      where x.rk <= 3
      on conflict (season_id, player_id) do nothing;
    end if;
    update public.fantasy_squads set player_ids = '{}', reserve_ids = '{}', reserve_id = null, captain_id = null,
      vice_captain_id = null, formation_order = null, prices_paid = '{}'::jsonb, budget_adjustment = 0,
      locked_player_ids = null, free_transfers = 1, updated_at = now()
     where league_id = l.id;
    update public.fantasy_trade_offers set status = 'cancelled', resolved_at = now() where league_id = l.id and status = 'pending';
    update public.fantasy_leagues set rules_version = 2, mode = 'classic', v2_started_at = now(),
      archived_at = case when exists (select 1 from public.fantasy_leagues n where n.group_id = l.group_id and n.created_at > l.created_at)
                         then now() else null end
     where id = l.id;
  end loop;
  for l in select id from public.fantasy_leagues where archived_at is null and rules_version >= 2 loop
    perform public.fantasy_ensure_seasons(l.id);
  end loop;
end $$;

alter table public.fantasy_leagues alter column rules_version set default 2;
alter table public.fantasy_leagues alter column v2_started_at set default now();

-- ═════════ 9. League guards ═════════

-- New leagues are always v2 / classic for now (Draft = Phase C) and
-- archive the group's previous league (closing its open seasons).
create or replace function public.fantasy_league_before_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.mode = 'draft' then raise exception 'fantasy:draft_soon'; end if;
  new.rules_version := 2; new.v2_started_at := now(); new.archived_at := null;
  return new;
end $$;

create or replace function public.fantasy_league_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select fs.id from public.fantasy_seasons fs join public.fantasy_leagues fl on fl.id = fs.league_id
            where fl.group_id = new.group_id and fl.id <> new.id and fl.archived_at is null and fs.status = 'open' loop
    perform public.fantasy_close_season(s.id);
  end loop;
  update public.fantasy_leagues set archived_at = now() where group_id = new.group_id and id <> new.id and archived_at is null;
  perform public.fantasy_ensure_seasons(new.id);
  return new;
end $$;

-- Organizers keep editing name/budget/squad size/weights through RLS,
-- but never the v2 bookkeeping columns.
create or replace function public.fantasy_league_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.rules_version := old.rules_version; new.v2_started_at := old.v2_started_at;
    new.archived_at := old.archived_at; new.mode := old.mode; new.group_id := old.group_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_fantasy_league_bi on public.fantasy_leagues;
create trigger trg_fantasy_league_bi before insert on public.fantasy_leagues for each row execute function public.fantasy_league_before_insert();
drop trigger if exists trg_fantasy_league_ai on public.fantasy_leagues;
create trigger trg_fantasy_league_ai after insert on public.fantasy_leagues for each row execute function public.fantasy_league_after_insert();
drop trigger if exists trg_fantasy_league_bu on public.fantasy_leagues;
create trigger trg_fantasy_league_bu before update on public.fantasy_leagues for each row execute function public.fantasy_league_before_update();

-- ═════════ 10. Function privileges ═════════

do $$
declare f text;
begin
  -- Pure rules: harmless, callable by signed-in users (previews / checks).
  foreach f in array array[
    'public.fantasy_v2_rules()', 'public.fantasy_v2_pos(text)', 'public.fantasy_v2_int(jsonb)', 'public.fantasy_v2_arr(jsonb)',
    'public.fantasy_v2_night(jsonb)', 'public.fantasy_v2_player_night(jsonb,jsonb,text,text,jsonb)',
    'public.fantasy_v2_score_lineup(jsonb,jsonb,jsonb,jsonb)', 'public.fantasy_v2_price(numeric[],numeric,numeric)',
    'public.fantasy_ownership_cap(int)', 'public.fantasy_v2_transfer(text[],text[],int)', 'public.fantasy_period(text,timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- RPCs for the app.
  foreach f in array array[
    'public.save_fantasy_squad(uuid,uuid[],uuid[],uuid,uuid)',
    'public.accept_fantasy_trade(uuid,uuid[],numeric,jsonb,uuid[],numeric,jsonb)',
    'public.fantasy_recompute(uuid)', 'public.fantasy_player_prices(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Internal machinery: server only (cron / triggers / the RPCs above).
  foreach f in array array[
    'public.fantasy_season_standings(uuid)', 'public.fantasy_close_season(uuid)', 'public.fantasy_ensure_seasons(uuid)',
    'public.fantasy_roll_seasons(uuid)', 'public.fantasy_lock_league(uuid,timestamptz,uuid,boolean)', 'public.fantasy_lock_due(uuid)',
    'public.fantasy_score_round(uuid)', 'public.fantasy_on_matchday()', 'public.fantasy_price_of(uuid,uuid,uuid)',
    'public.fantasy_is_group_player(uuid,uuid)', 'public.fantasy_tick()',
    'public.fantasy_league_before_insert()', 'public.fantasy_league_after_insert()', 'public.fantasy_league_before_update()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ═════════ 11. Cron: lock + season roll every 5 minutes ═════════

select cron.unschedule('pitch-fantasy-tick') where exists (select 1 from cron.job where jobname = 'pitch-fantasy-tick');
select cron.schedule('pitch-fantasy-tick', '*/5 * * * *', $$ select public.fantasy_tick(); $$);
