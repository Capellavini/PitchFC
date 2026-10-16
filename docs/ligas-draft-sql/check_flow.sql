-- ─────────────────────────────────────────────────────────
-- DRAFT end-to-end smoke for drafts 01–08 (one league season, four teams,
-- events → homologation → standings → disputes → W.O. → discipline →
-- fans). Same contract as the other checks: transaction + ROLLBACK, one
-- row per check, all ok = true. When the PRs ship, split it into the
-- per-PR check scripts listed in docs/LIGAS-FASE2-PLAN.md §7.
--
-- Fixture: users …f4NN / players …e5NN
--   01 Olga  league owner        03 Sara  scorer (assigned to matches)
--   04 Fábio fan (no role)       06 Zé    outsider
--   11 Ana   captain A  15 Abel  player A
--   12 Bruno captain B  16 Beto  player B
--   13 Caio  captain C  14 Duda  captain D
--   09 admin (approves the pilot request)
-- ─────────────────────────────────────────────────────────
begin;

create temp table _f (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _f_kv (k text primary key, v text) on commit drop;
grant all on _f, _f_kv to authenticated, anon;
grant usage on sequence _f_n_seq to authenticated, anon;
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
create function pg_temp.setkv(p_k text, p_v text) returns void language sql as $$
  insert into _f_kv (k, v) values (p_k, p_v) on conflict (k) do update set v = excluded.v; $$;
create function pg_temp.as_user(p_nn text) returns void language sql as $$
  select set_config('request.jwt.claims',
    format('{"sub":"00000000-0000-0000-0000-00000000f4%s","role":"authenticated","email":"%s"}', p_nn,
           case when p_nn = '09' then 'capella.vinicius@gmail.com' else 'fl-' || p_nn || '@example.test' end), true); $$;
create function pg_temp.as_anon() returns void language sql as $$ select set_config('request.jwt.claims', '{"role":"anon"}', true); $$;
create function pg_temp.pl(p_nn text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-00000000e5' || p_nn)::uuid; $$;
create function pg_temp.seq(p_m text) returns int language sql stable security definer as $$ select seq from public.team_matches where id = pg_temp.k(p_m); $$;
create function pg_temp.ev(p_id text, p_body jsonb) returns jsonb language sql as $$
  select (jsonb_build_object('id', ('00000000-0000-0000-0000-0000000ee' || p_id)::uuid) || p_body); $$;
grant execute on all functions in schema pg_temp to public;

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f4' || n)::uuid, 'fl-' || n || '@example.test'
  from unnest(array['01','03','04','06','09','11','12','13','14','15','16']) n;
insert into public.players (id, user_id, name, nick, magic_token, email, phone, position)
select ('00000000-0000-0000-0000-00000000e5' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f4' || x.n)::uuid,
       x.nm || ' Teste', x.nm, 'fltest000000000000000000000e5' || x.n || 'x', 'secret-' || x.n || '@mail.test', '+3519100' || x.n, 'Médio'
  from (values ('01','Olga'),('03','Sara'),('04','Fábio'),('06','Zé'),('09','Admin'),('11','Ana'),('12','Bruno'),
               ('13','Caio'),('14','Duda'),('15','Abel'),('16','Beto')) x(n, nm);

set local role authenticated;
-- Teams (Rivals RPCs) + extra players.
select pg_temp.as_user('11'); select pg_temp.setkv('A', public.create_team('Leões Liga')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.k('A'))->>'token');
select pg_temp.as_user('12'); select pg_temp.setkv('B', public.create_team('Dragões Liga')->>'team_id');
select pg_temp.setkv('iB', public.create_team_invite(pg_temp.k('B'))->>'token');
select pg_temp.as_user('13'); select pg_temp.setkv('C', public.create_team('Águias Liga')->>'team_id');
select pg_temp.as_user('14'); select pg_temp.setkv('D', public.create_team('Lobos Liga')->>'team_id');
select pg_temp.as_user('15'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('16'); select public.accept_team_invite(pg_temp.kv('iB'));

-- League (pilot path).
select pg_temp.as_user('01'); select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Flow"}')->>'request_id');
select pg_temp.as_user('09'); select public.review_league_access(pg_temp.k('req'), 'approve');
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Flow')->>'league_id');
select public.update_league(pg_temp.k('L'), '{"visibility":"public"}');
select pg_temp.setkv('iS', public.create_league_invite(pg_temp.k('L'), 'scorer')->>'token');
select pg_temp.as_user('03'); select public.accept_league_invite(pg_temp.kv('iS'));

-- ── 1. Competition + regulation ──────────────────────────
select pg_temp.as_user('01');
select pg_temp.setkv('season', public.create_season(pg_temp.k('L'), '2026/27')->>'season_id');
select pg_temp.setkv('cat', public.create_category(pg_temp.k('L'), 'Sénior')->>'category_id');
select pg_temp.expect_err('regulation: unknown key refused', format($$select public.create_competition(%L, '{"name":"X"}', '{"bonus":1}')$$, pg_temp.kv('L')), 'league:unsupported_rule');
select pg_temp.expect_err('regulation: lots tiebreaker refused (no silent coin toss)',
  format($$select public.create_competition(%L, '{"name":"X"}', '{"tiebreakers":["pts","lots"]}')$$, pg_temp.kv('L')), 'league:unsupported_tiebreaker');
select pg_temp.expect_err('regulation: h2h not right after pts refused',
  format($$select public.create_competition(%L, '{"name":"X"}', '{"tiebreakers":["pts","gd","h2h"]}')$$, pg_temp.kv('L')), 'league:unsupported_tiebreaker');
select pg_temp.expect_err('structure other than league refused in Fase 2',
  format($$select public.create_competition(%L, '{"name":"X","structure":"knockout"}')$$, pg_temp.kv('L')), 'league:structure_not_available');
select pg_temp.setkv('C1', public.create_competition(pg_temp.k('L'),
  jsonb_build_object('name', 'Liga de Sábado', 'season_id', pg_temp.kv('season'), 'category_id', pg_temp.kv('cat')),
  '{"squad":{"min":1,"max":10},"tiebreakers":["pts","h2h","gd","gf"],"discipline":{"yellow_threshold":2},"mvp":{"fan_vote":true}}')->>'competition_id');
select pg_temp.expect_err('cannot open registrations before publishing the regulation',
  format($$select public.set_competition_status(%L, 'registration_open')$$, pg_temp.kv('C1')), 'league:regulation_not_published');
select public.publish_regulation(pg_temp.k('C1'), 1);
select pg_temp.ok('registration opens', public.set_competition_status(pg_temp.k('C1'), 'registration_open')->>'status' = 'registration_open');
select pg_temp.ok('opening registrations activates the league', (select status from public.leagues where id = pg_temp.k('L')) = 'active');
reset role;
select pg_temp.expect_err('published regulation is immutable (even for postgres)',
  format($$update public.competition_regulations set rules = '{}' where competition_id = %L$$, pg_temp.kv('C1')), 'league:regulation_immutable');
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.ok('v2 draft can be saved', (public.save_regulation_draft(pg_temp.k('C1'), '{"squad":{"min":1,"max":10},"tiebreakers":["pts","h2h","gd","gf"],"discipline":{"yellow_threshold":2},"mvp":{"fan_vote":true}}')->>'version')::int = 2);
select pg_temp.expect_err('publishing v2 requires a reason', format($$select public.publish_regulation(%L, 2)$$, pg_temp.kv('C1')), 'league:reason_required');
select pg_temp.setkv('link', public.create_registration_link(pg_temp.k('C1'))->>'token');

-- ── 2. Registration + squads ─────────────────────────────
select pg_temp.as_user('15');
select pg_temp.expect_err('a plain player cannot register the team', format($$select public.register_team(%L, %L)$$, pg_temp.kv('link'), pg_temp.kv('A')), 'league:not_team_leader');
select pg_temp.as_user('11'); select pg_temp.setkv('rA', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id');
select pg_temp.ok('register_team is idempotent', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id' = pg_temp.kv('rA'));
select pg_temp.expect_err('squad: a non-member is refused',
  format($$select public.submit_squad(%L, '[{"player_id":"%s"}]')$$, pg_temp.kv('rA'), pg_temp.pl('16')), 'league:not_team_member');
select public.submit_squad(pg_temp.k('rA'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('11'), 'shirt_number', 10),
                                                             jsonb_build_object('player_id', pg_temp.pl('15'), 'shirt_number', 7)));
select pg_temp.as_user('12'); select pg_temp.setkv('rB', public.register_team(pg_temp.kv('link'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('rB'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('12')), jsonb_build_object('player_id', pg_temp.pl('16'))));
select pg_temp.as_user('13'); select pg_temp.setkv('rC', public.register_team(pg_temp.kv('link'), pg_temp.k('C'))->>'registration_id');
select public.submit_squad(pg_temp.k('rC'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('13'))));
select pg_temp.as_user('14'); select pg_temp.setkv('rD', public.register_team(pg_temp.kv('link'), pg_temp.k('D'))->>'registration_id');
select public.submit_squad(pg_temp.k('rD'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('14'))));
select pg_temp.expect_err('a team leader cannot homologate their own squad',
  format($$select public.decide_squad(%L, 1, 'approve')$$, pg_temp.kv('rD')), 'league:not_found');
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k(r), 1, 'approve') from unnest(array['rA','rB','rC','rD']) r;
select pg_temp.ok('4 registrations homologated with frozen names',
  (select count(*) from public.competition_teams where competition_id = pg_temp.k('C1') and status = 'homologated' and registered_name is not null) = 4);
-- Live roster changes do not alter the homologated squad.
select pg_temp.as_user('15'); select public.leave_team(pg_temp.k('A'));
select pg_temp.as_user('01');
select pg_temp.ok('player leaving the team stays in the homologated squad (no silent change)',
  exists (select 1 from public.competition_squad_players sp join public.competition_teams ct on ct.id = sp.registration_id and sp.version = ct.homologated_squad_version
           where ct.id = pg_temp.k('rA') and sp.player_id = pg_temp.pl('15')));
select public.set_competition_status(pg_temp.k('C1'), 'registration_closed');
select public.set_competition_status(pg_temp.k('C1'), 'in_progress');

-- ── 3. Phase + fixtures ──────────────────────────────────
select pg_temp.setkv('P', public.create_phase(pg_temp.k('C1'))->>'phase_id');
select pg_temp.expect_err('incomplete round robin refused',
  format($$select public.create_fixtures(%L, '[{"round":1,"home_team_id":"%s","away_team_id":"%s"}]')$$, pg_temp.kv('P'), pg_temp.kv('A'), pg_temp.kv('B')),
  'league:invalid_fixtures');
select pg_temp.setkv('fx', jsonb_build_array(
  jsonb_build_object('round', 1, 'home_team_id', pg_temp.kv('A'), 'away_team_id', pg_temp.kv('B')),
  jsonb_build_object('round', 1, 'home_team_id', pg_temp.kv('C'), 'away_team_id', pg_temp.kv('D')),
  jsonb_build_object('round', 2, 'home_team_id', pg_temp.kv('A'), 'away_team_id', pg_temp.kv('C')),
  jsonb_build_object('round', 2, 'home_team_id', pg_temp.kv('B'), 'away_team_id', pg_temp.kv('D')),
  jsonb_build_object('round', 3, 'home_team_id', pg_temp.kv('D'), 'away_team_id', pg_temp.kv('A')),
  jsonb_build_object('round', 3, 'home_team_id', pg_temp.kv('B'), 'away_team_id', pg_temp.kv('C')))::text);
-- (RPC and its verification in separate statements: uncorrelated sub-selects can run first)
select pg_temp.ok('create_fixtures: 6 matches', (public.create_fixtures(pg_temp.k('P'), pg_temp.kv('fx')::jsonb)->>'matches')::int = 6);
select pg_temp.ok('6 fixtures, all unscheduled with no kickoff, same table as friendlies',
  (select count(*) from public.team_matches where competition_id = pg_temp.k('C1') and match_status = 'unscheduled' and kickoff_at is null) = 6);
select pg_temp.ok('create_fixtures replay with the same set is idempotent', not (public.create_fixtures(pg_temp.k('P'), pg_temp.kv('fx')::jsonb)->>'created')::boolean);
select pg_temp.setkv('m1', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('A') and m.away_team_id = pg_temp.k('B')));
select pg_temp.setkv('m2', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('A') and m.away_team_id = pg_temp.k('C')));
select pg_temp.setkv('m4', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('B') and m.away_team_id = pg_temp.k('D')));
select pg_temp.setkv('m6', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('B') and m.away_team_id = pg_temp.k('C')));
select public.schedule_match(pg_temp.k(m), now() - interval '1 hour', '{"name":"Campo Flow"}') from unnest(array['m1','m4','m6']) m;
select public.assign_official(pg_temp.k(m), pg_temp.pl('03'), 'scorer') from unnest(array['m1','m4']) m;
select pg_temp.expect_err('only league collaborators can be assigned', format($$select public.assign_official(%L, %L, 'referee')$$, pg_temp.kv('m1'), pg_temp.pl('06')), 'league:not_a_collaborator');

