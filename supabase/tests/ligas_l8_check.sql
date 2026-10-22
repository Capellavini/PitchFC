-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L8
-- (20261022110400_league_awards_match_page.sql): official MVP (Craque
-- oficial) vs the fans' vote (Craque da torcida), and the public
-- match_page payload (incl. youth rule). Fans/follows (155500) are
-- covered by supabase/tests/ligas_fans_check.sql.
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- Source: docs/ligas-draft-sql/check_flow.sql §11.
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
from unnest(array['team_match_awards','team_match_fan_vote_windows','team_match_fan_votes']) t;
select pg_temp.ok(t || ': authenticated read-only', has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['team_match_awards','team_match_fan_vote_windows','team_match_fan_votes']) t;
select pg_temp.ok(t || ': service_role CRUD', has_table_privilege('service_role', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_match_awards','team_match_fan_vote_windows','team_match_fan_votes']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies', c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['team_match_awards','team_match_fan_vote_windows','team_match_fan_votes']) t join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.award_official_mvp(uuid,uuid,text)', 'anon', false),
  ('public.award_official_mvp(uuid,uuid,text)', 'authenticated', true),
  ('public.open_fan_vote(uuid,integer)', 'anon', false),
  ('public.cast_fan_vote(uuid,uuid)', 'anon', false),
  ('public.cast_fan_vote(uuid,uuid)', 'authenticated', true),
  ('public.fan_vote_results(uuid)', 'authenticated', true),
  ('public.match_page(uuid,text)', 'anon', true),
  ('public.league_public_name(uuid,boolean)', 'authenticated', false),
  ('public.league_fan_vote_block(uuid,boolean)', 'authenticated', false)
) v(f, r, e);
set local role authenticated;

