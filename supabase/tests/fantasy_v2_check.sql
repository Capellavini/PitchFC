-- ─────────────────────────────────────────────────────────
-- PITCH Fantasy v2 (Phase A "Fundação") — check for
-- 20261019180559_fantasy_v2_foundation.sql.
-- Same contract as the other supabase/tests/*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
--
-- Rule: an RPC is never called in the same statement that reads its
-- effects (the statement snapshot would make the read stale) — every
-- write is its own statement, the check comes after.
--
-- Section R reads REAL data (run right after CI applied the migration):
-- the restart of the existing leagues.
-- Section V runs the SHARED VECTORS (src/lib/core/fixtures/
-- fantasyVectors.json, embedded below byte-for-byte — npm test fails if
-- they drift) through the plpgsql rules.
--
-- Fixture (group G): 01 organizer · 02/03/04 managers · 09 admin;
-- real players g1 d1 d2 d3 m1 m2 m3 a1 a2 a3 (ids as in the vectors).
-- Time travel is done as the migration owner (league v2_started_at,
-- game kickoffs, season windows) — never through the app's roles.
-- ─────────────────────────────────────────────────────────
begin;

create temp table _f (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _f_kv (k text primary key, v text) on commit drop;
grant all on _f, _f_kv to authenticated, anon, service_role;
grant usage on sequence _f_n_seq to authenticated, anon, service_role;
create function pg_temp.ok(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into _f (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail); $$;
create function pg_temp.expect_err(p_name text, p_sql text, p_needle text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into _f (check_name, ok, detail) values (p_name, false, 'no error raised');
exception when others then
  insert into _f (check_name, ok, detail) values (p_name, position(p_needle in sqlerrm) > 0, sqlerrm);
end $$;
create function pg_temp.kv(p_k text) returns text language sql stable as $$ select v from _f_kv where k = p_k; $$;
create function pg_temp.k(p_k text) returns uuid language sql stable as $$ select v::uuid from _f_kv where k = p_k; $$;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select v::uuid from _f_kv where k = 'id:' || p; $$;
create function pg_temp.as_user(p_nn text) returns void language sql as $$
  select set_config('request.jwt.claims',
    format('{"sub":"00000000-0000-0000-0000-0000000f01%s","role":"authenticated","email":"%s"}', p_nn,
           case when p_nn = '09' then 'capella.vinicius@gmail.com' else 'fv2-' || p_nn || '@example.test' end), true); $$;
create function pg_temp.mgr(p_nn text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000f02' || p_nn)::uuid; $$;
-- Vector ids ("g1", "a1"…) → fixture uuids, inside any jsonb.
create function pg_temp.map(p jsonb) returns jsonb language plpgsql stable as $$
declare t text := p::text; r record;
begin
  for r in select k, v from _f_kv where k like 'id:%' loop
    t := replace(t, '"' || substr(r.k, 4) || '"', '"' || r.v || '"');
  end loop;
  return t::jsonb;
end $$;
create function pg_temp.score(p_md text, p_mgr text) returns numeric language sql stable as $$
  select points from public.fantasy_scores where matchday_id = pg_temp.k(p_md) and participant_id = pg_temp.mgr(p_mgr); $$;
create function pg_temp.lineup(p_round text, p_mgr text) returns public.fantasy_round_lineups language sql stable as $$
  select * from public.fantasy_round_lineups where round_id = pg_temp.k(p_round) and participant_id = pg_temp.mgr(p_mgr); $$;
create function pg_temp.squad(p_mgr text) returns public.fantasy_squads language sql stable as $$
  select * from public.fantasy_squads where league_id = pg_temp.k('L') and participant_id = pg_temp.mgr(p_mgr); $$;
grant execute on all functions in schema pg_temp to public;

-- VECTORS:BEGIN
insert into _f_kv (k, v) values ('vectors', $vec${
  "positions": {
    "g1": "Guarda-redes", "d1": "Defesa", "d2": "Defesa", "d3": "Defesa", "d4": "Defesa",
    "m1": "Médio", "m2": "Médio", "m3": "Médio",
    "a1": "Avançado", "a2": "Avançado", "a3": "Avançado",
    "k1": "Avançado", "k2": "Guarda-redes", "k3": "Médio",
    "p1": "Defesa", "p2": "Guarda-redes"
  },
  "summaries": {
    "nightA": {
      "teamResults": [
        { "name": "Coletes", "wins": 1, "players": ["g1", "d1", "m1", "a1", "a3"] },
        { "name": "Sem coletes", "wins": 1, "players": ["m2", "d2", "a2"] }
      ],
      "matches": [
        { "n": 1, "homeName": "Coletes", "awayName": "Sem coletes", "homeGoals": 3, "awayGoals": 0, "homeGk": "g1", "awayGk": "m2",
          "events": [
            { "side": "h", "type": "goal", "by": "a1", "ast": "m1" },
            { "side": "h", "type": "save", "by": "g1" },
            { "side": "h", "type": "goal", "by": "a1", "ast": "d1" },
            { "side": "a", "type": "save", "by": "m2" },
            { "side": "h", "type": "goal", "by": "a1" }
          ] },
        { "n": 2, "homeName": "Coletes", "awayName": "Sem coletes", "homeGoals": 1, "awayGoals": 2, "homeGk": "g1", "awayGk": "m2",
          "events": [
            { "side": "a", "type": "og", "by": "d1" },
            { "side": "a", "type": "goal", "by": "a2", "ast": "d2" },
            { "side": "h", "type": "goal", "by": "m1" }
          ] },
        { "n": 3, "homeName": "Coletes", "awayName": "Sem coletes", "homeGoals": 0, "awayGoals": 0, "homeGk": "g1", "awayGk": "m2",
          "events": [ { "side": "a", "type": "save", "by": "d2" } ] }
      ],
      "lines": [
        { "key": "a1", "goals": 3, "assists": 0 },
        { "key": "m1", "goals": 1, "assists": 1 },
        { "key": "d1", "goals": 0, "assists": 1 },
        { "key": "a2", "goals": 1, "assists": 0 },
        { "key": "d2", "goals": 0, "assists": 1, "epicSaves": 1 },
        { "key": "g1", "goals": 0, "assists": 0, "epicSaves": 1 },
        { "key": "m2", "goals": 0, "assists": 0, "epicSaves": 1 }
      ],
      "candidates": [
        { "key": "g1" }, { "key": "d1" }, { "key": "m1" }, { "key": "a1" }, { "key": "a3" },
        { "key": "m2" }, { "key": "d2" }, { "key": "a2" }, { "key": "m3" }
      ]
    },
    "legacy": {
      "teamResults": [ { "name": "A", "wins": 1 }, { "name": "B", "wins": 0 } ],
      "matches": [ { "n": 1, "homeName": "A", "awayName": "B", "homeGoals": 2, "awayGoals": 0 } ],
      "lines": [ { "key": "k1", "goals": 2, "assists": 0 }, { "key": "k2", "goals": 0, "epicSaves": 2 } ],
      "candidates": [ { "key": "k1" }, { "key": "k2" }, { "key": "k3" } ]
    },
    "dupNames": {
      "teamResults": [ { "name": "X", "players": ["p1"] }, { "name": "X", "players": ["p2"] } ],
      "matches": [ { "n": 1, "homeName": "X", "awayName": "X", "homeGoals": 1, "awayGoals": 0,
        "events": [ { "side": "h", "type": "goal", "by": "p1" } ] } ],
      "lines": [ { "key": "p1", "goals": 1 } ],
      "candidates": [ { "key": "p1" }, { "key": "p2" } ]
    }
  },
  "nights": [
    { "name": "night A: every rule, no podium", "summary": "nightA", "podium": {},
      "expected": { "g1": 14, "d1": 11, "m1": 14, "a1": 18, "a3": 3, "m2": 10, "d2": 12, "a2": 7, "m3": -3, "d3": 0 } },
    { "name": "night A: MVP podium 10/6/3", "summary": "nightA", "podium": { "mvp": "a1", "second": "g1", "third": "d2" },
      "expected": { "a1": 28, "g1": 20, "d2": 15, "m1": 14 } },
    { "name": "legacy summary: no events, no rosters", "summary": "legacy", "podium": {},
      "expected": { "k1": 10, "k2": 8, "k3": 2 } },
    { "name": "duplicate team names: no CS/win attributed", "summary": "dupNames", "podium": {},
      "expected": { "p1": 9, "p2": 2 } }
  ],
  "lineups": [
    { "name": "plain lineup, captain x2, bench scores 0", "summary": "nightA", "podium": {},
      "lineup": { "starters": ["g1", "d1", "m1", "a1", "a2"], "bench": ["a3"], "captain": "a1", "vice": "m1", "transferCost": 0 },
      "expected": { "total": 82, "transferCost": 0, "captain": "a1", "subs": {},
        "players": { "g1": 14, "d1": 11, "m1": 14, "a1": 36, "a2": 7, "a3": 0 } } },
    { "name": "auto-sub by bench order + vice inherits x2 + transfer cost", "summary": "nightA", "podium": {},
      "lineup": { "starters": ["g1", "d1", "m3", "a1", "d3"], "bench": ["d4", "a3", "m2"], "captain": "m3", "vice": "a1", "transferCost": 8 },
      "expected": { "total": 66, "transferCost": 8, "captain": "a1", "subs": { "a3": "m3", "m2": "d3" },
        "players": { "g1": 14, "d1": 11, "m3": 0, "a1": 36, "d3": 0, "d4": 0, "a3": 3, "m2": 10 } } },
    { "name": "no bench: no-show -3 stays, captain and vice absent so no x2", "summary": "nightA", "podium": {},
      "lineup": { "starters": ["m3", "d3", "g1"], "bench": [], "captain": "d3", "vice": "m3", "transferCost": 0 },
      "expected": { "total": 11, "transferCost": 0, "captain": null, "subs": {},
        "players": { "m3": -3, "d3": 0, "g1": 14 } } },
    { "name": "MVP podium, captain doubles the bonus", "summary": "nightA", "podium": { "mvp": "a1", "second": "g1", "third": "d2" },
      "lineup": { "starters": ["a1", "g1", "d2"], "bench": [], "captain": "a1", "vice": "g1", "transferCost": 0 },
      "expected": { "total": 91, "transferCost": 0, "captain": "a1", "subs": {},
        "players": { "a1": 56, "g1": 20, "d2": 15 } } },
    { "name": "podium player on the bench (not needed) scores 0", "summary": "nightA", "podium": { "mvp": "a1" },
      "lineup": { "starters": ["a2"], "bench": ["a1"], "captain": "a2", "vice": null, "transferCost": 0 },
      "expected": { "total": 14, "transferCost": 0, "captain": "a2", "subs": {},
        "players": { "a2": 14, "a1": 0 } } },
    { "name": "legacy summary lineup", "summary": "legacy", "podium": {},
      "lineup": { "starters": ["k1", "k2", "k3"], "bench": [], "captain": "k2", "vice": null, "transferCost": 0 },
      "expected": { "total": 28, "transferCost": 0, "captain": "k2", "subs": {},
        "players": { "k1": 10, "k2": 16, "k3": 2 } } },
    { "name": "duplicate names lineup, no captain", "summary": "dupNames", "podium": {},
      "lineup": { "starters": ["p1", "p2"], "bench": [], "captain": null, "vice": null, "transferCost": 0 },
      "expected": { "total": 11, "transferCost": 0, "captain": null, "subs": {},
        "players": { "p1": 9, "p2": 2 } } }
  ],
  "prices": [
    { "form": [10, 4, 7, 1], "base": 20, "scale": 1.5, "expected": 31 },
    { "form": [], "base": 20, "scale": 1.5, "expected": 20 },
    { "form": [-3, -3], "base": 20, "scale": 1.5, "expected": 16 },
    { "form": [-20, -20, -20], "base": 20, "scale": 1.5, "expected": 5 },
    { "form": [2], "base": 20, "scale": 1.5, "expected": 23 },
    { "form": [1, 0, 0], "base": 20, "scale": 1.5, "expected": 21 },
    { "form": [0, 0, 0, 99], "base": 20, "scale": 1.5, "expected": 20 }
  ],
  "ownershipCap": [ [0, 2], [1, 2], [3, 2], [4, 2], [5, 3], [6, 3], [11, 6] ],
  "transfers": [
    { "locked": null, "current": ["a", "b"], "free": 1, "expected": { "made": 0, "cost": 0, "nextFree": 1 } },
    { "locked": ["a", "b", "c"], "current": ["a", "b", "d"], "free": 1, "expected": { "made": 1, "cost": 0, "nextFree": 1 } },
    { "locked": ["a", "b", "c"], "current": ["d", "e", "c"], "free": 1, "expected": { "made": 2, "cost": 4, "nextFree": 1 } },
    { "locked": ["a", "b", "c"], "current": ["a", "b", "c"], "free": 1, "expected": { "made": 0, "cost": 0, "nextFree": 2 } },
    { "locked": ["a", "b", "c"], "current": ["a", "b", "c"], "free": 2, "expected": { "made": 0, "cost": 0, "nextFree": 2 } },
    { "locked": ["a", "b", "c"], "current": ["d", "e", "f"], "free": 2, "expected": { "made": 3, "cost": 4, "nextFree": 1 } }
  ]
}$vec$);
-- VECTORS:END

-- ── 0. Grants / RLS / triggers / cron ────────────────────
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['fantasy_rounds','fantasy_round_lineups','fantasy_round_players','fantasy_seasons','fantasy_trophies']) t;
select pg_temp.ok(t || ': authenticated can SELECT but not write',
       has_table_privilege('authenticated', 'public.' || t, 'SELECT') and not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['fantasy_rounds','fantasy_round_lineups','fantasy_round_players','fantasy_seasons','fantasy_trophies']) t;
select pg_temp.ok(t || ': service_role full access',
       has_table_privilege('service_role', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE')
   and has_table_privilege('service_role', 'public.' || t, 'INSERT') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['fantasy_rounds','fantasy_round_lineups','fantasy_round_players','fantasy_seasons','fantasy_trophies']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['fantasy_rounds','fantasy_round_lineups','fantasy_round_players','fantasy_seasons','fantasy_trophies','fantasy_scores']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('fantasy_squads: authenticated cannot INSERT/UPDATE (direct writes revoked)',
  not has_table_privilege('authenticated', 'public.fantasy_squads', 'INSERT') and not has_table_privilege('authenticated', 'public.fantasy_squads', 'UPDATE'));
select pg_temp.ok('fantasy_squads: only SELECT + admin DELETE policies',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fantasy_squads' and cmd not in ('SELECT', 'DELETE'))
  and (select qual from pg_policies where schemaname = 'public' and tablename = 'fantasy_squads' and cmd = 'DELETE') like '%is_admin()%');
select pg_temp.ok('fantasy_scores: authenticated cannot INSERT/UPDATE/DELETE',
  not has_table_privilege('authenticated', 'public.fantasy_scores', 'INSERT')
  and not has_table_privilege('authenticated', 'public.fantasy_scores', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.fantasy_scores', 'DELETE'));
select pg_temp.ok('execute ' || f || ' as anon = false', not has_function_privilege('anon', f, 'EXECUTE'))
from unnest(array['public.save_fantasy_squad(uuid,uuid[],uuid[],uuid,uuid)', 'public.fantasy_recompute(uuid)',
                  'public.fantasy_player_prices(uuid)', 'public.accept_fantasy_trade(uuid,uuid[],numeric,jsonb,uuid[],numeric,jsonb)']) f;
select pg_temp.ok('execute ' || f || ' as authenticated = false (internal)', not has_function_privilege('authenticated', f, 'EXECUTE'))
from unnest(array['public.fantasy_score_round(uuid)', 'public.fantasy_lock_league(uuid,timestamptz,uuid,boolean)',
                  'public.fantasy_lock_due(uuid)', 'public.fantasy_roll_seasons(uuid)', 'public.fantasy_close_season(uuid)',
                  'public.fantasy_tick()', 'public.fantasy_price_of(uuid,uuid,uuid)']) f;
select pg_temp.ok('matchday triggers installed (insert + update)',
  (select count(*) = 2 from pg_trigger where tgrelid = 'public.matchdays'::regclass and tgname in ('trg_fantasy_matchday_ins', 'trg_fantasy_matchday_upd') and not tgisinternal));
select pg_temp.ok('cron job pitch-fantasy-tick every 5 minutes',
  exists (select 1 from cron.job where jobname = 'pitch-fantasy-tick' and schedule = '*/5 * * * *'));

