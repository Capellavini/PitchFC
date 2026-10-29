-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L7
-- (20261022110300_league_discipline.sql): suggested cases on homologation,
-- confirm / waive / manual cases, derived suspensions (served), lineup /
-- formation eligibility, the manager inbox, and a FUTSAL 5v5 match run
-- through submission, homologation and discipline.
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- Source: docs/ligas-draft-sql/check_flow.sql §10.
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
select pg_temp.ok('competition_discipline_cases: anon has NO table privilege', not has_table_privilege('anon', 'public.competition_discipline_cases', 'SELECT,INSERT,UPDATE,DELETE'));
select pg_temp.ok('competition_discipline_cases: authenticated read-only', has_table_privilege('authenticated', 'public.competition_discipline_cases', 'SELECT')
  and not has_table_privilege('authenticated', 'public.competition_discipline_cases', 'INSERT,UPDATE,DELETE'));
select pg_temp.ok('competition_discipline_cases: service_role CRUD', has_table_privilege('service_role', 'public.competition_discipline_cases', 'SELECT,INSERT,UPDATE,DELETE'));
select pg_temp.ok('competition_discipline_cases: RLS on, only SELECT policies', c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'competition_discipline_cases' and p.cmd <> 'SELECT'))
from pg_class c where c.oid = 'public.competition_discipline_cases'::regclass;
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.decide_discipline_case(uuid,text,integer,text)', 'anon', false),
  ('public.decide_discipline_case(uuid,text,integer,text)', 'authenticated', true),
  ('public.open_discipline_case(uuid,uuid,uuid,integer,text,uuid)', 'anon', false),
  ('public.list_discipline_cases(uuid,text)', 'anon', false),
  ('public.list_discipline_cases(uuid,text)', 'authenticated', true),
  ('public.competition_discipline(uuid,text)', 'anon', true),
  ('public.league_suspensions(uuid)', 'authenticated', false),
  ('public.league_is_suspended(uuid,uuid)', 'authenticated', false),
  ('public.league_player_eligible(public.team_matches,uuid,uuid)', 'authenticated', false)
) v(f, r, e);
set local role authenticated;

-- ── 1. m1 (A-B, 3h ago): red for Bruno, yellow for Beto ──
select pg_temp.as_user('01');
select public.schedule_match(pg_temp.k('m1'), now() - interval '3 hours', '{"name":"Campo Flow"}');
select public.schedule_match(pg_temp.k('m4'), now() - interval '1 hour', '{"name":"Campo Flow"}');
select public.schedule_match(pg_temp.k('m6'), now() + interval '7 days', '{"name":"Campo Flow"}');
select public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'));
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16')]);
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('701', jsonb_build_object('type', 'red', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('12'), 'minute', 40)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('702', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('16'), 'minute', 41)));
select public.set_match_phase(pg_temp.k('m1'), 'finished', pg_temp.seq('m1'));
select pg_temp.ok('cards do not open cases before homologation', not exists (select 1 from public.competition_discipline_cases));
select public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1'));
select pg_temp.ok('homologation opened a PENDING red-card case (suggested 1 from the regulation)',
  exists (select 1 from public.competition_discipline_cases where player_id = pg_temp.pl('12') and trigger = 'red' and status = 'pending' and suggested_matches = 1));
select pg_temp.ok('one yellow (threshold 2) opens no accumulation case yet',
  not exists (select 1 from public.competition_discipline_cases where player_id = pg_temp.pl('16')));
select pg_temp.ok('a pending case does not block: nobody suspended', (public.competition_discipline(pg_temp.k('C1'))->'suspended') = '[]'::jsonb
  and (public.competition_discipline(pg_temp.k('C1'))->>'pending_cases')::int = 1);
select pg_temp.ok('list_discipline_cases: manager inbox shows the pending red', (public.list_discipline_cases(pg_temp.k('C1'), 'pending')->'items'->0)
  @> format('{"player_id":"%s","name":"Bruno","trigger":"red","status":"pending","round":1,"active":false}', pg_temp.pl('12'))::jsonb);
select pg_temp.as_user('12');
select pg_temp.expect_err('a captain cannot read the discipline inbox', format($$select public.list_discipline_cases(%L)$$, pg_temp.kv('C1')), 'league:not_found');
select pg_temp.ok('the carded team sees its own pending case through the table', exists (select 1 from public.competition_discipline_cases where status = 'pending'));
select pg_temp.expect_err('a captain cannot decide a case', format($$select public.decide_discipline_case(%L, 'waive', 0, 'perdão')$$,
  (select id from public.competition_discipline_cases limit 1)), 'league:not_found');