-- ── 4. Rivals RPCs cannot touch a league match ───────────
-- In production every RPC is its own transaction; this script runs them
-- all in ONE, so clear the league-RPC marker the previous calls left.
select set_config('pitch.league_rpc', '', true);
select pg_temp.as_user('11');
select pg_temp.expect_err('Rivals report_match_result on a league match → use_homologation',
  format($$select public.report_match_result(%L, 3, 0)$$, pg_temp.kv('m1')), 'league:use_homologation');
select pg_temp.expect_err('Rivals mark_match_not_played on a league match → managed_by_league',
  format($$select public.mark_match_not_played(%L, 'x')$$, pg_temp.kv('m1')), 'league:managed_by_league');
select pg_temp.expect_err('Rivals set_match_player_stats on a league match → stats_from_events',
  format($$select public.set_match_player_stats(%L, '[{"player_id":"%s","goals":5}]')$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:stats_from_events');
select pg_temp.expect_err('archiving a team with an active registration refused',
  format($$select public.archive_team(%L)$$, pg_temp.kv('A')), 'league:team_in_competition');

-- ── 5. Event log ─────────────────────────────────────────
select pg_temp.as_user('03');
select pg_temp.expect_err('events refused before the match is live',
  format($$select public.record_match_event(%L, pg_temp.ev('001', '{"type":"goal","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('A')), 'league:match_not_live');
select pg_temp.expect_err('start with a stale seq refused', format($$select public.set_match_phase(%L, 'live', -1)$$, pg_temp.kv('m1')), 'league:stale_seq');
select pg_temp.ok('scorer starts the match', public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'))->>'match_status' = 'live');
select pg_temp.setkv('g1', public.record_match_event(pg_temp.k('m1'), pg_temp.ev('001', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'),
  'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'period', '1H', 'minute', 12)))::text);
select pg_temp.ok('replaying the same event id is idempotent (no double goal)',
  (public.record_match_event(pg_temp.k('m1'), pg_temp.ev('001', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'),
     'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'period', '1H', 'minute', 12)))->>'duplicate')::boolean);
select pg_temp.expect_err('same id with different content → event_id_conflict',
  format($$select public.record_match_event(%L, pg_temp.ev('001', '{"type":"goal","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('B')), 'league:event_id_conflict');
select pg_temp.ok('unknown scorer is allowed (player null)',
  public.record_match_event(pg_temp.k('m1'), pg_temp.ev('002', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('B'), 'minute', 20))) ? 'seq');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('003', jsonb_build_object('type', 'own_goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('16'), 'minute', 30)));
select pg_temp.expect_err('own goal author must be from the OTHER team',
  format($$select public.record_match_event(%L, pg_temp.ev('004', '{"type":"own_goal","team_id":"%s","player_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('A'), pg_temp.pl('11')),
  'league:player_not_in_squad');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('005', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('12'), 'minute', 35)));
select pg_temp.expect_err('card without a player refused', format($$select public.record_match_event(%L, pg_temp.ev('006', '{"type":"red","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('B')), 'league:player_required');
select pg_temp.expect_err('correction without a reason refused',
  format($$select public.record_match_event(%L, pg_temp.ev('007', '{"action":"void","supersedes":"00000000-0000-0000-0000-0000000ee002"}'))$$, pg_temp.kv('m1')), 'league:reason_required');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('008', '{"action":"void","supersedes":"00000000-0000-0000-0000-0000000ee002","reason":"golo anulado (fora de jogo)"}'::jsonb));
select pg_temp.expect_err('second correction of the same event → stale_event (no silent overwrite)',
  format($$select public.record_match_event(%L, pg_temp.ev('009', '{"action":"void","supersedes":"00000000-0000-0000-0000-0000000ee002","reason":"x"}'))$$, pg_temp.kv('m1')), 'league:stale_event');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('010', jsonb_build_object('action', 'correct', 'supersedes', '00000000-0000-0000-0000-0000000ee001',
  'type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'minute', 14, 'reason', 'minuto errado')));
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot record events', format($$select public.record_match_event(%L, pg_temp.ev('011', '{"type":"goal","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('A')), 'league:not_operator');
select pg_temp.as_user('11');
select pg_temp.expect_err('team captain cannot record events unless the regulation allows',
  format($$select public.record_match_event(%L, pg_temp.ev('012', '{"type":"goal","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('A')), 'league:not_operator');
select pg_temp.expect_err('events are append-only (no UPDATE grant)', $$update public.team_match_events set minute = 1$$, 'permission denied');
reset role;
select pg_temp.expect_err('events are append-only (trigger, even for postgres)', $$update public.team_match_events set minute = 1$$, 'league:events_append_only');
set local role authenticated;
select pg_temp.as_anon();
select pg_temp.ok('live score from the effective log: A 2 (goal + own goal), B 0 (annulled), state live',
  public.match_live(pg_temp.k('m1'))->'score' @> '{"home":2,"away":0,"state":"live"}');
select pg_temp.ok('anon timeline never exposes email/phone', position('secret-' in public.match_live(pg_temp.k('m1'))::text) = 0
  and position('+35191' in public.match_live(pg_temp.k('m1'))::text) = 0);

-- ── 6. End → submit → homologate ─────────────────────────
select pg_temp.as_user('03');
select pg_temp.ok('scorer ends the match → provisional', public.set_match_phase(pg_temp.k('m1'), 'finished', pg_temp.seq('m1'))->>'result_status' = 'provisional');
select pg_temp.expect_err('a scorer cannot submit the súmula (referee/manager)', format($$select public.set_match_phase(%L, 'submitted', %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:not_allowed');
select pg_temp.expect_err('a scorer cannot homologate', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:not_authority');
select pg_temp.as_user('01');
select public.set_match_phase(pg_temp.k('m1'), 'submitted', pg_temp.seq('m1'));
select pg_temp.expect_err('homologate with a stale seq refused', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1') - 1), 'league:stale_seq');
select pg_temp.ok('homologation 2-0 from the log', public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1')) @> '{"home_score":2,"away_score":0,"revision":1}');
select pg_temp.ok('official stats: Ana 1 goal, Abel 1 assist, Beto 1 own goal (not a goal), Bruno 1 yellow',
  exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('11') and goals = 1 and assists = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('15') and assists = 1 and goals = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('16') and own_goals = 1 and goals = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('12') and yellows = 1));
select pg_temp.ok('league match never touches Rivals metrics (team_record A: 0 played)',
  (public.team_record(pg_temp.k('A'))->>'played')::int = 0);
select pg_temp.ok('standings: A first with 3 pts', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> format('{"team_id":"%s","pts":3,"rank":1}', pg_temp.kv('A'))::jsonb);
select pg_temp.ok('standings: C and D level on every key → shared rank, tie_unresolved',
  (select bool_and((r->>'tie_unresolved')::boolean) and count(distinct r->>'rank') = 1
     from jsonb_array_elements(public.competition_standings(pg_temp.k('C1'))->'rows') r
    where r->>'team_id' in (pg_temp.kv('C'), pg_temp.kv('D'))));

-- ── 7. Post-homologation correction + re-homologation ────
select pg_temp.as_user('03');
select pg_temp.expect_err('after submission a scorer can no longer append',
  format($$select public.record_match_event(%L, pg_temp.ev('013', '{"type":"goal","team_id":"%s","reason":"x"}'))$$, pg_temp.kv('m1'), pg_temp.kv('B')), 'league:not_authority');
select pg_temp.as_user('01');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('014', jsonb_build_object('action', 'void', 'supersedes', '00000000-0000-0000-0000-0000000ee003', 'reason', 'auto-golo mal registado (VAR)')));
select pg_temp.as_anon();
select pg_temp.ok('official score stays 2-0 until re-homologation, flagged pending',
  public.match_live(pg_temp.k('m1'))->'score' @> '{"home":2,"away":0,"state":"homologated","pending_rehomologation":true}');
select pg_temp.as_user('01');
select pg_temp.expect_err('re-homologation requires a reason', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:reason_required');
select pg_temp.ok('re-homologation → 1-0, revision 2',
  public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1'), 'correção auto-golo') @> '{"home_score":1,"away_score":0,"revision":2}');
select pg_temp.ok('previous homologation superseded, one current',
  (select count(*) from public.team_match_homologations where match_id = pg_temp.k('m1') and status = 'superseded') = 1);
select pg_temp.ok('Beto no longer has an own goal in the CURRENT snapshot',
  not exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id and h.status = 'current'
               where h.match_id = pg_temp.k('m1') and s.player_id = pg_temp.pl('16') and s.own_goals > 0));
select pg_temp.expect_err('nothing to re-homologate when the log did not change',
  format($$select public.homologate_match(%L, %s, 'again')$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:nothing_to_rehomologate');

-- ── 8. Disputes ──────────────────────────────────────────
select pg_temp.as_user('12');
select pg_temp.setkv('dsp', public.open_dispute(pg_temp.k('m1'), 'O nosso golo foi mal anulado', '[{"kind":"url","ref":"https://example.test/v"}]')->>'dispute_id');
select pg_temp.expect_err('one open dispute per team per match', format($$select public.open_dispute(%L, 'outra vez isto')$$, pg_temp.kv('m1')), 'league:dispute_already_open');
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot dispute', format($$select public.open_dispute(%L, 'não gosto disto')$$, pg_temp.kv('m1')), 'league:not_team_leader');
select pg_temp.ok('outsider does not read the dispute', not exists (select 1 from public.team_match_disputes));
select pg_temp.as_user('01');
select pg_temp.expect_err('rejecting a dispute requires a note', format($$select public.decide_dispute(%L, 'rejected')$$, pg_temp.kv('dsp')), 'league:reason_required');
select pg_temp.ok('authority rejects with a note; official result unchanged',
  public.decide_dispute(pg_temp.k('dsp'), 'rejected', 'Imagens confirmam fora de jogo')->>'status' = 'rejected'
  and (select official_home_score from public.team_matches where id = pg_temp.k('m1')) = 1);

-- ── 9. Walkover ──────────────────────────────────────────
select pg_temp.ok('W.O.: C absent → A 3-0 homologated without player stats',
  public.record_walkover(pg_temp.k('m2'), pg_temp.k('C'), 'Não compareceu', pg_temp.seq('m2')) @> '{"home_score":3,"away_score":0}'
  and not exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id where h.match_id = pg_temp.k('m2')));
select pg_temp.ok('standings: A 6 pts, 2 played', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> format('{"team_id":"%s","pts":6,"j":2}', pg_temp.kv('A'))::jsonb);
select public.adjust_points(pg_temp.k('C1'), pg_temp.k('A'), -1, 'Inscrição fora de prazo');
select pg_temp.ok('point adjustment is applied and listed with its reason',
  (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> '{"pts":5,"adjustments":-1}'
  and public.competition_standings(pg_temp.k('C1'))->'adjustments'->0->>'reason' = 'Inscrição fora de prazo');

-- ── 10. Discipline ───────────────────────────────────────
select pg_temp.as_user('03');
select public.set_match_phase(pg_temp.k('m4'), 'live', pg_temp.seq('m4'));
select public.record_match_event(pg_temp.k('m4'), pg_temp.ev('101', jsonb_build_object('type', 'red', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('12'), 'minute', 40)));
select public.record_match_event(pg_temp.k('m4'), pg_temp.ev('102', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('16'), 'minute', 41)));
select public.set_match_phase(pg_temp.k('m4'), 'finished', pg_temp.seq('m4'));
select pg_temp.as_user('01');
select public.homologate_match(pg_temp.k('m4'), pg_temp.seq('m4'));
select pg_temp.ok('homologation opened a PENDING red-card case (suggested 1)',
  exists (select 1 from public.competition_discipline_cases where player_id = pg_temp.pl('12') and trigger = 'red' and status = 'pending' and suggested_matches = 1));
select pg_temp.ok('a pending case does not block: Bruno not suspended yet',
  (public.competition_discipline(pg_temp.k('C1'))->'suspended') = '[]'::jsonb);
select public.decide_discipline_case((select id from public.competition_discipline_cases where player_id = pg_temp.pl('12') and trigger = 'red'), 'confirm', 1, 'Agressão');
select pg_temp.ok('confirmed: Bruno suspended for 1 match, 0 served',
  (public.competition_discipline(pg_temp.k('C1'))->'suspended'->0) @> format('{"player_id":"%s","matches":1,"served":0}', pg_temp.pl('12'))::jsonb);
select pg_temp.as_user('12');
select pg_temp.expect_err('suspended player cannot be put in a league lineup',
  format($$select public.set_match_lineup(%L, array[%L]::uuid[])$$, pg_temp.kv('m6'), pg_temp.pl('12')), 'league:player_suspended');
select pg_temp.expect_err('ex-member (left the team) refused by the Rivals lineup RPC itself',
  format($$select public.set_match_lineup(%L, array[%L]::uuid[])$$, pg_temp.kv('m6'), pg_temp.pl('15')), 'rivals:invalid_lineup');
select pg_temp.ok('eligible squad player (Beto) can be put in the league lineup',
  public.set_match_lineup(pg_temp.k('m6'), array[pg_temp.pl('16')]) is not null);
reset role;
select pg_temp.expect_err('DB trigger: a team member outside the homologated squad cannot enter a league lineup',
  format($$insert into public.team_match_lineup (match_id, player_id, team_id) values (%L, %L, %L)$$, pg_temp.kv('m6'), pg_temp.pl('13'), pg_temp.kv('B')),
  'league:player_not_in_squad');
set local role authenticated;
select pg_temp.as_user('12');

-- ── 10b. Persisted formation (TacticsBoard) ──────────────
select pg_temp.as_user('12');
select pg_temp.expect_err('formation: suspended player not eligible',
  format($$select public.save_match_formation(%L, %L, '1-1-1', '{"gk-0":"%s"}')$$, pg_temp.kv('m6'), pg_temp.kv('B'), pg_temp.pl('12')), 'league:player_not_eligible');
select pg_temp.ok('formation v1 saved for the team only',
  public.save_match_formation(pg_temp.k('m6'), pg_temp.k('B'), '1-1-1', jsonb_build_object('gk-0', pg_temp.pl('16'))) @> '{"version":1,"visibility":"team"}');
select pg_temp.expect_err('formation: stale base version refused (no silent overwrite)',
  format($$select public.save_match_formation(%L, %L, '1-1-1', '{"gk-0":"%s"}')$$, pg_temp.kv('m6'), pg_temp.kv('B'), pg_temp.pl('16')), 'league:stale_formation');
select pg_temp.expect_err('formation: bad slot key refused',
  format($$select public.save_match_formation(%L, %L, '1-1-1', '{"striker":"%s"}', 'team', 1)$$, pg_temp.kv('m6'), pg_temp.kv('B'), pg_temp.pl('16')), 'league:invalid_formation');
select pg_temp.as_user('13');
select pg_temp.ok('opponent does not see a team-only formation', public.match_formation(pg_temp.k('m6'), pg_temp.k('B')) is null);
select pg_temp.expect_err('opponent captain cannot save the other team''s formation',
  format($$select public.save_match_formation(%L, %L, '1-1-1', '{"gk-0":"%s"}', 'team', 1)$$, pg_temp.kv('m6'), pg_temp.kv('B'), pg_temp.pl('16')), 'league:not_team_leader');
select pg_temp.as_user('12');
select pg_temp.ok('formation v2 published', public.save_match_formation(pg_temp.k('m6'), pg_temp.k('B'), '1-1-1',
  jsonb_build_object('mid-0', pg_temp.pl('16')), 'published', 1) @> '{"version":2,"visibility":"published"}');
select pg_temp.as_user('13');
select pg_temp.ok('published formation visible to whoever sees the match, by display name',
  public.match_formation(pg_temp.k('m6'), pg_temp.k('B')) @> format('{"version":2,"slots":{"mid-0":{"player_id":"%s","name":"Beto"}}}', pg_temp.pl('16'))::jsonb);

-- ── 11. Fans ─────────────────────────────────────────────
select pg_temp.as_user('04');
select pg_temp.ok('fan (no role) supports team A', public.set_supported_team(pg_temp.k('C1'), pg_temp.k('A'))->>'team_id' = pg_temp.kv('A'));
select pg_temp.ok('supporting auto-follows team + competition', jsonb_array_length(public.my_following()->'follows') = 2);
select pg_temp.expect_err('fan cannot support a team not in the competition', format($$select public.set_supported_team(%L, %L)$$, pg_temp.kv('C1'), gen_random_uuid()), 'league:team_not_registered');
select pg_temp.expect_err('fan cannot operate the match', format($$select public.set_match_phase(%L, 'submitted', 0)$$, pg_temp.kv('m6')), 'league:not_operator');
select pg_temp.expect_err('fan vote closed before it opens', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:vote_closed');
select pg_temp.as_user('01');
select public.open_fan_vote(pg_temp.k('m1'), 24);
select pg_temp.ok('official MVP awarded by the manager (separate from the fans'' vote)', (public.award_official_mvp(pg_temp.k('m1'), pg_temp.pl('11'))->>'revision')::int = 1);
select pg_temp.as_user('04');
select pg_temp.ok('fan votes Abel', public.cast_fan_vote(pg_temp.k('m1'), pg_temp.pl('15'))->>'voted_player_id' = pg_temp.pl('15')::text);
select pg_temp.ok('fan changes vote to Ana (one vote per account)', public.cast_fan_vote(pg_temp.k('m1'), pg_temp.pl('11')) ? 'closes_at'
  and (select count(*) from public.team_match_fan_votes) = 1);
select pg_temp.ok('results hidden while the vote is open', public.fan_vote_results(pg_temp.k('m1')) @> '{"state":"open"}'
  and public.fan_vote_results(pg_temp.k('m1'))->'items' = 'null'::jsonb);
select pg_temp.as_user('11');
select pg_temp.expect_err('no self-vote', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:no_self_vote');
select pg_temp.as_anon();
select pg_temp.ok('anon reads the public standings', jsonb_array_length(public.competition_standings(pg_temp.k('C1'))->'rows') = 4);
select pg_temp.ok('anon top scorers: Ana 1 goal, no PII', (public.competition_player_stats(pg_temp.k('C1'))->'items'->0) @> format('{"player_id":"%s","goals":1}', pg_temp.pl('11'))::jsonb
  and position('secret-' in public.competition_player_stats(pg_temp.k('C1'))::text) = 0);

-- ── 12. Cards stay league-only ───────────────────────────
select pg_temp.as_user('11');
select pg_temp.setkv('ch', public.create_challenge(pg_temp.k('A'), pg_temp.k('B'),
  jsonb_build_object('kickoff_at', now() + interval '72 hours', 'venue_name', 'Campo', 'format', '7v7', 'duration_min', 60, 'cost_cents', 6000))->>'challenge_id');
select pg_temp.as_user('12');
select pg_temp.setkv('fr', public.respond_challenge(pg_temp.k('ch'), 1, 'accept')->>'match_id');
select pg_temp.ok('formation also works on a friendly (active member)',
  public.save_match_formation(pg_temp.k('fr'), pg_temp.k('B'), '1-1-1', jsonb_build_object('gk-0', pg_temp.pl('16'))) ? 'version');
reset role;
select pg_temp.ok('the friendly is a challenge-origin team_matches row', (select source_type from public.team_matches where id = pg_temp.k('fr')) = 'challenge');
select pg_temp.expect_err('no events (cards) on a friendly — league-only', format($$insert into public.team_match_events (id, match_id, seq, type, team_id, player_id)
  values (gen_random_uuid(), %L, 1, 'yellow', %L, %L)$$, pg_temp.kv('fr'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:events_competition_only');
select pg_temp.expect_err('origin CHECK: a competition row cannot be confirmed',
  format($$update public.team_matches set result_status = 'confirmed' where id = %L$$, pg_temp.kv('m1')), 'violates check constraint');

select n, check_name, ok, detail from _f order by n;
rollback;