-- ── R. Real data: restart of the existing leagues ────────
select pg_temp.ok('R every league is on rules v2', not exists (select 1 from public.fantasy_leagues where rules_version < 2),
  (select count(*) || ' league(s)' from public.fantasy_leagues));
select pg_temp.ok('R at most one active league per group',
  not exists (select 1 from public.fantasy_leagues where archived_at is null group by group_id having count(*) > 1));
select pg_temp.ok('R every league that had legacy scores has its legacy season closed',
  not exists (select 1 from public.fantasy_scores sc where sc.round_id is null
              and not exists (select 1 from public.fantasy_seasons s where s.league_id = sc.league_id and s.kind = 'legacy' and s.status = 'closed')));
select pg_temp.ok('R legacy champion(s) = every participant tied on the most legacy points',
  coalesce(bool_and(s.champion_ids = coalesce((
    select array_agg(x.participant_id order by x.participant_id) from (
      select participant_id, rank() over (order by sum(points) desc) rk from public.fantasy_scores
       where league_id = s.league_id and round_id is null group by participant_id) x where x.rk = 1), '{}')), true),
  (select count(*) || ' legacy season(s)' from public.fantasy_seasons where kind = 'legacy'))
from public.fantasy_seasons s where s.kind = 'legacy';
select pg_temp.ok('R legacy trophies: rank 1 rows = champions',
  coalesce(bool_and(s.champion_ids = coalesce((select array_agg(t.player_id order by t.player_id) from public.fantasy_trophies t
                                               where t.season_id = s.id and t.rank = 1), '{}')), true))
