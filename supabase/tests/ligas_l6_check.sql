-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L6
-- (20261022110200_league_homologation_standings.sql): homologation +
-- official snapshots, re-homologation, disputes (+ inbox), W.O., point
-- adjustments, abandoned matches (replay / award), standings, rankings.
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- ALSO re-run supabase/tests/rivals_*_check.sql.
-- Source: docs/ligas-draft-sql/check_flow.sql §6–§9.
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
-- Players …e5NN (users …f4NN): 01 Olga owner · 03 Sara scorer · 05 Rui referee
--   04 Fã (fan, no role) · 06 Zé outsider · 09 admin
--   Team A: 11 Ana (captain) 15 Abel 17 Alex 18 Aldo 19 Artur 23 Amadeu
--   Team B: 12 Bruno (captain) 16 Beto 20 Bento 21 Bia 22 Brás 24 Basílio
--   Team C: 13 Caio (captain) · Team D: 14 Duda (captain)
-- C1 "Liga de Sábado" (futebol 7v7, public): A B C D, single round robin.
--   m1 A-B (r1) · m3 C-D (r1) · m2 A-C (r2) · m4 B-D (r2) · m5 D-A (r3) · m6 B-C (r3)
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f4' || n)::uuid, 'fl-' || n || '@example.test'
  from unnest(array['01','03','04','05','06','09','11','12','13','14','15','16','17','18','19','20','21','22','23','24']) n;