select pg_temp.as_user('13');
select pg_temp.ok('another team does not see a PENDING case', not exists (select 1 from public.competition_discipline_cases));
select pg_temp.as_anon();
select pg_temp.ok('anon: pending_cases hidden', public.competition_discipline(pg_temp.k('C1'))->'pending_cases' = 'null'::jsonb);

-- ── 2. Confirm → suspended → blocked ─────────────────────
select pg_temp.as_user('01');
select pg_temp.setkv('red', (select id::text from public.competition_discipline_cases where player_id = pg_temp.pl('12') and trigger = 'red'));
select pg_temp.expect_err('decision requires a reason', format($$select public.decide_discipline_case(%L, 'confirm', 1, '')$$, pg_temp.kv('red')), 'league:reason_required');
select pg_temp.expect_err('unknown decision refused', format($$select public.decide_discipline_case(%L, 'ban', 1, 'x')$$, pg_temp.kv('red')), 'league:invalid_decision');
select pg_temp.ok('confirm 1 match', public.decide_discipline_case(pg_temp.k('red'), 'confirm', 1, 'Agressão') @> '{"status":"confirmed","decided_matches":1}');
select pg_temp.as_anon();
select pg_temp.ok('public: Bruno suspended for 1, 0 served, display name only',
  (public.competition_discipline(pg_temp.k('C1'))->'suspended'->0) @> format('{"player_id":"%s","matches":1,"served":0,"name":"Bruno"}', pg_temp.pl('12'))::jsonb
  and position('secret-' in public.competition_discipline(pg_temp.k('C1'))::text) = 0);
select pg_temp.as_user('13');
select pg_temp.ok('a confirmed suspension is public to other teams (table)', exists (select 1 from public.competition_discipline_cases where status = 'confirmed'));
select pg_temp.as_user('01');
select pg_temp.expect_err('suspended player cannot enter the team sheet (mesa)',
  format($$select public.set_league_lineup(%L, %L, array[%L]::uuid[])$$, pg_temp.kv('m4'), pg_temp.kv('B'), pg_temp.pl('12')), 'league:player_suspended');
select pg_temp.as_user('12');
select pg_temp.expect_err('suspended player cannot enter a lineup via the Rivals RPC either',
  format($$select public.set_match_lineup(%L, array[%L]::uuid[])$$, pg_temp.kv('m4'), pg_temp.pl('12')), 'league:player_suspended');