from public.fantasy_seasons s where s.kind = 'legacy';
select pg_temp.ok('R legacy standings snapshot = legacy points per participant',
  coalesce(bool_and(jsonb_array_length(s.standings) = (select count(distinct participant_id) from public.fantasy_scores
                                                       where league_id = s.league_id and round_id is null)), true))
from public.fantasy_seasons s where s.kind = 'legacy';
select pg_temp.ok('R every active league has exactly one open Taça do Mês and one open Campeonato covering now',
  coalesce(bool_and((select count(*) from public.fantasy_seasons s where s.league_id = l.id and s.kind = 'month' and s.status = 'open'
                       and now() >= s.starts_at and now() < s.ends_at) = 1
              and (select count(*) from public.fantasy_seasons s where s.league_id = l.id and s.kind = 'season' and s.status = 'open'
                       and now() >= s.starts_at and now() < s.ends_at) = 1), true))
from public.fantasy_leagues l where l.archived_at is null;
select pg_temp.ok('R squads untouched since the restart are empty (managers re-pick)',
  not exists (select 1 from public.fantasy_squads s join public.fantasy_leagues l on l.id = s.league_id
              where s.updated_at <= l.v2_started_at and coalesce(cardinality(s.player_ids), 0) > 0));
select pg_temp.ok('R no pending trade offer from before the restart',
  not exists (select 1 from public.fantasy_trade_offers o join public.fantasy_leagues l on l.id = o.league_id
              where o.status = 'pending' and o.created_at < l.v2_started_at));