insert into public.players (id, user_id, name, nick, magic_token, email, phone, position)
select ('00000000-0000-0000-0000-00000000e5' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f4' || x.n)::uuid,
       x.nm || ' Teste', x.nm, 'fltest000000000000000000000e5' || x.n || 'x', 'secret-' || x.n || '@mail.test', '+3519100' || x.n, 'Médio'
  from (values ('01','Olga'),('03','Sara'),('04','Fã'),('05','Rui'),('06','Zé'),('09','Admin'),('11','Ana'),('12','Bruno'),
               ('13','Caio'),('14','Duda'),('15','Abel'),('16','Beto'),('17','Alex'),('18','Aldo'),('19','Artur'),
               ('20','Bento'),('21','Bia'),('22','Brás'),('23','Amadeu'),('24','Basílio')) x(n, nm);

set local role authenticated;
select pg_temp.as_user('11'); select pg_temp.setkv('A', public.create_team('Leões Liga')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.k('A'))->>'token');
select pg_temp.as_user('12'); select pg_temp.setkv('B', public.create_team('Dragões Liga')->>'team_id');
select pg_temp.setkv('iB', public.create_team_invite(pg_temp.k('B'))->>'token');
select pg_temp.as_user('13'); select pg_temp.setkv('C', public.create_team('Águias Liga')->>'team_id');
select pg_temp.as_user('14'); select pg_temp.setkv('D', public.create_team('Lobos Liga')->>'team_id');
select pg_temp.as_user('15'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('17'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('18'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('19'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('23'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('16'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('20'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('21'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('22'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('24'); select public.accept_team_invite(pg_temp.kv('iB'));

select pg_temp.as_user('01'); select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Flow"}')->>'request_id');
select pg_temp.as_user('09'); select public.review_league_access(pg_temp.k('req'), 'approve');
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Flow')->>'league_id');
select public.update_league(pg_temp.k('L'), '{"visibility":"public"}');
select public.set_league_status(pg_temp.k('L'), 'active');
select pg_temp.setkv('iS', public.create_league_invite(pg_temp.k('L'), 'scorer')->>'token');
select pg_temp.setkv('iR', public.create_league_invite(pg_temp.k('L'), 'referee')->>'token');
select pg_temp.as_user('03'); select public.accept_league_invite(pg_temp.kv('iS'));
select pg_temp.as_user('05'); select public.accept_league_invite(pg_temp.kv('iR'));
select pg_temp.as_user('01');
select pg_temp.setkv('C1', public.create_competition(pg_temp.k('L'), '{"name":"Liga de Sábado"}',
  '{"squad":{"min":1,"max":10},"discipline":{"yellow_threshold":2},"mvp":{"fan_vote":true}}')->>'competition_id');
select public.publish_regulation(pg_temp.k('C1'), 1);
select public.set_competition_status(pg_temp.k('C1'), 'registration_open');
select pg_temp.setkv('link', public.create_registration_link(pg_temp.k('C1'))->>'token');
select pg_temp.as_user('11'); select pg_temp.setkv('rA', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id');
select public.submit_squad(pg_temp.k('rA'), (select jsonb_agg(jsonb_build_object('player_id', pg_temp.pl(n))) from unnest(array['11','15','17','18','19','23']) n));
select pg_temp.as_user('12'); select pg_temp.setkv('rB', public.register_team(pg_temp.kv('link'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('rB'), (select jsonb_agg(jsonb_build_object('player_id', pg_temp.pl(n))) from unnest(array['12','16','20','21','22','24']) n));
select pg_temp.as_user('13'); select pg_temp.setkv('rC', public.register_team(pg_temp.kv('link'), pg_temp.k('C'))->>'registration_id');
select public.submit_squad(pg_temp.k('rC'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('13'))));
select pg_temp.as_user('14'); select pg_temp.setkv('rD', public.register_team(pg_temp.kv('link'), pg_temp.k('D'))->>'registration_id');
select public.submit_squad(pg_temp.k('rD'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('14'))));
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k(r), 1, 'approve') from unnest(array['rA','rB','rC','rD']) r;
select public.set_competition_status(pg_temp.k('C1'), 'registration_closed');
select public.set_competition_status(pg_temp.k('C1'), 'in_progress');
select pg_temp.setkv('P', public.create_phase(pg_temp.k('C1'))->>'phase_id');
select public.create_fixtures(pg_temp.k('P'), jsonb_build_array(
  jsonb_build_object('round', 1, 'home_team_id', pg_temp.kv('A'), 'away_team_id', pg_temp.kv('B')),
  jsonb_build_object('round', 1, 'home_team_id', pg_temp.kv('C'), 'away_team_id', pg_temp.kv('D')),
  jsonb_build_object('round', 2, 'home_team_id', pg_temp.kv('A'), 'away_team_id', pg_temp.kv('C')),
  jsonb_build_object('round', 2, 'home_team_id', pg_temp.kv('B'), 'away_team_id', pg_temp.kv('D')),
  jsonb_build_object('round', 3, 'home_team_id', pg_temp.kv('D'), 'away_team_id', pg_temp.kv('A')),
  jsonb_build_object('round', 3, 'home_team_id', pg_temp.kv('B'), 'away_team_id', pg_temp.kv('C'))));
select pg_temp.setkv('m1', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('A') and away_team_id = pg_temp.k('B')));
select pg_temp.setkv('m2', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('A') and away_team_id = pg_temp.k('C')));
select pg_temp.setkv('m3', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('C') and away_team_id = pg_temp.k('D')));
select pg_temp.setkv('m4', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('B') and away_team_id = pg_temp.k('D')));
select pg_temp.setkv('m5', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('D') and away_team_id = pg_temp.k('A')));
select pg_temp.setkv('m6', (select id::text from public.team_matches where competition_id = pg_temp.k('C1') and home_team_id = pg_temp.k('B') and away_team_id = pg_temp.k('C')));

-- ── 0. Grants / RLS ──────────────────────────────────────
reset role;
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_match_homologations','team_match_official_stats','team_match_disputes','competition_point_adjustments']) t;
select pg_temp.ok(t || ': authenticated read-only', has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['team_match_homologations','team_match_official_stats','team_match_disputes','competition_point_adjustments']) t;
select pg_temp.ok(t || ': service_role CRUD', has_table_privilege('service_role', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_match_homologations','team_match_official_stats','team_match_disputes','competition_point_adjustments']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies', c.relrowsecurity
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT')
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['team_match_homologations','team_match_official_stats','team_match_disputes','competition_point_adjustments']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.homologate_match(uuid,integer,text)', 'anon', false),
  ('public.homologate_match(uuid,integer,text)', 'authenticated', true),
  ('public.record_walkover(uuid,uuid,text,integer)', 'anon', false),
  ('public.decide_abandoned_match(uuid,text,jsonb,text,integer)', 'anon', false),
  ('public.open_dispute(uuid,text,jsonb)', 'anon', false),
  ('public.adjust_points(uuid,uuid,integer,text)', 'anon', false),
  ('public.competition_standings(uuid,text)', 'anon', true),
  ('public.competition_player_stats(uuid,text)', 'anon', true),
  ('public.competition_rankings(uuid,text,text,integer)', 'anon', true),
  ('public.competition_disputes(uuid,text)', 'anon', false),
  ('public.competition_disputes(uuid,text)', 'authenticated', true),
  ('public.league_write_homologation(public.team_matches,text,integer,integer,uuid,text,text)', 'authenticated', false),
  ('public.league_team_results(uuid)', 'authenticated', false)
) v(f, r, e);
set local role authenticated;

-- ── 1. Play m1 (A-B): goal, annulled goal, own goal, yellow ─
select pg_temp.as_user('01');
select public.schedule_match(pg_temp.k(m), now() - interval '2 hours', '{"name":"Campo Flow"}') from unnest(array['m1','m3','m5']) m;
select public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer');
select pg_temp.as_user('03');
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17')]);
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16')]);
select public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('601', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'minute', 12)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('602', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('B'), 'minute', 20)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('603', jsonb_build_object('type', 'own_goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('16'), 'minute', 30)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('604', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('12'), 'minute', 35)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('605', '{"action":"void","supersedes":"00000000-0000-0000-0000-0000000ee602","reason":"golo anulado (fora de jogo)"}'::jsonb));

-- ── 2. End → submit → homologate ─────────────────────────
select pg_temp.expect_err('cannot homologate a live match', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:');
select public.set_match_phase(pg_temp.k('m1'), 'finished', pg_temp.seq('m1'));
select pg_temp.expect_err('a scorer cannot homologate', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:not_authority');
select pg_temp.as_user('11');
select pg_temp.expect_err('a team captain cannot homologate', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:not_authority');
select pg_temp.as_user('01');
select public.set_match_phase(pg_temp.k('m1'), 'submitted', pg_temp.seq('m1'));
select pg_temp.expect_err('homologate with a stale seq refused', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1') - 1), 'league:stale_seq');
select pg_temp.ok('homologation 2-0 from the log, revision 1', public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1')) @> '{"home_score":2,"away_score":0,"revision":1,"kind":"played"}');
select pg_temp.ok('match row: homologated with official score', exists (select 1 from public.team_matches where id = pg_temp.k('m1')
  and result_status = 'homologated' and official_home_score = 2 and official_away_score = 0));
select pg_temp.ok('homologation records event_seq + regulation version + role',
  exists (select 1 from public.team_match_homologations where match_id = pg_temp.k('m1') and status = 'current' and regulation_version = 1 and decided_role = 'owner' and event_seq > 0));
select pg_temp.ok('official stats: Ana 1 goal, Abel 1 assist, Beto 1 own goal (not a goal), Bruno 1 yellow',
  exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('11') and goals = 1 and assists = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('15') and assists = 1 and goals = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('16') and own_goals = 1 and goals = 0)
  and exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('12') and yellows = 1));
select pg_temp.ok('team sheet players appear even without events (Alex)',
  exists (select 1 from public.team_match_official_stats where player_id = pg_temp.pl('17') and appeared and goals = 0));
select pg_temp.ok('Rivals record untouched (team_record A: 0 played)', (public.team_record(pg_temp.k('A'))->>'played')::int = 0);
select pg_temp.as_anon();
select pg_temp.ok('match_live shows the official score as homologated', public.match_live(pg_temp.k('m1'))->'score' @> '{"home":2,"away":0,"state":"homologated","pending_rehomologation":false}');
select pg_temp.ok('standings: A first with 3 pts', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> format('{"team_id":"%s","pts":3,"rank":1,"j":1,"w":1}', pg_temp.kv('A'))::jsonb);
select pg_temp.ok('standings: C and D level on every key → shared rank, tie_unresolved',
  (select bool_and((r->>'tie_unresolved')::boolean) and count(distinct r->>'rank') = 1
     from jsonb_array_elements(public.competition_standings(pg_temp.k('C1'))->'rows') r where r->>'team_id' in (pg_temp.kv('C'), pg_temp.kv('D'))));
select pg_temp.ok('standings payload: regulation version + tiebreakers + points', public.competition_standings(pg_temp.k('C1')) @> '{"regulation_version":1,"tiebreakers":["pts","gd","gf"],"points":{"win":3}}');
select pg_temp.ok('rankings goals: Ana #1 with 1', (public.competition_rankings(pg_temp.k('C1'), 'goals')->'items'->0) @> format('{"player_id":"%s","rank":1,"value":1,"team_name":"Leões Liga"}', pg_temp.pl('11'))::jsonb);
select pg_temp.ok('rankings assists: only Abel', jsonb_array_length(public.competition_rankings(pg_temp.k('C1'), 'assists')->'items') = 1
  and (public.competition_rankings(pg_temp.k('C1'), 'assists')->'items'->0->>'player_id') = pg_temp.pl('15')::text);
select pg_temp.ok('rankings cards: Bruno with 1', (public.competition_rankings(pg_temp.k('C1'), 'cards')->'items'->0) @> format('{"player_id":"%s","value":1}', pg_temp.pl('12'))::jsonb);
select pg_temp.expect_err('rankings: unknown kind refused', format($$select public.competition_rankings(%L, 'fairplay')$$, pg_temp.kv('C1')), 'league:invalid_ranking');
select pg_temp.ok('anon rankings / stats carry no PII', position('secret-' in public.competition_rankings(pg_temp.k('C1'), 'goals')::text) = 0
  and position('+35191' in public.competition_player_stats(pg_temp.k('C1'))::text) = 0);

-- ── 3. Correction after homologation + re-homologation ───
select pg_temp.as_user('03');
select pg_temp.expect_err('after submission a scorer can no longer append',
  format($$select public.record_match_event(%L, pg_temp.ev('606', '{"type":"goal","team_id":"%s","reason":"x"}'))$$, pg_temp.kv('m1'), pg_temp.kv('B')), 'league:not_authority');
select pg_temp.as_user('01');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('607', jsonb_build_object('action', 'void', 'supersedes', '00000000-0000-0000-0000-0000000ee603', 'reason', 'auto-golo mal registado')));
select pg_temp.as_anon();
select pg_temp.ok('official score stays 2-0 until re-homologation, flagged pending',
  public.match_live(pg_temp.k('m1'))->'score' @> '{"home":2,"away":0,"state":"homologated","pending_rehomologation":true}');
select pg_temp.ok('standings unchanged until re-homologation', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> '{"gf":2}');
select pg_temp.as_user('01');
select pg_temp.expect_err('re-homologation requires a reason', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:reason_required');
select pg_temp.ok('re-homologation → 1-0, revision 2', public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1'), 'correção auto-golo') @> '{"home_score":1,"away_score":0,"revision":2}');
select pg_temp.ok('previous revision superseded, exactly one current',
  (select count(*) from public.team_match_homologations where match_id = pg_temp.k('m1') and status = 'superseded') = 1
  and (select count(*) from public.team_match_homologations where match_id = pg_temp.k('m1') and status = 'current') = 1);
select pg_temp.ok('Beto has no own goal in the CURRENT snapshot (still in the superseded one)',
  not exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id and h.status = 'current'
               where h.match_id = pg_temp.k('m1') and s.player_id = pg_temp.pl('16') and s.own_goals > 0)
  and exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id and h.status = 'superseded'
               where h.match_id = pg_temp.k('m1') and s.player_id = pg_temp.pl('16') and s.own_goals = 1));
select pg_temp.expect_err('nothing to re-homologate when the log did not change',
  format($$select public.homologate_match(%L, %s, 'again')$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:nothing_to_rehomologate');
reset role;
select pg_temp.expect_err('homologation snapshots are write-once (even postgres)',
  format($$update public.team_match_homologations set home_score = 9 where match_id = %L$$, pg_temp.kv('m1')), 'league:snapshot_immutable');
select pg_temp.expect_err('official stats are write-once (even postgres)', $$delete from public.team_match_official_stats$$, 'league:snapshot_immutable');
set local role authenticated;

-- ── 4. Disputes ──────────────────────────────────────────
select pg_temp.as_user('12');
select pg_temp.setkv('dsp', public.open_dispute(pg_temp.k('m1'), 'O nosso golo foi mal anulado', '[{"kind":"url","ref":"https://example.test/v"}]')->>'dispute_id');
select pg_temp.ok('dispute opened with the 48h window', exists (select 1 from public.team_match_disputes where id = pg_temp.k('dsp') and status = 'open'
  and deadline_at > now() + interval '47 hours' and homologation_revision = 2));
select pg_temp.expect_err('one open dispute per team per match', format($$select public.open_dispute(%L, 'outra vez isto')$$, pg_temp.kv('m1')), 'league:dispute_already_open');
select pg_temp.expect_err('dispute reason too short refused', format($$select public.open_dispute(%L, 'x')$$, pg_temp.kv('m1')), 'league:');
select pg_temp.ok('team captain sees the dispute in competition_disputes', jsonb_array_length(public.competition_disputes(pg_temp.k('C1'))->'items') = 1);
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot dispute', format($$select public.open_dispute(%L, 'não gosto disto')$$, pg_temp.kv('m1')), 'league:not_team_leader');
select pg_temp.ok('outsider does not read disputes (table)', not exists (select 1 from public.team_match_disputes));
select pg_temp.expect_err('outsider cannot read the dispute inbox', format($$select public.competition_disputes(%L)$$, pg_temp.kv('C1')), 'league:not_found');
select pg_temp.as_user('13');
select pg_temp.ok('a team in the competition but not in the match sees no dispute', jsonb_array_length(public.competition_disputes(pg_temp.k('C1'))->'items') = 0);
select pg_temp.as_user('01');
select pg_temp.ok('authority inbox: 1 open, can_decide', (public.competition_disputes(pg_temp.k('C1'))->'items'->0) @> '{"status":"open","can_decide":true,"round":1}');
select pg_temp.expect_err('rejecting a dispute requires a note', format($$select public.decide_dispute(%L, 'rejected')$$, pg_temp.kv('dsp')), 'league:reason_required');
select pg_temp.ok('authority rejects with a note', public.decide_dispute(pg_temp.k('dsp'), 'rejected', 'Imagens confirmam fora de jogo')->>'status' = 'rejected');
select pg_temp.ok('official result unchanged by the decision', (select official_home_score from public.team_matches where id = pg_temp.k('m1')) = 1);
select pg_temp.ok('deciding twice is a no-op', (public.decide_dispute(pg_temp.k('dsp'), 'upheld', 'x')->>'unchanged')::boolean);
select pg_temp.as_user('12');
select pg_temp.setkv('dsp2', public.open_dispute(pg_temp.k('m1'), 'Segunda contestação, outro lance')->>'dispute_id');
select pg_temp.ok('opener can withdraw', public.decide_dispute(pg_temp.k('dsp2'), 'withdrawn')->>'status' = 'withdrawn');

-- ── 5. Walkover + point adjustments ──────────────────────
select pg_temp.as_user('01');
select pg_temp.expect_err('W.O. requires a reason', format($$select public.record_walkover(%L, %L, '', %s)$$, pg_temp.kv('m2'), pg_temp.kv('C'), pg_temp.seq('m2')), 'league:reason_required');
select pg_temp.expect_err('W.O. stale seq refused', format($$select public.record_walkover(%L, %L, 'x', -5)$$, pg_temp.kv('m2'), pg_temp.kv('C')), 'league:stale_seq');
select pg_temp.ok('W.O.: C absent → A 3-0', public.record_walkover(pg_temp.k('m2'), pg_temp.k('C'), 'Não compareceu', pg_temp.seq('m2')) @> '{"home_score":3,"away_score":0}');
select pg_temp.ok('W.O. produces no player stats and finishes the match',
  not exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id where h.match_id = pg_temp.k('m2'))
  and exists (select 1 from public.team_matches where id = pg_temp.k('m2') and match_status = 'finished' and result_status = 'homologated' and kickoff_at is not null));
select pg_temp.ok('standings: A 6 pts, 2 played', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> format('{"team_id":"%s","pts":6,"j":2}', pg_temp.kv('A'))::jsonb);
select pg_temp.expect_err('adjustment requires a reason', format($$select public.adjust_points(%L, %L, -1, 'x')$$, pg_temp.kv('C1'), pg_temp.kv('A')), 'league:invalid_adjustment');
select pg_temp.expect_err('zero-point adjustment refused', format($$select public.adjust_points(%L, %L, 0, 'Sem efeito nenhum')$$, pg_temp.kv('C1'), pg_temp.kv('A')), 'league:invalid_adjustment');
select pg_temp.setkv('adj', public.adjust_points(pg_temp.k('C1'), pg_temp.k('A'), -1, 'Inscrição fora de prazo')->>'adjustment_id');
select pg_temp.ok('adjustment applied and listed with its reason',
  (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> '{"pts":5,"adjustments":-1}'
  and public.competition_standings(pg_temp.k('C1'))->'adjustments'->0->>'reason' = 'Inscrição fora de prazo');
select pg_temp.ok('standings adjustments carry the id (for revoke_point_adjustment)',
  public.competition_standings(pg_temp.k('C1'))->'adjustments'->0->>'id' = pg_temp.kv('adj'));
select pg_temp.as_user('11');
select pg_temp.expect_err('a captain cannot adjust points', format($$select public.adjust_points(%L, %L, 3, 'Bónus porque sim')$$, pg_temp.kv('C1'), pg_temp.kv('A')), 'league:not_found');
select pg_temp.as_user('01');
select pg_temp.ok('revoke adjustment (row kept)', (public.revoke_point_adjustment(pg_temp.k('adj'), 'Afinal estava dentro do prazo')->>'revoked')::boolean);
select pg_temp.ok('revoked adjustment no longer counts', (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> '{"pts":6,"adjustments":0}'
  and exists (select 1 from public.competition_point_adjustments where id = pg_temp.k('adj') and revoked_at is not null));

-- ── 6. Abandoned matches ─────────────────────────────────
select pg_temp.expect_err('abandon only while live', format($$select public.abandon_match(%L, 'Chuva', %s)$$, pg_temp.kv('m3'), pg_temp.seq('m3')), 'league:invalid_transition');
select public.set_match_phase(pg_temp.k('m3'), 'live', pg_temp.seq('m3'));
select public.record_match_event(pg_temp.k('m3'), pg_temp.ev('611', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('C'), 'player_id', pg_temp.pl('13'), 'minute', 5)));
select pg_temp.expect_err('abandon requires a reason', format($$select public.abandon_match(%L, ' ', %s)$$, pg_temp.kv('m3'), pg_temp.seq('m3')), 'league:reason_required');
select pg_temp.ok('m3 abandoned', public.abandon_match(pg_temp.k('m3'), 'Falha de luz', pg_temp.seq('m3'))->>'match_status' = 'abandoned');
select pg_temp.as_anon();
select pg_temp.ok('an undecided abandoned match does not count (C: only its W.O.) and shows as pending',
  (select (r->>'j')::int from jsonb_array_elements(public.competition_standings(pg_temp.k('C1'))->'rows') r where r->>'team_id' = pg_temp.kv('C')) = 1
  and (public.competition_standings(pg_temp.k('C1'))->>'pending')::int = 1);
select pg_temp.as_user('01');
select pg_temp.expect_err('unknown decision refused', format($$select public.decide_abandoned_match(%L, 'coin', '{}', 'x', %s)$$, pg_temp.kv('m3'), pg_temp.seq('m3')), 'league:invalid_decision');
select pg_temp.setkv('rp', public.decide_abandoned_match(pg_temp.k('m3'), 'replay', '{}', 'Repetir o jogo', pg_temp.seq('m3'))->>'replay_match_id');
select pg_temp.ok('replay: a new unscheduled match in the same round, linked', exists (select 1 from public.team_matches r join public.team_matches o on o.id = pg_temp.k('m3')
  where r.id = pg_temp.k('rp') and r.replay_of_match_id = o.id and r.round_id = o.round_id and r.match_status = 'unscheduled' and r.source_type = 'competition'));
select pg_temp.ok('the abandoned original is annulled (does not count)', exists (select 1 from public.team_match_homologations where match_id = pg_temp.k('m3') and kind = 'annulled' and status = 'current'));
select public.set_match_phase(pg_temp.k('m5'), 'live', pg_temp.seq('m5'));
select public.abandon_match(pg_temp.k('m5'), 'Invasão de campo', pg_temp.seq('m5'));
select pg_temp.expect_err('award needs both scores', format($$select public.decide_abandoned_match(%L, 'award', '{"home_score":0}', 'x', %s)$$, pg_temp.kv('m5'), pg_temp.seq('m5')), 'league:invalid_score');
select pg_temp.ok('award D 0-3 A', public.decide_abandoned_match(pg_temp.k('m5'), 'award', '{"home_score":0,"away_score":3}', 'Responsabilidade da equipa da casa', pg_temp.seq('m5')) @> '{"decision":"award","revision":1}');
select pg_temp.as_anon();
select pg_temp.ok('standings: A 9 pts in 3 (win, W.O., awarded), C and D only their W.O./award',
  (public.competition_standings(pg_temp.k('C1'))->'rows'->0) @> format('{"team_id":"%s","pts":9,"j":3}', pg_temp.kv('A'))::jsonb
  and (select (r->>'j')::int from jsonb_array_elements(public.competition_standings(pg_temp.k('C1'))->'rows') r where r->>'team_id' = pg_temp.kv('D')) = 1);
select pg_temp.as_user('01');
select pg_temp.ok('Rivals record still untouched (A: 0 played)', (public.team_record(pg_temp.k('A'))->>'played')::int = 0);

select n, check_name, ok, detail from _f order by n;
rollback;
