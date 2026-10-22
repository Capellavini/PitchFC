-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L5
-- (20261022110100_league_match_formations.sql) on top of the shipped event
-- log (20261016155400): persisted TacticsBoard formations (league + friendly),
-- the mesa's team sheet (set_league_lineup), and a FUTSAL 5v5 match
-- (starting five, sheet of 6, rolling subs) up to the provisional result.
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- Source: docs/ligas-draft-sql/check_flow.sql §5, §10b.
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
from unnest(array['team_match_formations','team_match_formation_slots']) t;
select pg_temp.ok(t || ': authenticated read-only', has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['team_match_formations','team_match_formation_slots']) t;
select pg_temp.ok(t || ': service_role CRUD', has_table_privilege('service_role', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_match_formations','team_match_formation_slots']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies', c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['team_match_formations','team_match_formation_slots']) t join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.save_match_formation(uuid,uuid,text,jsonb,text,integer)', 'anon', false),
  ('public.save_match_formation(uuid,uuid,text,jsonb,text,integer)', 'authenticated', true),
  ('public.match_formation(uuid,uuid)', 'anon', false),
  ('public.set_league_lineup(uuid,uuid,uuid[])', 'anon', false),
  ('public.set_league_lineup(uuid,uuid,uuid[])', 'authenticated', true),
  ('public.league_player_eligible(public.team_matches,uuid,uuid)', 'authenticated', false),
  ('public.record_match_event(uuid,jsonb)', 'anon', false)
) v(f, r, e);
set local role authenticated;