-- ── V. Shared vectors through the plpgsql rules ──────────
select pg_temp.ok('V rules constant has every key the JS mirror uses',
  (select pg_temp.kv('vectors') is not null) and public.fantasy_v2_rules() ?& array['played','goal','assist','save','cleanSheet','win',
    'hatTrick','hatTrickGoals','ownGoal','noShow','mvp','captain','transferCost','freeTransfersPerRound','maxBankedTransfers',
    'priceBase','priceScale','priceForm','priceMin']);
select pg_temp.ok('V night · ' || (n->>'name') || ' · ' || e.key,
  (public.fantasy_v2_player_night(public.fantasy_v2_night(v->'summaries'->(n->>'summary')), v->'summaries'->(n->>'summary'),
     e.key, v->'positions'->>e.key, n->'podium')->>'pts')::int = e.value::int,
  public.fantasy_v2_player_night(public.fantasy_v2_night(v->'summaries'->(n->>'summary')), v->'summaries'->(n->>'summary'),
     e.key, v->'positions'->>e.key, n->'podium')::text)
from (select pg_temp.kv('vectors')::jsonb v) q
cross join lateral jsonb_array_elements(q.v->'nights') n
cross join lateral jsonb_each_text(n->'expected') e;
select pg_temp.ok('V lineup · ' || (x.l->>'name'),
  (x.r->>'total')::int = (x.l->'expected'->>'total')::int
  and (x.r->>'transferCost')::int = (x.l->'expected'->>'transferCost')::int
  and x.r->'captain' = x.l->'expected'->'captain'
  and (select coalesce(jsonb_object_agg(p->>'id', (p->>'pts')::int), '{}'::jsonb) from jsonb_array_elements(x.r->'players') p) = x.l->'expected'->'players'
  and (select coalesce(jsonb_object_agg(p->>'id', p->>'subFor'), '{}'::jsonb) from jsonb_array_elements(x.r->'players') p
        where p->>'subFor' is not null) = x.l->'expected'->'subs',
  x.r::text)
from (select l, public.fantasy_v2_score_lineup(l->'lineup', q.v->'summaries'->(l->>'summary'), q.v->'positions', l->'podium') r
      from (select pg_temp.kv('vectors')::jsonb v) q cross join lateral jsonb_array_elements(q.v->'lineups') l) x;
select pg_temp.ok('V price ' || (p->'form')::text,
  public.fantasy_v2_price(array(select jsonb_array_elements_text(p->'form')::numeric), (p->>'base')::numeric, (p->>'scale')::numeric)
    = (p->>'expected')::numeric,
  public.fantasy_v2_price(array(select jsonb_array_elements_text(p->'form')::numeric), (p->>'base')::numeric, (p->>'scale')::numeric)::text)
from (select pg_temp.kv('vectors')::jsonb v) q cross join lateral jsonb_array_elements(q.v->'prices') p;
select pg_temp.ok('V ownership cap(' || (c->>0) || ')', public.fantasy_ownership_cap((c->>0)::int) = (c->>1)::int)
from (select pg_temp.kv('vectors')::jsonb v) q cross join lateral jsonb_array_elements(q.v->'ownershipCap') c;
select pg_temp.ok('V transfers ' || (t->'locked')::text || ' → ' || (t->'current')::text || ' free ' || (t->>'free'),
  (x->>'made')::int = (t->'expected'->>'made')::int and (x->>'cost')::int = (t->'expected'->>'cost')::int
  and (x->>'nextFree')::int = (t->'expected'->>'nextFree')::int, x::text)
from (select pg_temp.kv('vectors')::jsonb v) q
cross join lateral jsonb_array_elements(q.v->'transfers') t
cross join lateral (select public.fantasy_v2_transfer(
  case when jsonb_typeof(t->'locked') = 'array' then array(select jsonb_array_elements_text(t->'locked')) end,
  array(select jsonb_array_elements_text(t->'current')), (t->>'free')::int) as x) y;

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000f01' || n)::uuid, 'fv2-' || n || '@example.test'
  from unnest(array['01','02','03','04','09']) n;
with g as (insert into public.groups (name) values ('Fantasy V2 FC') returning id)
insert into _f_kv (k, v) select 'G', id::text from g;
insert into public.players (id, user_id, group_id, name, nick, is_organizer, position)
select pg_temp.mgr(x.n), ('00000000-0000-0000-0000-0000000f01' || x.n)::uuid, case when x.n = '09' then null else pg_temp.k('G') end,
       x.nm || ' Manager', x.nm, x.n = '01', 'Médio'
  from (values ('01','Olga'),('02','Bruno'),('03','Carla'),('04','Duarte'),('09','Admin')) x(n, nm);
insert into _f_kv (k, v)
select 'id:' || x.k, ('00000000-0000-0000-0000-0000000f03' || lpad(x.i::text, 2, '0'))::text
  from (values (1,'g1'),(2,'d1'),(3,'d2'),(4,'d3'),(5,'m1'),(6,'m2'),(7,'m3'),(8,'a1'),(9,'a2'),(10,'a3')) x(i, k);
insert into public.players (id, group_id, name, nick, position)
select pg_temp.id(x.k), pg_temp.k('G'), 'Real ' || x.k, upper(x.k), (pg_temp.kv('vectors')::jsonb)->'positions'->>x.k
  from unnest(array['g1','d1','d2','d3','m1','m2','m3','a1','a2','a3']) x(k);