select pg_temp.expect_err('suspended player not eligible for the formation',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s"}')$$, pg_temp.kv('m6'), pg_temp.kv('B'), pg_temp.pl('12')), 'league:player_not_eligible');
select pg_temp.as_user('01');
select pg_temp.ok('the authority can still correct the sheet of the PAST match where the red happened',
  (public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16'), pg_temp.pl('20')])->>'count')::int = 3);

-- ── 3. Serving the suspension + yellow accumulation ──────
select public.set_match_phase(pg_temp.k('m4'), 'live', pg_temp.seq('m4'));
select public.set_league_lineup(pg_temp.k('m4'), pg_temp.k('B'), array[pg_temp.pl('16'), pg_temp.pl('20')]);
select public.record_match_event(pg_temp.k('m4'), pg_temp.ev('703', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('16'), 'minute', 10)));
select public.set_match_phase(pg_temp.k('m4'), 'finished', pg_temp.seq('m4'));
select public.homologate_match(pg_temp.k('m4'), pg_temp.seq('m4'));
select pg_temp.ok('2nd yellow across matches (threshold 2) opens accumulation case #1',
  exists (select 1 from public.competition_discipline_cases where player_id = pg_temp.pl('16') and trigger = 'yellow_accumulation' and accumulation_n = 1 and status = 'pending'));
select pg_temp.as_anon();
select pg_temp.ok('Bruno served his match (B played a homologated match after the red) → not suspended',
  (public.competition_discipline(pg_temp.k('C1'))->'suspended') = '[]'::jsonb);
select pg_temp.as_user('01');
select pg_temp.ok('inbox shows the served red as inactive with served = 1',
  (select (i->>'served')::int = 1 and not (i->>'active')::boolean from jsonb_array_elements(public.list_discipline_cases(pg_temp.k('C1'))->'items') i where i->>'case_id' = pg_temp.kv('red')));
select pg_temp.ok('Bruno eligible again for the team sheet', (public.set_league_lineup(pg_temp.k('m6'), pg_temp.k('B'), array[pg_temp.pl('12')])->>'count')::int = 1);
select pg_temp.ok('waive the accumulation case', public.decide_discipline_case(
  (select id from public.competition_discipline_cases where player_id = pg_temp.pl('16') and trigger = 'yellow_accumulation'), 'waive', null, 'Primeira época, aviso') @> '{"status":"waived","decided_matches":0}');

-- ── 4. Manual case ───────────────────────────────────────
select pg_temp.expect_err('manual case requires a reason', format($$select public.open_discipline_case(%L, %L, %L, 2, '')$$, pg_temp.kv('C1'), pg_temp.pl('15'), pg_temp.kv('A')), 'league:reason_required');
select pg_temp.expect_err('manual case: player must be in that team''s squad', format($$select public.open_discipline_case(%L, %L, %L, 2, 'Conduta')$$, pg_temp.kv('C1'), pg_temp.pl('15'), pg_temp.kv('B')), 'league:player_not_in_squad');
select pg_temp.expect_err('manual case: source match from elsewhere refused', format($$select public.open_discipline_case(%L, %L, %L, 2, 'Conduta', %L)$$, pg_temp.kv('C1'), pg_temp.pl('15'), pg_temp.kv('A'), gen_random_uuid()), 'league:match_not_found');
select pg_temp.ok('manual case (2 matches) confirmed at once', public.open_discipline_case(pg_temp.k('C1'), pg_temp.pl('15'), pg_temp.k('A'), 2, 'Conduta antidesportiva reportada') ? 'case_id');
select pg_temp.as_anon();
select pg_temp.ok('Abel suspended 2, 0 served', (public.competition_discipline(pg_temp.k('C1'))->'suspended'->0) @> format('{"player_id":"%s","matches":2,"served":0}', pg_temp.pl('15'))::jsonb);
select pg_temp.as_user('11');
select pg_temp.expect_err('a team captain cannot open a manual case', format($$select public.open_discipline_case(%L, %L, %L, 2, 'Conduta')$$, pg_temp.kv('C1'), pg_temp.pl('16'), pg_temp.kv('B')), 'league:not_found');

-- ── Futsal / 5-a-side competition (pilot shape: AFPCE) ───
-- C2 "Futsal Espinho": modality futsal, format 5v5, 2×20 min. Teams A and
-- B register 6 players each (5 starters incl. GR + 1 bench). One match mf.
select pg_temp.as_user('01');
select pg_temp.setkv('C2', public.create_competition(pg_temp.k('L'),
  '{"name":"Futsal Espinho","modality":"futsal","format":"5v5","match_duration_min":40}',
  '{"squad":{"min":5,"max":14},"discipline":{"yellow_threshold":3}}')->>'competition_id');
select public.publish_regulation(pg_temp.k('C2'), 1);
select public.set_competition_status(pg_temp.k('C2'), 'registration_open');
select pg_temp.setkv('link2', public.create_registration_link(pg_temp.k('C2'))->>'token');
select pg_temp.as_user('11'); select pg_temp.setkv('fA', public.register_team(pg_temp.kv('link2'), pg_temp.k('A'))->>'registration_id');
select public.submit_squad(pg_temp.k('fA'), (select jsonb_agg(jsonb_build_object('player_id', pg_temp.pl(n), 'shirt_number', i)) from unnest(array['11','15','17','18','19','23']) with ordinality u(n, i)));
select pg_temp.as_user('12'); select pg_temp.setkv('fB', public.register_team(pg_temp.kv('link2'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('fB'), (select jsonb_agg(jsonb_build_object('player_id', pg_temp.pl(n), 'shirt_number', i)) from unnest(array['12','16','20','21','22','24']) with ordinality u(n, i)));
select pg_temp.as_user('13'); select pg_temp.setkv('fC', public.register_team(pg_temp.kv('link2'), pg_temp.k('C'))->>'registration_id');
select pg_temp.expect_err('futsal: a squad below the regulation minimum (5) is refused',
  format($$select public.submit_squad(%L, '[{"player_id":"%s"}]')$$, pg_temp.kv('fC'), pg_temp.pl('13')), 'league:squad_size');
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k(r), 1, 'approve') from unnest(array['fA','fB']) r;
select public.withdraw_registration(pg_temp.k('fC'), 'Sem jogadores suficientes');
select public.set_competition_status(pg_temp.k('C2'), 'registration_closed');
select public.set_competition_status(pg_temp.k('C2'), 'in_progress');
select pg_temp.setkv('P2', public.create_phase(pg_temp.k('C2'))->>'phase_id');
select public.create_fixtures(pg_temp.k('P2'), jsonb_build_array(jsonb_build_object('round', 1, 'home_team_id', pg_temp.kv('A'), 'away_team_id', pg_temp.kv('B'))));
select pg_temp.setkv('mf', (select id::text from public.team_matches where competition_id = pg_temp.k('C2')));
select public.schedule_match(pg_temp.k('mf'), now() - interval '30 minutes', '{"name":"Pavilhão Municipal de Espinho"}');
select public.assign_official(pg_temp.k('mf'), pg_temp.pl('03'), 'scorer');
select public.assign_official(pg_temp.k('mf'), pg_temp.pl('05'), 'referee');
select pg_temp.ok('futsal: competition is futsal 5v5 / 40 min and the fixture inherits 5v5',
  exists (select 1 from public.competitions where id = pg_temp.k('C2') and modality = 'futsal' and format = '5v5' and match_duration_min = 40)
  and (select format from public.team_matches where id = pg_temp.k('mf')) = '5v5');
select pg_temp.ok('futsal: both squads (6) homologated',
  (select count(*) from public.competition_teams where competition_id = pg_temp.k('C2') and status = 'homologated') = 2);

-- ── 5. Futsal 5v5 through homologation + discipline ──────
select pg_temp.as_user('03');
select public.set_league_lineup(pg_temp.k('mf'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17'), pg_temp.pl('18'), pg_temp.pl('19'), pg_temp.pl('23')]);
select public.set_league_lineup(pg_temp.k('mf'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16'), pg_temp.pl('20'), pg_temp.pl('21'), pg_temp.pl('22'), pg_temp.pl('24')]);
select public.set_match_phase(pg_temp.k('mf'), 'live', pg_temp.seq('mf'));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f11', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('18'), 'period', '1H', 'minute', 7)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f12', jsonb_build_object('type', 'sub', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('19'), 'sub_in_player_id', pg_temp.pl('23'), 'period', '1H', 'minute', 8)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f13', jsonb_build_object('type', 'sub', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('23'), 'sub_in_player_id', pg_temp.pl('19'), 'period', '2H', 'minute', 22)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f14', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('23'), 'assist_player_id', pg_temp.pl('18'), 'period', '2H', 'minute', 25)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f15', jsonb_build_object('type', 'yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('20'), 'period', '2H', 'minute', 30)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f16', jsonb_build_object('type', 'second_yellow', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('20'), 'period', '2H', 'minute', 36)));
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f17', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('21'), 'period', '2H', 'minute', 38)));
select public.set_match_phase(pg_temp.k('mf'), 'finished', pg_temp.seq('mf'));
select pg_temp.as_user('05');
select pg_temp.ok('futsal: assigned referee submits the súmula', public.set_match_phase(pg_temp.k('mf'), 'submitted', pg_temp.seq('mf'))->>'result_status' = 'submitted');
select pg_temp.expect_err('futsal: referee is not a homologation authority by default', format($$select public.homologate_match(%L, %s)$$, pg_temp.kv('mf'), pg_temp.seq('mf')), 'league:not_authority');
select pg_temp.as_user('01');
select pg_temp.ok('futsal: homologated 2-1', public.homologate_match(pg_temp.k('mf'), pg_temp.seq('mf')) @> '{"home_score":2,"away_score":1}');
select pg_temp.ok('futsal: all 12 players on the two sheets appear in the official stats',
  (select count(*) from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id
    where h.match_id = pg_temp.k('mf') and h.status = 'current' and s.appeared) = 12);
select pg_temp.ok('futsal: rolling sub player (Amadeu) credited with his goal',
  exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id
           where h.match_id = pg_temp.k('mf') and s.player_id = pg_temp.pl('23') and s.goals = 1));
select pg_temp.ok('futsal: second yellow opens a pending case (league-only, this competition)',
  exists (select 1 from public.competition_discipline_cases where competition_id = pg_temp.k('C2') and player_id = pg_temp.pl('20')
           and trigger = 'second_yellow' and status = 'pending'));
select pg_temp.ok('futsal: discipline of C1 and C2 stay separate',
  not exists (select 1 from public.competition_discipline_cases where competition_id = pg_temp.k('C1') and player_id = pg_temp.pl('20')));
select pg_temp.as_anon();
select pg_temp.ok('futsal: standings A 3 pts, B 0', (public.competition_standings(pg_temp.k('C2'))->'rows'->0) @> format('{"team_id":"%s","pts":3,"gf":2,"ga":1}', pg_temp.kv('A'))::jsonb
  and (public.competition_standings(pg_temp.k('C2'))->'rows'->1) @> format('{"team_id":"%s","pts":0}', pg_temp.kv('B'))::jsonb);
select pg_temp.ok('futsal: top scorers Aldo + Amadeu (1 each), Aldo also 1 assist',
  (select count(*) from jsonb_array_elements(public.competition_rankings(pg_temp.k('C2'), 'goals')->'items') i where (i->>'rank')::int = 1) = 3
  and (public.competition_rankings(pg_temp.k('C2'), 'assists')->'items'->0->>'player_id') = pg_temp.pl('18')::text);

select n, check_name, ok, detail from _f order by n;
rollback;