-- ── 1. Play + homologate m1 (A 2-0 B) ────────────────────
select pg_temp.as_user('01');
select public.schedule_match(pg_temp.k('m1'), now() - interval '2 hours', '{"name":"Campo Flow"}');
select public.assign_official(pg_temp.k('m1'), pg_temp.pl('05'), 'referee');
select public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer');
select public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'));
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('A'), array[pg_temp.pl('11'), pg_temp.pl('15'), pg_temp.pl('17')]);
select public.set_league_lineup(pg_temp.k('m1'), pg_temp.k('B'), array[pg_temp.pl('12'), pg_temp.pl('16')]);
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('801', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'minute', 12)));
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('802', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'), 'player_id', pg_temp.pl('17'), 'minute', 44)));

-- ── 2. Official MVP ──────────────────────────────────────
select pg_temp.expect_err('MVP only after the match is finished', format($$select public.award_official_mvp(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:match_not_finished');
select public.set_match_phase(pg_temp.k('m1'), 'finished', pg_temp.seq('m1'));
select public.homologate_match(pg_temp.k('m1'), pg_temp.seq('m1'));
select pg_temp.as_user('03');
select pg_temp.expect_err('the scorer is not in mvp.official_by', format($$select public.award_official_mvp(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:not_authority');
select pg_temp.as_user('11');
select pg_temp.expect_err('a captain cannot award the official MVP', format($$select public.award_official_mvp(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:not_authority');
select pg_temp.as_user('05');
select pg_temp.expect_err('MVP must be in one of the two squads', format($$select public.award_official_mvp(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('13')), 'league:player_not_in_squad');
select pg_temp.ok('assigned referee awards the official MVP (revision 1)', public.award_official_mvp(pg_temp.k('m1'), pg_temp.pl('11')) @> format('{"revision":1,"role":"referee","team_id":"%s"}', pg_temp.kv('A'))::jsonb);
select pg_temp.as_user('01');
select pg_temp.expect_err('re-awarding requires a reason', format($$select public.award_official_mvp(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('17')), 'league:reason_required');
select pg_temp.ok('manager re-awards with a reason (revision 2)', public.award_official_mvp(pg_temp.k('m1'), pg_temp.pl('17'), 'Bis decisivo, revisto') @> '{"revision":2,"role":"manager"}');
select pg_temp.ok('one current award, previous superseded',
  (select count(*) from public.team_match_awards where match_id = pg_temp.k('m1') and status = 'current') = 1
  and (select count(*) from public.team_match_awards where match_id = pg_temp.k('m1') and status = 'superseded') = 1);

-- ── 3. Craque da torcida ─────────────────────────────────
select pg_temp.as_user('04');
select pg_temp.expect_err('fan vote closed before it opens', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:vote_closed');
select pg_temp.ok('no window yet: state none', public.fan_vote_results(pg_temp.k('m1')) @> '{"state":"none"}');
select pg_temp.expect_err('a fan cannot open the vote', format($$select public.open_fan_vote(%L, 24)$$, pg_temp.kv('m1')), 'league:match_not_found');
select pg_temp.as_user('01');
select pg_temp.expect_err('vote only on finished matches', format($$select public.open_fan_vote(%L, 24)$$, pg_temp.kv('m2')), 'league:match_not_finished');
select pg_temp.ok('manager opens a 24h window', public.open_fan_vote(pg_temp.k('m1'), 24) ? 'closes_at');
select pg_temp.ok('opening again is idempotent', (select count(*) from public.team_match_fan_vote_windows) = 1 and public.open_fan_vote(pg_temp.k('m1'), 2) ? 'closes_at');
select pg_temp.as_user('04');
select pg_temp.ok('fan votes Abel', public.cast_fan_vote(pg_temp.k('m1'), pg_temp.pl('15'))->>'voted_player_id' = pg_temp.pl('15')::text);
select pg_temp.ok('fan changes vote to Ana', public.cast_fan_vote(pg_temp.k('m1'), pg_temp.pl('11'))->>'voted_player_id' = pg_temp.pl('11')::text);
select pg_temp.ok('one vote per account', (select count(*) from public.team_match_fan_votes) = 1);
select pg_temp.expect_err('only players of the match are candidates', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('13')), 'league:not_a_candidate');
select pg_temp.ok('results hidden while open, my vote shown', public.fan_vote_results(pg_temp.k('m1')) @> format('{"state":"open","my_vote":"%s"}', pg_temp.pl('11'))::jsonb
  and public.fan_vote_results(pg_temp.k('m1'))->'items' = 'null'::jsonb);
select pg_temp.as_user('11');
select pg_temp.expect_err('no self-vote', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('11')), 'league:no_self_vote');
select pg_temp.ok('a player votes a teammate', public.cast_fan_vote(pg_temp.k('m1'), pg_temp.pl('17')) ? 'closes_at');
select pg_temp.as_user('06');
select pg_temp.ok('an outsider sees only their own (no) vote through the table', not exists (select 1 from public.team_match_fan_votes));
-- close the window (time travel)
reset role;
update public.team_match_fan_vote_windows set opens_at = now() - interval '25 hours', closes_at = now() - interval '1 minute';
set local role authenticated;
select pg_temp.as_user('04');
select pg_temp.expect_err('voting after close refused', format($$select public.cast_fan_vote(%L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('15')), 'league:vote_closed');
select pg_temp.ok('closed: tallies visible (Ana 1, Alex 1), total 2', public.fan_vote_results(pg_temp.k('m1')) @> '{"state":"closed","total_votes":2}'
  and jsonb_array_length(public.fan_vote_results(pg_temp.k('m1'))->'items') = 2);
select pg_temp.ok('fans'' vote never changes the official MVP (still Alex rev 2)',
  exists (select 1 from public.team_match_awards where match_id = pg_temp.k('m1') and status = 'current' and player_id = pg_temp.pl('17') and revision = 2));

-- ── 4. Match page payload ────────────────────────────────
select pg_temp.as_anon();
select pg_temp.ok('anon match_page: homologated 2-0 with competition, round, teams',
  public.match_page(pg_temp.k('m1')) @> format('{"score":{"home":2,"away":0,"state":"homologated"},"round":{"number":1},"teams":{"home":{"id":"%s","name":"Leões Liga"}},"competition":{"format":"7v7","youth":false}}', pg_temp.kv('A'))::jsonb);
select pg_temp.ok('anon match_page: homologation revision + official MVP + closed fan vote',
  public.match_page(pg_temp.k('m1')) @> format('{"homologation":{"revision":1,"kind":"played"},"official_mvp":{"player_id":"%s","name":"Alex"},"fan_vote":{"state":"closed"}}', pg_temp.pl('17'))::jsonb);
select pg_temp.ok('anon match_page: no capabilities, no dispute count, no PII',
  public.match_page(pg_temp.k('m1')) @> '{"me":{"is_staff":false,"can_homologate":false}}'
  and public.match_page(pg_temp.k('m1'))->'dispute'->'open_count' = 'null'::jsonb
  and position('secret-' in public.match_page(pg_temp.k('m1'))::text) = 0 and position('+35191' in public.match_page(pg_temp.k('m1'))::text) = 0);
select pg_temp.ok('match_page of an unknown id is null', public.match_page(gen_random_uuid()) is null);
select pg_temp.as_user('11');
select pg_temp.ok('captain match_page: leader_of_team_id + dispute window + open_count 0',
  public.match_page(pg_temp.k('m1')) @> format('{"me":{"leader_of_team_id":"%s","member_of_team_id":"%s"},"dispute":{"open_count":0}}', pg_temp.kv('A'), pg_temp.kv('A'))::jsonb
  and public.match_page(pg_temp.k('m1'))->'dispute'->>'window_closes_at' is not null);
select pg_temp.as_user('05');
select pg_temp.ok('referee match_page: is_staff, operator_role referee', public.match_page(pg_temp.k('m1')) @> '{"me":{"is_staff":true,"operator_role":"referee"}}');

-- ── 5. Youth rule on awards / votes ──────────────────────
reset role;
insert into public.league_categories (id, league_id, name, youth) values ('00000000-0000-0000-0000-0000000ca700', pg_temp.k('L'), 'Sub-17', true);
update public.competitions set category_id = '00000000-0000-0000-0000-0000000ca700' where id = pg_temp.k('C1');
set local role authenticated;
select pg_temp.as_anon();
select pg_temp.ok('youth category: official MVP + fan vote names are initials',
  public.match_page(pg_temp.k('m1'))->'official_mvp'->>'name' = 'A.'
  and not exists (select 1 from jsonb_array_elements(public.match_page(pg_temp.k('m1'))->'fan_vote'->'items') i where length(i->>'name') > 2));
select pg_temp.as_user('04');
select pg_temp.ok('youth category: fan_vote_results names are initials',
  not exists (select 1 from jsonb_array_elements(public.fan_vote_results(pg_temp.k('m1'))->'items') i where length(i->>'name') > 2));

select n, check_name, ok, detail from _f order by n;
rollback;