-- A player of ANOTHER group, never pickable here.
with g as (insert into public.groups (name) values ('Other FC') returning id)
insert into public.players (id, group_id, name, nick, position)
select '00000000-0000-0000-0000-0000000f0399', id, 'Outsider', 'OUT', 'Avançado' from g;

-- ── 1. League creation (organizer, Club-gated in the app) ─
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('Draft mode is "em breve" (rejected for now)',
  format($$insert into public.fantasy_leagues (group_id, name, budget, squad_size, mode) values (%L, 'Draft', 120, 3, 'draft')$$, pg_temp.kv('G')),
  'fantasy:draft_soon');
insert into public.fantasy_leagues (group_id, name, budget, squad_size, mode, rules_version) values (pg_temp.k('G'), 'Liga V2', 120, 3, 'classic', 1);
reset role;
insert into _f_kv (k, v) select 'L', id::text from public.fantasy_leagues where group_id = pg_temp.k('G');
select pg_temp.ok('new league is forced to rules v2 / classic, not archived',
  (select rules_version = 2 and mode = 'classic' and archived_at is null and v2_started_at is not null from public.fantasy_leagues where id = pg_temp.k('L')));
select pg_temp.ok('new league opens a Taça do Mês and a Campeonato',
  (select count(*) = 2 and count(distinct kind) = 2 and bool_and(status = 'open') from public.fantasy_seasons where league_id = pg_temp.k('L')));
select pg_temp.ok('Campeonato window = 1 Aug → 1 Aug (Lisbon), month window = calendar month',
  (select bool_and(case kind
     when 'season' then (starts_at at time zone 'Europe/Lisbon')::time = '00:00' and extract(month from starts_at at time zone 'Europe/Lisbon') = 8
                        and extract(day from starts_at at time zone 'Europe/Lisbon') = 1 and ends_at = starts_at + interval '1 year'
     else extract(day from starts_at at time zone 'Europe/Lisbon') = 1 and (starts_at at time zone 'Europe/Lisbon')::time = '00:00' end)
   from public.fantasy_seasons where league_id = pg_temp.k('L')));
set local role authenticated;
select pg_temp.as_user('01');
update public.fantasy_leagues set rules_version = 1, archived_at = now(), name = 'Liga V2 renomeada' where id = pg_temp.k('L');
reset role;
select pg_temp.ok('organizer edits the name but cannot touch rules_version / archived_at',
  (select name = 'Liga V2 renomeada' and rules_version = 2 and archived_at is null from public.fantasy_leagues where id = pg_temp.k('L')));
-- Time travel (owner): the league started 3 days ago.
update public.fantasy_leagues set v2_started_at = now() - interval '3 days' where id = pg_temp.k('L');

-- ── 2. Squads only through save_fantasy_squad ────────────
set local role authenticated;
select pg_temp.as_user('02');
select pg_temp.expect_err('direct UPDATE of fantasy_squads denied',
  format($$update public.fantasy_squads set player_ids = '{}' where league_id = %L$$, pg_temp.kv('L')), 'permission denied');
select pg_temp.expect_err('direct INSERT of fantasy_squads denied',
  format($$insert into public.fantasy_squads (league_id, participant_id, player_ids) values (%L, %L, array[%L]::uuid[])$$,
         pg_temp.kv('L'), pg_temp.mgr('02'), pg_temp.id('a1')), 'permission denied');
select pg_temp.expect_err('direct INSERT of fantasy_scores denied',
  format($$insert into public.fantasy_scores (league_id, participant_id, player_ids, points) values (%L, %L, '{}', 999)$$,
         pg_temp.kv('L'), pg_temp.mgr('02')), 'permission denied');
select pg_temp.expect_err('direct INSERT of fantasy_round_lineups denied',
  format($$insert into public.fantasy_round_lineups (round_id, participant_id) values (gen_random_uuid(), %L)$$, pg_temp.mgr('02')), 'permission denied');
select pg_temp.expect_err('squad below squad_size rejected',
  format($$select public.save_fantasy_squad(%L, array[%L, %L]::uuid[], '{}', null, null)$$, pg_temp.kv('L'), pg_temp.id('a1'), pg_temp.id('g1')),
  'fantasy:squad_incomplete');
select pg_temp.expect_err('player from another group rejected',
  format($$select public.save_fantasy_squad(%L, array[%L, %L, '00000000-0000-0000-0000-0000000f0399']::uuid[], '{}', null, null)$$,
         pg_temp.kv('L'), pg_temp.id('a1'), pg_temp.id('g1')), 'fantasy:not_in_group');
-- 02: a1 (C) g1 (V) d1 + bench m3.
select public.save_fantasy_squad(pg_temp.k('L'), array[pg_temp.id('a1'), pg_temp.id('g1'), pg_temp.id('d1'), pg_temp.id('m3')],
  array[pg_temp.id('m3')], pg_temp.id('a1'), pg_temp.id('g1'));
select pg_temp.ok('save: starters = squad_size, bench kept in order, captain + vice stored',
  (select s.player_ids = array[pg_temp.id('a1'), pg_temp.id('g1'), pg_temp.id('d1'), pg_temp.id('m3')]
      and s.reserve_ids = array[pg_temp.id('m3')] and s.captain_id = pg_temp.id('a1') and s.vice_captain_id = pg_temp.id('g1')
   from pg_temp.squad('02') s));
select pg_temp.ok('save: every new pick charged the server price (base 20 with no rounds yet)',
  (select (s.prices_paid->>pg_temp.id('a1')::text)::numeric = 20 and (select count(*) from jsonb_object_keys(s.prices_paid)) = 4
   from pg_temp.squad('02') s));
-- 03: a1 m1 (C) a2 (V) + bench d2. Overflow (4 starters sent) is benched by the server.
select pg_temp.as_user('03');
select public.save_fantasy_squad(pg_temp.k('L'), array[pg_temp.id('a1'), pg_temp.id('m1'), pg_temp.id('a2'), pg_temp.id('d2')],
  '{}', pg_temp.id('m1'), pg_temp.id('a2'));
select pg_temp.ok('save: an XI above squad_size sends the last pick to the bench',
  (select s.reserve_ids = array[pg_temp.id('d2')] and s.captain_id = pg_temp.id('m1') from pg_temp.squad('03') s));
