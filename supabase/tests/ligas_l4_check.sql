-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L4
-- (20261022110000_league_fixtures_console.sql) + the shipped L4 surface
-- (20261016155300: fixtures, scheduling, postpone/cancel, officials).
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- ALSO re-run supabase/tests/rivals_*_check.sql.
-- Source: docs/ligas-draft-sql/check_flow.sql §3 + staff console.
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

-- ── 0. Grants ────────────────────────────────────────────
reset role;
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.league_collaborators(uuid,uuid)', 'anon', false),
  ('public.league_collaborators(uuid,uuid)', 'authenticated', true),
  ('public.competition_matches_staff(uuid,integer)', 'anon', false),
  ('public.competition_matches_staff(uuid,integer)', 'authenticated', true),
  ('public.schedule_match(uuid,timestamp with time zone,jsonb,integer)', 'anon', false),
  ('public.set_match_off(uuid,text,text)', 'anon', false),
  ('public.assign_official(uuid,uuid,text,boolean)', 'anon', false),
  ('public.competition_matches(uuid,integer,text)', 'anon', true)
) v(f, r, e);
set local role authenticated;

-- ── 1. Fixtures as created ───────────────────────────────
select pg_temp.as_user('01');
select pg_temp.ok('6 competition fixtures, unscheduled, no kickoff, challenge columns null',
  (select count(*) from public.team_matches where competition_id = pg_temp.k('C1') and source_type = 'competition'
     and match_status = 'unscheduled' and kickoff_at is null and challenge_id is null) = 6);
select pg_temp.ok('3 rounds created for the phase', (select count(*) from public.competition_rounds where phase_id = pg_temp.k('P')) = 3);

-- ── 2. Scheduling / postpone / cancel ────────────────────
select pg_temp.expect_err('schedule without kickoff refused', format($$select public.schedule_match(%L, null)$$, pg_temp.kv('m1')), 'league:kickoff_required');
select pg_temp.ok('schedule m1', public.schedule_match(pg_temp.k('m1'), now() - interval '1 hour', '{"name":"Pavilhão de Espinho","address":"Rua 1"}')->>'match_status' = 'scheduled');
select pg_temp.ok('m1 venue + kickoff stored', exists (select 1 from public.team_matches where id = pg_temp.k('m1') and venue_name = 'Pavilhão de Espinho' and kickoff_at is not null));
select pg_temp.expect_err('reschedule with a stale seq refused', format($$select public.schedule_match(%L, now(), '{}', -1)$$, pg_temp.kv('m1')), 'league:stale_seq');
select public.schedule_match(pg_temp.k('m4'), now() + interval '2 days');
select pg_temp.ok('postpone m4 returns postponed', public.set_match_off(pg_temp.k('m4'), 'postponed', 'Pavilhão ocupado')->>'match_status' = 'postponed');
select pg_temp.ok('postponed keeps the id, clears kickoff, keeps the reason',
  exists (select 1 from public.team_matches where id = pg_temp.k('m4') and match_status = 'postponed' and kickoff_at is null and status_reason = 'Pavilhão ocupado'));
select pg_temp.ok('postponed match rescheduled with the current seq (same id)',
  public.schedule_match(pg_temp.k('m4'), now() + interval '9 days', '{}', pg_temp.seq('m4'))->>'match_status' = 'scheduled');
select pg_temp.expect_err('cancel requires a reason', format($$select public.set_match_off(%L, 'cancelled', ' ')$$, pg_temp.kv('m6')), 'league:reason_required');
select pg_temp.ok('cancel m6', public.set_match_off(pg_temp.k('m6'), 'cancelled', 'Equipa C retirou-se do jogo')->>'match_status' = 'cancelled');
select pg_temp.expect_err('a cancelled match cannot be rescheduled', format($$select public.schedule_match(%L, now())$$, pg_temp.kv('m6')), 'league:invalid_transition');
select pg_temp.as_user('11');
select pg_temp.expect_err('a team captain cannot schedule league matches', format($$select public.schedule_match(%L, now())$$, pg_temp.kv('m2')), 'league:match_not_found');