-- ── 1. Team sheet (set_league_lineup) ────────────────────
select pg_temp.as_user('01');
select public.schedule_match(pg_temp.k('m1'), now() - interval '1 hour', '{"name":"Campo Flow"}');
select public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer');
select pg_temp.as_user('11');
select pg_temp.expect_err('team captain cannot set the league team sheet (not an operator)',
  format($$select public.set_league_lineup(%L, %L, array[%L]::uuid[])$$, pg_temp.kv('m1'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:not_operator');
select pg_temp.as_user('03');
select pg_temp.setkv('s0', pg_temp.seq('m1')::text);
select pg_temp.ok('scorer sets team A sheet (3 players)',
  (public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17')])->>'count')::int = 3);
select pg_temp.ok('team sheet bumps seq', pg_temp.seq('m1') = pg_temp.kv('s0')::int + 1);
select pg_temp.expect_err('team sheet: a player outside the homologated squad refused',
  format($$select public.set_league_lineup(%L, %L, array[%L]::uuid[])$$, pg_temp.kv('m1'), pg_temp.kv('A'), pg_temp.pl('13')), 'league:player_not_in_squad');
select pg_temp.expect_err('team sheet: duplicates refused',
  format($$select public.set_league_lineup(%L, %L, array[%L, %L]::uuid[])$$, pg_temp.kv('m1'), pg_temp.kv('A'), pg_temp.pl('11'), pg_temp.pl('11')), 'league:invalid_lineup');
select pg_temp.expect_err('team sheet: team not in the match refused',
  format($$select public.set_league_lineup(%L, %L, array[]::uuid[])$$, pg_temp.kv('m1'), pg_temp.kv('C')), 'league:invalid_team');
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15')]);
reset role;
select pg_temp.ok('team sheet replaced, not appended',
  (select count(*) from public.team_match_lineup where match_id = pg_temp.k('m1') and team_id = pg_temp.k('A')) = 2);
set local role authenticated;
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot set a team sheet',
  format($$select public.set_league_lineup(%L, %L, array[]::uuid[])$$, pg_temp.kv('m1'), pg_temp.kv('A')), 'league:not_operator');

-- ── 2. Event log still works on top (shipped L5 core) ────
select pg_temp.as_user('03');
select public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'));
select pg_temp.ok('goal recorded while live', public.record_match_event(pg_temp.k('m1'), pg_temp.ev('501',
  jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'minute', 3))) ? 'seq');
select pg_temp.ok('offline retry of the same event is a duplicate', (public.record_match_event(pg_temp.k('m1'), pg_temp.ev('501',
  jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'minute', 3)))->>'duplicate')::boolean);
select pg_temp.ok('team sheet can still be fixed by the mesa while live',
  (public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16')])->>'count')::int = 2);

-- ── 3. Formations (TacticsBoard) ─────────────────────────
select pg_temp.as_user('11');
select pg_temp.expect_err('formation locked once the match is live',
  format($$select public.save_match_formation(%L, %L, '2-1-1', '{"gk-0":"%s"}')$$, pg_temp.kv('m1'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:formation_locked');
select pg_temp.ok('formation v1 saved for the team only (m2, unscheduled)',
  public.save_match_formation(pg_temp.k('m2'), pg_temp.k('A'), '3-2-1', jsonb_build_object('gk-0', pg_temp.pl('11'), 'def-0', pg_temp.pl('15'))) @> '{"version":1,"visibility":"team","slots":2}');
select pg_temp.expect_err('stale base version refused (captain vs vice)',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s"}')$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:stale_formation');
select pg_temp.expect_err('bad slot key refused',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"striker":"%s"}', 'team', 1)$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:invalid_formation');
select pg_temp.expect_err('bad formation label refused',
  format($$select public.save_match_formation(%L, %L, 'diamond', '{"gk-0":"%s"}', 'team', 1)$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:invalid_formation');
select pg_temp.expect_err('player from the other squad not eligible',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s"}', 'team', 1)$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('12')), 'league:player_not_eligible');
select pg_temp.expect_err('the same player twice refused',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s","def-0":"%s"}', 'team', 1)$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('11'), pg_temp.pl('11')), 'league:invalid_formation');
select pg_temp.as_user('13');
select pg_temp.ok('opponent does not see a team-only formation', public.match_formation(pg_temp.k('m2'), pg_temp.k('A')) is null);
select pg_temp.ok('opponent does not read it through the table either', not exists (select 1 from public.team_match_formations where team_id = pg_temp.k('A')));
select pg_temp.expect_err('opponent captain cannot save the other team''s formation',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s"}', 'team', 1)$$, pg_temp.kv('m2'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:not_team_leader');
select pg_temp.as_user('11');
select pg_temp.ok('formation v2 published; empty slots ignored',
  public.save_match_formation(pg_temp.k('m2'), pg_temp.k('A'), '3-2-1',
    jsonb_build_object('gk-0', pg_temp.pl('11'), 'mid-0', pg_temp.pl('15'), 'fwd-0', null, 'def-1', ''), 'published', 1) @> '{"version":2,"visibility":"published","slots":2}');
select pg_temp.ok('one current formation, previous superseded',
  (select count(*) from public.team_match_formations where match_id = pg_temp.k('m2') and team_id = pg_temp.k('A') and status = 'current') = 1
  and (select count(*) from public.team_match_formations where match_id = pg_temp.k('m2') and team_id = pg_temp.k('A') and status = 'superseded') = 1);
select pg_temp.as_user('13');
select pg_temp.ok('published formation visible to the opponent, by display name only',
  public.match_formation(pg_temp.k('m2'), pg_temp.k('A')) @> format('{"version":2,"slots":{"mid-0":{"player_id":"%s","name":"Abel"}}}', pg_temp.pl('15'))::jsonb
  and position('secret-' in public.match_formation(pg_temp.k('m2'), pg_temp.k('A'))::text) = 0);
select pg_temp.as_user('01');
select pg_temp.ok('competition manager can save a league formation', public.save_match_formation(pg_temp.k('m2'), pg_temp.k('A'), '3-2-1',
  jsonb_build_object('gk-0', pg_temp.pl('11')), 'published', 2) @> '{"version":3}');

-- ── 4. Friendlies keep working ───────────────────────────
select pg_temp.as_user('11');
select pg_temp.setkv('ch', public.create_challenge(pg_temp.k('A'), pg_temp.k('B'),
  jsonb_build_object('kickoff_at', now() + interval '72 hours', 'venue_name', 'Campo', 'format', '7v7', 'duration_min', 60, 'cost_cents', 6000))->>'challenge_id');
select pg_temp.as_user('12');
select pg_temp.setkv('fr', public.respond_challenge(pg_temp.k('ch'), 1, 'accept')->>'match_id');
select pg_temp.ok('formation works on a friendly (active member)',
  public.save_match_formation(pg_temp.k('fr'), pg_temp.k('B'), '3-2-1', jsonb_build_object('gk-0', pg_temp.pl('16'))) ? 'version');
select pg_temp.expect_err('friendly formation: a non-member not eligible',
  format($$select public.save_match_formation(%L, %L, '3-2-1', '{"gk-0":"%s"}', 'team', 1)$$, pg_temp.kv('fr'), pg_temp.kv('B'), pg_temp.pl('13')), 'league:player_not_eligible');
select pg_temp.expect_err('set_league_lineup refuses a friendly', format($$select public.set_league_lineup(%L, %L, array[]::uuid[])$$, pg_temp.kv('fr'), pg_temp.kv('B')), 'league:match_not_found');
select pg_temp.ok('Rivals set_match_lineup on the friendly unchanged', (public.set_match_lineup(pg_temp.k('fr'), array[pg_temp.pl('12'), pg_temp.pl('16')])->>'count')::int = 2);

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

-- ── 5. Futsal: starting five, team sheet, rolling subs ───
select pg_temp.as_user('11');
select pg_temp.ok('futsal: starting five (GR + 4) saved as formation 2-1-1',
  public.save_match_formation(pg_temp.k('mf'), pg_temp.k('A'), '2-1-1', jsonb_build_object(
    'gk-0', pg_temp.pl('11'), 'def-0', pg_temp.pl('15'), 'def-1', pg_temp.pl('17'), 'mid-0', pg_temp.pl('18'), 'fwd-0', pg_temp.pl('19')), 'published') @> '{"version":1,"slots":5}');
select pg_temp.expect_err('futsal: 6 players on the court refused (5v5)',
  format($$select public.save_match_formation(%L, %L, '2-2-1', '{"gk-0":"%s","def-0":"%s","def-1":"%s","mid-0":"%s","mid-1":"%s","fwd-0":"%s"}', 'team', 1)$$,
         pg_temp.kv('mf'), pg_temp.kv('A'), pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17'), pg_temp.pl('18'), pg_temp.pl('19'), pg_temp.pl('23')), 'league:invalid_formation');
select pg_temp.expect_err('futsal: two goalkeepers refused',
  format($$select public.save_match_formation(%L, %L, '2-1-1', '{"gk-0":"%s","gk-1":"%s"}', 'team', 1)$$, pg_temp.kv('mf'), pg_temp.kv('A'), pg_temp.pl('11'), pg_temp.pl('15')), 'league:invalid_formation');
select pg_temp.as_user('03');
select pg_temp.ok('futsal: mesa records team A sheet (5 starters + 1 bench)',
  (public.set_league_lineup(pg_temp.k('mf'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17'), pg_temp.pl('18'), pg_temp.pl('19'), pg_temp.pl('23')])->>'count')::int = 6);
select pg_temp.ok('futsal: mesa records team B sheet (5 starters + 1 bench)',
  (public.set_league_lineup(pg_temp.k('mf'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16'), pg_temp.pl('20'), pg_temp.pl('21'), pg_temp.pl('22'), pg_temp.pl('24')])->>'count')::int = 6);
select pg_temp.ok('futsal: kickoff', public.set_match_phase(pg_temp.k('mf'), 'live', pg_temp.seq('mf'))->>'match_status' = 'live');
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f01', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('15'), 'assist_player_id', pg_temp.pl('17'), 'period', '1H', 'minute', 4)));
select pg_temp.ok('futsal: rolling sub out', public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f02',
  jsonb_build_object('type', 'sub', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('19'), 'sub_in_player_id', pg_temp.pl('23'), 'period', '1H', 'minute', 6))) ? 'seq');
select pg_temp.ok('futsal: the same player comes back on (rolling sub)', public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f03',
  jsonb_build_object('type', 'sub', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('23'), 'sub_in_player_id', pg_temp.pl('19'), 'period', '1H', 'minute', 9))) ? 'seq');
select public.record_match_event(pg_temp.k('mf'), pg_temp.ev('f04', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('B'), 'player_id', pg_temp.pl('16'), 'period', '2H', 'minute', 31)));
select pg_temp.expect_err('futsal: sub with a player outside the squad refused', format($$select public.record_match_event(%L, pg_temp.ev('f05',
  '{"type":"sub","team_id":"%s","player_id":"%s","sub_in_player_id":"%s"}'))$$, pg_temp.kv('mf'), pg_temp.kv('A'), pg_temp.pl('19'), pg_temp.pl('13')), 'league:player_not_in_squad');
select pg_temp.ok('futsal: full time → provisional', public.set_match_phase(pg_temp.k('mf'), 'finished', pg_temp.seq('mf'))->>'result_status' = 'provisional');
select pg_temp.as_anon();
select pg_temp.ok('futsal: provisional 1-1 from the log (labelled provisional)', public.match_live(pg_temp.k('mf'))->'score' @> '{"home":1,"away":1,"state":"provisional"}');
select pg_temp.ok('futsal: published starting five readable through match_page by anon',
  jsonb_array_length(jsonb_path_query_array(public.match_page(pg_temp.k('mf'))->'formations'->'home'->'slots', '$.*')) = 5);

select n, check_name, ok, detail from _f order by n;
rollback;