-- 04: cap for 3 participants = max(2, ceil(3/2)) = 2 → a1 (held by 02 and 03) is full.
select pg_temp.as_user('04');
select pg_temp.expect_err('ownership cap max(2, ceil(n/2)) enforced',
  format($$select public.save_fantasy_squad(%L, array[%L, %L, %L]::uuid[], '{}', null, null)$$,
         pg_temp.kv('L'), pg_temp.id('a1'), pg_temp.id('d1'), pg_temp.id('a2')), 'fantasy:ownership_cap');
select public.save_fantasy_squad(pg_temp.k('L'), array[pg_temp.id('m3'), pg_temp.id('d1'), pg_temp.id('a2'), pg_temp.id('a3')],
  array[pg_temp.id('a3')], pg_temp.id('m3'), pg_temp.id('d1'));
select pg_temp.ok('04 saved under the cap (m3 C, d1 V, bench a3)',
  (select s.captain_id = pg_temp.id('m3') and s.vice_captain_id = pg_temp.id('d1') and s.reserve_ids = array[pg_temp.id('a3')] from pg_temp.squad('04') s));
select pg_temp.expect_err('over budget rejected',
  format($$select public.save_fantasy_squad(%L, array[%L,%L,%L,%L,%L,%L,%L]::uuid[], '{}', null, null)$$, pg_temp.kv('L'),
         pg_temp.id('m3'), pg_temp.id('d1'), pg_temp.id('a2'), pg_temp.id('a3'), pg_temp.id('m2'), pg_temp.id('d3'), pg_temp.mgr('01')),
  'fantasy:over_budget');
reset role;
update public.players set injured = true where id = pg_temp.id('d3');
set local role authenticated;
select pg_temp.as_user('04');
select pg_temp.expect_err('newly adding an injured player rejected',
  format($$select public.save_fantasy_squad(%L, array[%L,%L,%L,%L]::uuid[], array[%L]::uuid[], null, null)$$, pg_temp.kv('L'),
         pg_temp.id('m3'), pg_temp.id('d1'), pg_temp.id('a2'), pg_temp.id('d3'), pg_temp.id('d3')), 'fantasy:injured');
reset role;
update public.players set injured = false where id = pg_temp.id('d3');

-- ── 3. Lock at kickoff (snapshot) ────────────────────────
insert into public.games (group_id, scheduled_at, status) values (pg_temp.k('G'), now() - interval '2 days', 'open');
select pg_temp.ok('nothing locked before the cron/lazy lock runs', not exists (select 1 from public.fantasy_rounds where league_id = pg_temp.k('L')));
select public.fantasy_lock_due(pg_temp.k('G'));
insert into _f_kv (k, v) select 'R1', id::text from public.fantasy_rounds where league_id = pg_temp.k('L');
select pg_temp.ok('lock: one round for the kickoff, status locked',
  (select count(*) = 1 and bool_and(status = 'locked' and kickoff_at = now() - interval '2 days') from public.fantasy_rounds where league_id = pg_temp.k('L')));
select pg_temp.ok('lock: lineup snapshot per participant (starters, bench order, captain, vice)',
  (select l.starter_ids = array[pg_temp.id('a1'), pg_temp.id('g1'), pg_temp.id('d1')] and l.bench_ids = array[pg_temp.id('m3')]
      and l.captain_id = pg_temp.id('a1') and l.vice_captain_id = pg_temp.id('g1') from pg_temp.lineup('R1', '02') l)
  and (select count(*) = 3 from public.fantasy_round_lineups where round_id = pg_temp.k('R1')));
select pg_temp.ok('lock: first lock of the season is free (unlimited until now), next round gets 1 free',
  (select l.transfer_cost = 0 and l.free_transfers is null from pg_temp.lineup('R1', '02') l)
  and (select s.free_transfers = 1 and s.locked_player_ids = s.player_ids from pg_temp.squad('02') s));
select public.fantasy_lock_due(pg_temp.k('G'));
select pg_temp.ok('lock is idempotent (second run creates nothing)', (select count(*) = 1 from public.fantasy_rounds where league_id = pg_temp.k('L')));

-- Edits after the lock go to the NEXT round: 02 swaps d1→d2 and g1→m2 (2 transfers).
set local role authenticated;
select pg_temp.as_user('02');
select public.save_fantasy_squad(pg_temp.k('L'), array[pg_temp.id('a1'), pg_temp.id('m2'), pg_temp.id('d2'), pg_temp.id('m3')],
  array[pg_temp.id('m3')], pg_temp.id('a1'), pg_temp.id('g1'));
reset role;
select pg_temp.ok('edit after lock: the locked snapshot is unchanged',
  (select l.starter_ids = array[pg_temp.id('a1'), pg_temp.id('g1'), pg_temp.id('d1')] from pg_temp.lineup('R1', '02') l));
select pg_temp.ok('edit after lock: the squad holds the new picks; vice dropped with g1',
  (select s.player_ids = array[pg_temp.id('a1'), pg_temp.id('m2'), pg_temp.id('d2'), pg_temp.id('m3')] and s.vice_captain_id is null
   from pg_temp.squad('02') s));

-- ── 4. Server scoring on matchday commit ─────────────────
set local role authenticated;
select pg_temp.as_user('01');
insert into public.matchdays (group_id, n_games, mode, summary, mvp_open)
values (pg_temp.k('G'), 3, 'avulsa', pg_temp.map((pg_temp.kv('vectors')::jsonb)->'summaries'->'nightA'), true);
reset role;
insert into _f_kv (k, v) select 'MD1', id::text from public.matchdays where group_id = pg_temp.k('G');
select pg_temp.ok('commit: matchday attached to the locked round, round scored',
  (select matchday_id = pg_temp.k('MD1') and status = 'scored' from public.fantasy_rounds where id = pg_temp.k('R1')));
select pg_temp.ok('commit: 02 scored from the SNAPSHOT (a1 18×2 + g1 14 + d1 11 = 61)', pg_temp.score('MD1', '02') = 61,
  pg_temp.score('MD1', '02')::text);
select pg_temp.ok('commit: 03 = a1 18 + m1 14×2 + a2 7 = 53', pg_temp.score('MD1', '03') = 53, pg_temp.score('MD1', '03')::text);
select pg_temp.ok('commit: 04 auto-sub (a3 for no-show m3) + vice d1 ×2 = 22 + 7 + 3 = 32', pg_temp.score('MD1', '04') = 32,
  pg_temp.score('MD1', '04')::text);