-- ── 3. Officials ─────────────────────────────────────────
select pg_temp.as_user('01');
select pg_temp.ok('assign scorer', (public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer')->>'assigned')::boolean);
select pg_temp.ok('assign referee', (public.assign_official(pg_temp.k('m1'), pg_temp.pl('05'), 'referee')->>'assigned')::boolean);
select pg_temp.ok('assigning twice is idempotent', (public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer')->>'assigned')::boolean
  and (select count(*) from public.team_match_officials where match_id = pg_temp.k('m1')) = 2);
select pg_temp.expect_err('a non-collaborator cannot be assigned', format($$select public.assign_official(%L, %L, 'referee')$$, pg_temp.kv('m1'), pg_temp.pl('06')), 'league:not_a_collaborator');
select pg_temp.expect_err('a scorer cannot be assigned as referee', format($$select public.assign_official(%L, %L, 'referee')$$, pg_temp.kv('m1'), pg_temp.pl('03')), 'league:not_a_collaborator');
select public.assign_official(pg_temp.k('m3'), pg_temp.pl('03'), 'scorer');
select pg_temp.ok('unassign returns assigned=false', not (public.assign_official(pg_temp.k('m3'), pg_temp.pl('03'), 'scorer', false)->>'assigned')::boolean);
select pg_temp.ok('unassigned row removed', not exists (select 1 from public.team_match_officials where match_id = pg_temp.k('m3')));

-- ── 4. Staff console ─────────────────────────────────────
select pg_temp.ok('league_collaborators: owner + scorer + referee, by name',
  (select count(*) from jsonb_array_elements(public.league_collaborators(pg_temp.k('L'))->'items')) = 3
  and public.league_collaborators(pg_temp.k('L'))->'items'->0 @> '{"role":"owner","name":"Olga"}');
select pg_temp.ok('league_collaborators with competition scope still lists league-wide members',
  (select count(*) from jsonb_array_elements(public.league_collaborators(pg_temp.k('L'), pg_temp.k('C1'))->'items')) = 3);
select pg_temp.expect_err('league_collaborators: competition from another league refused',
  format($$select public.league_collaborators(%L, %L)$$, gen_random_uuid(), pg_temp.kv('C1')), 'league:not_found');
select pg_temp.ok('competition_matches_staff: 6 items with seq and officials',
  jsonb_array_length(public.competition_matches_staff(pg_temp.k('C1'))->'items') = 6
  and (select jsonb_array_length(i->'officials') from jsonb_array_elements(public.competition_matches_staff(pg_temp.k('C1'))->'items') i
        where i->>'id' = pg_temp.kv('m1')) = 2
  and (select (i->>'seq')::int from jsonb_array_elements(public.competition_matches_staff(pg_temp.k('C1'))->'items') i
        where i->>'id' = pg_temp.kv('m4')) = pg_temp.seq('m4'));
select pg_temp.ok('competition_matches_staff round filter', jsonb_array_length(public.competition_matches_staff(pg_temp.k('C1'), 2)->'items') = 2);
select pg_temp.ok('staff payload has no email/phone', position('secret-' in public.competition_matches_staff(pg_temp.k('C1'))::text) = 0
  and position('+35191' in public.league_collaborators(pg_temp.k('L'))::text) = 0);
select pg_temp.as_user('03');
select pg_temp.ok('scorer (staff) reads the console', (public.competition_matches_staff(pg_temp.k('C1'))->>'is_manager')::boolean = false);
select pg_temp.expect_err('scorer cannot list collaborators', format($$select public.league_collaborators(%L)$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.as_user('11');
select pg_temp.expect_err('team captain cannot read the staff console', format($$select public.competition_matches_staff(%L)$$, pg_temp.kv('C1')), 'league:not_found');
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot read the staff console', format($$select public.competition_matches_staff(%L)$$, pg_temp.kv('C1')), 'league:not_found');

-- ── 5. Public calendar ───────────────────────────────────
select pg_temp.as_anon();
select pg_temp.ok('anon calendar: 6 items, no seq / officials / status_reason leak',
  jsonb_array_length(public.competition_matches(pg_temp.k('C1'))->'items') = 6
  and not exists (select 1 from jsonb_array_elements(public.competition_matches(pg_temp.k('C1'))->'items') i
                   where i ? 'seq' or i ? 'officials' or i ? 'status_reason'));
select pg_temp.ok('anon calendar shows postponed/cancelled states',
  (select count(*) from jsonb_array_elements(public.competition_matches(pg_temp.k('C1'))->'items') i where i->>'match_status' = 'cancelled') = 1);

select n, check_name, ok, detail from _f order by n;
rollback;