select pg_temp.ok('commit: breakdown records the auto-sub and the vice armband',
  (select breakdown->>'captain' = pg_temp.id('d1')::text
      and exists (select 1 from jsonb_array_elements(breakdown->'players') p where p->>'id' = pg_temp.id('a3')::text and p->>'subFor' = pg_temp.id('m3')::text)
   from public.fantasy_scores where matchday_id = pg_temp.k('MD1') and participant_id = pg_temp.mgr('04')));
select pg_temp.ok('commit: per-player round points stored (a1 18, m3 no-show −3)',
  (select bool_and(case player_id when pg_temp.id('a1') then points = 18 when pg_temp.id('m3') then points = -3 else true end)
      and count(*) = 9 from public.fantasy_round_players where round_id = pg_temp.k('R1')));
select pg_temp.ok('commit: bank credited 1 per point', (select budget_adjustment = 61 from pg_temp.squad('02') s));

-- ── 5. MVP bonus (vote closes = podium update) ───────────
set local role authenticated;
select pg_temp.as_user('01');
update public.matchdays set mvp_open = false, mvp_id = pg_temp.id('a1'), runner_up_id = pg_temp.id('g1'), third_id = pg_temp.id('d2')
 where id = pg_temp.k('MD1');
reset role;
select pg_temp.ok('MVP: 02 = a1 28×2 + g1 20 + d1 11 = 87', pg_temp.score('MD1', '02') = 87, pg_temp.score('MD1', '02')::text);
select pg_temp.ok('MVP: revision bumped, bank follows the delta',
  (select revision = 2 from public.fantasy_scores where matchday_id = pg_temp.k('MD1') and participant_id = pg_temp.mgr('02'))
  and (select budget_adjustment = 87 from pg_temp.squad('02') s));

-- ── 6. Correction → recompute ────────────────────────────
set local role authenticated;
select pg_temp.as_user('01');
update public.matchdays set summary = jsonb_set(summary, '{lines,0,goals}', '2') where id = pg_temp.k('MD1');
reset role;
select pg_temp.ok('correction: a1 loses the hat-trick (21 incl. MVP) → 02 = 42 + 20 + 11 = 73', pg_temp.score('MD1', '02') = 73,
  pg_temp.score('MD1', '02')::text);
select pg_temp.ok('correction: revision 3, updated_at set, bank = 73',
  (select revision = 3 and updated_at is not null from public.fantasy_scores where matchday_id = pg_temp.k('MD1') and participant_id = pg_temp.mgr('02'))
  and (select budget_adjustment = 73 from pg_temp.squad('02') s));

-- ── 7. Next round: transfer cost + price by form ─────────
update public.games set scheduled_at = now() - interval '1 hour' where group_id = pg_temp.k('G');
select public.fantasy_lock_due(pg_temp.k('G'));
insert into _f_kv (k, v) select 'R2', id::text from public.fantasy_rounds where league_id = pg_temp.k('L') and id <> pg_temp.k('R1');
select pg_temp.ok('round 2 locks the edited squad (2 transfers, 1 free → −4)',
  (select l.starter_ids = array[pg_temp.id('a1'), pg_temp.id('m2'), pg_temp.id('d2')] and l.transfers_made = 2
      and l.free_transfers = 1 and l.transfer_cost = 4 from pg_temp.lineup('R2', '02') l));
select pg_temp.ok('banking: 02 used 2 → 1 free next; 03 used 0 → 2 banked (cap 2)',
  (select free_transfers = 1 from pg_temp.squad('02') s) and (select free_transfers = 2 from pg_temp.squad('03') s));
set local role authenticated;
select pg_temp.as_user('01');
insert into public.matchdays (group_id, n_games, mode, summary, mvp_open)
values (pg_temp.k('G'), 3, 'avulsa', pg_temp.map((pg_temp.kv('vectors')::jsonb)->'summaries'->'nightA'), true);
reset role;
insert into _f_kv (k, v) select 'MD2', id::text from public.matchdays where group_id = pg_temp.k('G') and id <> pg_temp.k('MD1');
select pg_temp.ok('round 2: 02 = a1 36 + m2 10 + d2 12 − 4 transfer = 54, cost in the breakdown',
  pg_temp.score('MD2', '02') = 54
  and (select (breakdown->>'transferCost')::int = 4 and transfer_cost = 4 from public.fantasy_scores where matchday_id = pg_temp.k('MD2') and participant_id = pg_temp.mgr('02')),
  pg_temp.score('MD2', '02')::text);
set local role authenticated;
select pg_temp.as_user('02');
select pg_temp.ok('price by form: a1 = 20 + (18+21)×1.5/2 = 49, before round 2 = 52 (↓)',
  (select price = 49 and prev_price = 52 from public.fantasy_player_prices(pg_temp.k('L')) where player_id = pg_temp.id('a1')),
  (select price || ' / ' || prev_price from public.fantasy_player_prices(pg_temp.k('L')) where player_id = pg_temp.id('a1')));
select pg_temp.ok('price by form: never-scored player stays at base 20',
  (select price = 20 from public.fantasy_player_prices(pg_temp.k('L')) where player_id = pg_temp.id('d3')));
-- 03 buys g1 (form [14, 20] → 46): the new pick is charged today's server price.
select pg_temp.as_user('03');
select public.save_fantasy_squad(pg_temp.k('L'), array[pg_temp.id('a1'), pg_temp.id('m1'), pg_temp.id('a2'), pg_temp.id('d2'), pg_temp.id('g1')],
  array[pg_temp.id('d2'), pg_temp.id('g1')], pg_temp.id('m1'), pg_temp.id('a2'));
select pg_temp.ok('new pick charged the form price (g1 = 46), kept picks keep their cost basis (a1 = 20)',
  (select (s.prices_paid->>pg_temp.id('g1')::text)::numeric = 46 and (s.prices_paid->>pg_temp.id('a1')::text)::numeric = 20 from pg_temp.squad('03') s),
  (select s.prices_paid::text from pg_temp.squad('03') s));
select pg_temp.as_user('03');
select pg_temp.ok('ownership cap counts the caller: a member reading prices sees every group player',
  (select count(*) >= 10 from public.fantasy_player_prices(pg_temp.k('L'))));
select pg_temp.as_user('09');
select pg_temp.ok('prices: admin can read', (select count(*) >= 10 from public.fantasy_player_prices(pg_temp.k('L'))));
reset role;

-- ── 8. Recompute RPC (organizer/admin only, idempotent) ──
set local role authenticated;
select pg_temp.as_user('02');
select pg_temp.expect_err('recompute: plain member rejected', format($$select public.fantasy_recompute(%L)$$, pg_temp.kv('L')), 'fantasy:not_allowed');
select pg_temp.as_user('01');
select public.fantasy_recompute(pg_temp.k('L'));
reset role;
select pg_temp.ok('recompute: points unchanged (idempotent), bank unchanged',
  pg_temp.score('MD1', '02') = 73 and pg_temp.score('MD2', '02') = 54 and (select budget_adjustment = 127 from pg_temp.squad('02') s),
  (select budget_adjustment::text from pg_temp.squad('02') s));
-- A matchday the trigger missed (simulated: round detached, its scores and bank
-- credit never written) is re-attached and scored.
update public.fantasy_squads fs set budget_adjustment = fs.budget_adjustment - sc.points
  from public.fantasy_scores sc where sc.matchday_id = pg_temp.k('MD2') and sc.participant_id = fs.participant_id and fs.league_id = pg_temp.k('L');
delete from public.fantasy_scores where matchday_id = pg_temp.k('MD2');
update public.fantasy_rounds set matchday_id = null, status = 'locked' where id = pg_temp.k('R2');
set local role authenticated;
select pg_temp.as_user('01');
select public.fantasy_recompute(pg_temp.k('L'));
reset role;
select pg_temp.ok('recompute: missed matchday re-attached to its locked round and re-scored',
  (select matchday_id = pg_temp.k('MD2') and status = 'scored' from public.fantasy_rounds where id = pg_temp.k('R2'))
  and pg_temp.score('MD2', '02') = 54);

-- ── 9. Trades still work (server-side, client arrays ignored) ─
set local role authenticated;
select pg_temp.as_user('02');
insert into public.fantasy_trade_offers (league_id, from_participant_id, to_participant_id, target_player_id, give_player_id, offer_type)
values (pg_temp.k('L'), pg_temp.mgr('02'), pg_temp.mgr('03'), pg_temp.id('m1'), pg_temp.id('m2'), 'swap');
select pg_temp.as_user('03');
select public.accept_fantasy_trade((select id from public.fantasy_trade_offers where league_id = pg_temp.k('L') and status = 'pending'),
  array[pg_temp.mgr('01')], -9999, '{}'::jsonb, '{}'::uuid[], 9999, '{}'::jsonb);
reset role;
select pg_temp.ok('trade: 02 gets m1 in m2''s slot; forged client arrays ignored',
  (select s.player_ids = array[pg_temp.id('a1'), pg_temp.id('m1'), pg_temp.id('d2'), pg_temp.id('m3')] and s.captain_id = pg_temp.id('a1')
      and s.budget_adjustment = 127 from pg_temp.squad('02') s),
  (select s.player_ids::text || ' adj ' || s.budget_adjustment from pg_temp.squad('02') s));
select pg_temp.ok('trade: 03 gets m2 in m1''s slot and inherits the armband',
  (select s.player_ids[2] = pg_temp.id('m2') and s.captain_id = pg_temp.id('m2') and not (pg_temp.id('m1') = any(s.player_ids)) from pg_temp.squad('03') s));
select pg_temp.ok('trade: offer accepted exactly once',
  (select count(*) = 1 from public.fantasy_trade_offers where league_id = pg_temp.k('L') and status = 'accepted'));

-- ── 10. Season roll-over + trophies ──────────────────────
-- Time travel (owner): the current Taça do Mês and Campeonato have just ended.
update public.fantasy_seasons set starts_at = now() - interval '10 days', ends_at = now() - interval '1 minute'
 where league_id = pg_temp.k('L') and status = 'open';
insert into _f_kv (k, v) select 'S_' || kind, id::text from public.fantasy_seasons where league_id = pg_temp.k('L') and status = 'open';
select public.fantasy_tick();
select pg_temp.ok('roll: both finished periods closed with a standings snapshot',
  (select count(*) = 2 and bool_and(status = 'closed' and jsonb_array_length(standings) = 3 and closed_at is not null)
   from public.fantasy_seasons where id in (pg_temp.k('S_month'), pg_temp.k('S_season'))));
select pg_temp.ok('roll: champion = 02 (73 + 54 = 127)',
  (select champion_ids = array[pg_temp.mgr('02')] and (standings->0->>'points')::numeric = 127 from public.fantasy_seasons where id = pg_temp.k('S_season')));
select pg_temp.ok('roll: trophies for ranks 1–3 of both competitions',
  (select count(*) = 6 and count(*) filter (where rank = 1 and player_id = pg_temp.mgr('02')) = 2
   from public.fantasy_trophies where league_id = pg_temp.k('L')));
select pg_temp.ok('roll: next Taça do Mês + Campeonato opened automatically',
  (select count(*) = 2 and count(distinct kind) = 2 from public.fantasy_seasons where league_id = pg_temp.k('L') and status = 'open'
     and now() >= starts_at and now() < ends_at));
select pg_temp.ok('roll: squads kept; new Campeonato = unlimited transfers until the first lock',
  (select cardinality(s.player_ids) = 4 and s.locked_player_ids is null and s.free_transfers = 1 from pg_temp.squad('02') s));
select public.fantasy_tick();
select pg_temp.ok('roll is idempotent (no duplicate seasons/trophies)',
  (select count(*) = 4 from public.fantasy_seasons where league_id = pg_temp.k('L'))
  and (select count(*) = 6 from public.fantasy_trophies where league_id = pg_temp.k('L')));

-- ── 11. A new league archives the previous one ───────────
set local role authenticated;
select pg_temp.as_user('01');
insert into public.fantasy_leagues (group_id, name, budget, squad_size) values (pg_temp.k('G'), 'Liga V2 b', 120, 3);
reset role;
select pg_temp.ok('new league: previous one archived, its open seasons closed; still one active league',
  (select archived_at is not null from public.fantasy_leagues where id = pg_temp.k('L'))
  and not exists (select 1 from public.fantasy_seasons where league_id = pg_temp.k('L') and status = 'open')
  and (select count(*) = 1 from public.fantasy_leagues where group_id = pg_temp.k('G') and archived_at is null));

select check_name, ok, detail from _f order by n;
rollback;
