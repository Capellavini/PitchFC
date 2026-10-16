-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migrations L2a + L2b
-- (20261016155100_league_competitions.sql, 20261016155200_league_registrations.sql):
-- seasons / categories / competitions, versioned regulation, team
-- registration and homologated squad snapshots.
-- Same contract as supabase/tests/rivals_*_check.sql: run in the SQL
-- editor after the migrations; everything is inside a transaction that
-- ROLLS BACK; one row per check; every row must be ok = true.
-- Source: docs/ligas-draft-sql/check_flow.sql §1–§2 + grants/visibility.
--
-- Fixture: users …f4NN / players …e5NN
--   01 Olga  league owner      06 Zé    outsider
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
grant execute on all functions in schema pg_temp to public;

-- ── 0. Grants / RLS matrix ───────────────────────────────
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['league_seasons','league_categories','competitions','competition_regulations',
                  'competition_registration_links','competition_teams','competition_squad_versions','competition_squad_players']) t;
select pg_temp.ok(t || ': authenticated has no INSERT/UPDATE/DELETE', not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['league_seasons','league_categories','competitions','competition_regulations',
                  'competition_registration_links','competition_teams','competition_squad_versions','competition_squad_players']) t;
select pg_temp.ok(t || ': service_role full access',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['league_seasons','league_categories','competitions','competition_regulations',
                  'competition_registration_links','competition_teams','competition_squad_versions','competition_squad_players']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['league_seasons','league_categories','competitions','competition_regulations',
                  'competition_registration_links','competition_teams','competition_squad_versions','competition_squad_players']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('competitions.view_key is NOT readable by authenticated (column grant)',
       not has_column_privilege('authenticated', 'public.competitions', 'view_key', 'SELECT')
   and has_column_privilege('authenticated', 'public.competitions', 'name', 'SELECT'));
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.competition_page(text,text,text)', 'anon', true),
  ('public.competition_teams_page(uuid,text)', 'anon', true),
  ('public.registration_link_preview(text)', 'anon', true),
  ('public.create_competition(uuid,jsonb,jsonb,text)', 'anon', false),
  ('public.create_competition(uuid,jsonb,jsonb,text)', 'authenticated', true),
  ('public.register_team(text,uuid)', 'anon', false),
  ('public.submit_squad(uuid,jsonb)', 'anon', false),
  ('public.decide_squad(uuid,int,text,text)', 'anon', false),
  ('public.competition_rules(uuid)', 'authenticated', false)
) v(f, r, e);

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f4' || n)::uuid, 'fl-' || n || '@example.test'
  from unnest(array['01','06','09','11','12','13','14','15','16']) n;
insert into public.players (id, user_id, name, nick, magic_token, email, phone, position)
select ('00000000-0000-0000-0000-00000000e5' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f4' || x.n)::uuid,
       x.nm || ' Teste', x.nm, 'fltest000000000000000000000e5' || x.n || 'x', 'secret-' || x.n || '@mail.test', '+3519100' || x.n, 'Médio'
  from (values ('01','Olga'),('06','Zé'),('09','Admin'),('11','Ana'),('12','Bruno'),
               ('13','Caio'),('14','Duda'),('15','Abel'),('16','Beto')) x(n, nm);

set local role authenticated;
select pg_temp.as_user('11'); select pg_temp.setkv('A', public.create_team('Leões Liga')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.k('A'))->>'token');
select pg_temp.as_user('12'); select pg_temp.setkv('B', public.create_team('Dragões Liga')->>'team_id');
select pg_temp.as_user('13'); select pg_temp.setkv('C', public.create_team('Águias Liga')->>'team_id');
select pg_temp.as_user('14'); select pg_temp.setkv('D', public.create_team('Lobos Liga')->>'team_id');
select pg_temp.as_user('15'); select public.accept_team_invite(pg_temp.kv('iA'));

select pg_temp.as_user('01'); select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Flow"}')->>'request_id');
select pg_temp.as_user('09'); select public.review_league_access(pg_temp.k('req'), 'approve');
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Flow')->>'league_id');
select pg_temp.setkv('Lslug', (select slug from public.leagues where id = pg_temp.k('L')));

-- ── 1. Competition + regulation ──────────────────────────
select pg_temp.setkv('season', public.create_season(pg_temp.k('L'), '2026/27')->>'season_id');
select pg_temp.setkv('cat', public.create_category(pg_temp.k('L'), 'Sénior')->>'category_id');
select pg_temp.expect_err('regulation: unknown key refused', format($$select public.create_competition(%L, '{"name":"X"}', '{"bonus":1}')$$, pg_temp.kv('L')), 'league:unsupported_rule');
select pg_temp.expect_err('regulation: lots tiebreaker refused (no silent coin toss)',
  format($$select public.create_competition(%L, '{"name":"X"}', '{"tiebreakers":["pts","lots"]}')$$, pg_temp.kv('L')), 'league:unsupported_tiebreaker');
select pg_temp.expect_err('regulation: h2h not right after pts refused',
  format($$select public.create_competition(%L, '{"name":"X"}', '{"tiebreakers":["pts","gd","h2h"]}')$$, pg_temp.kv('L')), 'league:unsupported_tiebreaker');
select pg_temp.expect_err('structure other than league refused in Fase 2',
  format($$select public.create_competition(%L, '{"name":"X","structure":"knockout"}')$$, pg_temp.kv('L')), 'league:structure_not_available');
select pg_temp.as_user('06');
select pg_temp.expect_err('outsider cannot create a competition in L', format($$select public.create_competition(%L, '{"name":"X"}')$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.as_user('01');
select pg_temp.setkv('C1', public.create_competition(pg_temp.k('L'),
  jsonb_build_object('name', 'Liga de Sábado', 'season_id', pg_temp.kv('season'), 'category_id', pg_temp.kv('cat')),
  '{"squad":{"min":1,"max":10},"tiebreakers":["pts","h2h","gd","gf"]}', 'cref-1')->>'competition_id');
select pg_temp.ok('create_competition is idempotent on client_ref',
  public.create_competition(pg_temp.k('L'), '{"name":"Liga de Sábado"}', '{}', 'cref-1')->>'competition_id' = pg_temp.kv('C1'));
select pg_temp.setkv('Cslug', (select slug from public.competitions where id = pg_temp.k('C1')));
select pg_temp.ok('regulation v1 starts as a draft with validated defaults (points 3/1/0)',
  exists (select 1 from public.competition_regulations where competition_id = pg_temp.k('C1') and version = 1 and status = 'draft'
           and rules #>> '{points,win}' = '3'));
select pg_temp.expect_err('cannot open registrations before publishing the regulation',
  format($$select public.set_competition_status(%L, 'registration_open')$$, pg_temp.kv('C1')), 'league:regulation_not_published');
select pg_temp.expect_err('invalid status transition refused',
  format($$select public.set_competition_status(%L, 'finished')$$, pg_temp.kv('C1')), 'league:invalid_transition');
select pg_temp.as_anon();
select pg_temp.ok('anon: draft competition page is null', public.competition_page(pg_temp.kv('Lslug'), pg_temp.kv('Cslug')) is null);
select pg_temp.as_user('01');
select public.publish_regulation(pg_temp.k('C1'), 1);
select pg_temp.ok('registration opens', public.set_competition_status(pg_temp.k('C1'), 'registration_open')->>'status' = 'registration_open');
select pg_temp.ok('opening registrations activates the league', (select status from public.leagues where id = pg_temp.k('L')) = 'active');
select pg_temp.as_anon();
select pg_temp.ok('anon: competition of a PRIVATE league is null without key', public.competition_page(pg_temp.kv('Lslug'), pg_temp.kv('Cslug')) is null);
select pg_temp.ok('anon: private league page lists no competitions without key', public.league_page(pg_temp.kv('Lslug')) is null);
select pg_temp.as_user('01');
select public.update_league(pg_temp.k('L'), '{"visibility":"public"}');
select pg_temp.as_anon();
select pg_temp.ok('anon: public competition page carries the published regulation v1',
  public.competition_page(pg_temp.kv('Lslug'), pg_temp.kv('Cslug')) @> '{"status":"registration_open","regulation":{"version":1}}'
  and public.competition_page(pg_temp.kv('Lslug'), pg_temp.kv('Cslug'))->>'view_key' is null);
select pg_temp.ok('anon: public league page lists its competition (league_page.competitions[])',
  public.league_page(pg_temp.kv('Lslug'))->'competitions' @> format('[{"id":"%s","status":"registration_open"}]', pg_temp.kv('C1'))::jsonb);
select pg_temp.as_user('01');
select pg_temp.setkv('Cdraft', public.create_competition(pg_temp.k('L'), '{"name":"Taça Draft"}')->>'competition_id');
select pg_temp.ok('owner sees the draft competition in league_page (staff)',
  public.league_page(pg_temp.kv('Lslug'))->'competitions' @> format('[{"id":"%s"}]', pg_temp.kv('Cdraft'))::jsonb);
select pg_temp.as_anon();
select pg_temp.ok('anon does not see the draft competition in league_page',
  not (public.league_page(pg_temp.kv('Lslug'))->'competitions' @> format('[{"id":"%s"}]', pg_temp.kv('Cdraft'))::jsonb));
select pg_temp.as_user('06');
select pg_temp.ok('outsider does not read the draft competition through the table', not exists (select 1 from public.competitions where id = pg_temp.k('Cdraft')));
select pg_temp.ok('outsider reads the published regulation of the public competition',
  exists (select 1 from public.competition_regulations where competition_id = pg_temp.k('C1') and status = 'published'));
reset role;
select pg_temp.expect_err('published regulation is immutable (even for postgres)',
  format($$update public.competition_regulations set rules = '{}' where competition_id = %L$$, pg_temp.kv('C1')), 'league:regulation_immutable');
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.ok('v2 draft can be saved', (public.save_regulation_draft(pg_temp.k('C1'), '{"squad":{"min":1,"max":10},"tiebreakers":["pts","h2h","gd","gf"]}')->>'version')::int = 2);
select pg_temp.expect_err('publishing v2 requires a reason', format($$select public.publish_regulation(%L, 2)$$, pg_temp.kv('C1')), 'league:reason_required');
select pg_temp.ok('v2 published with a reason', (public.publish_regulation(pg_temp.k('C1'), 2, 'Plantel máximo revisto')->>'version')::int = 2);
select pg_temp.setkv('link', public.create_registration_link(pg_temp.k('C1'))->>'token');

-- ── 2. Registration + squads ─────────────────────────────
select pg_temp.as_anon();
select pg_temp.ok('anon registration link preview: valid + competition name',
  public.registration_link_preview(pg_temp.kv('link')) @> '{"status":"valid","competition":{"name":"Liga de Sábado"}}');
select pg_temp.as_user('15');
select pg_temp.expect_err('a plain player cannot register the team', format($$select public.register_team(%L, %L)$$, pg_temp.kv('link'), pg_temp.kv('A')), 'league:not_team_leader');
select pg_temp.as_user('11'); select pg_temp.setkv('rA', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id');
select pg_temp.ok('register_team is idempotent', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id' = pg_temp.kv('rA'));
select pg_temp.expect_err('squad: a non-member is refused',
  format($$select public.submit_squad(%L, '[{"player_id":"%s"}]')$$, pg_temp.kv('rA'), pg_temp.pl('16')), 'league:not_team_member');
select public.submit_squad(pg_temp.k('rA'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('11'), 'shirt_number', 10),
                                                             jsonb_build_object('player_id', pg_temp.pl('15'), 'shirt_number', 7)));
select pg_temp.as_user('12'); select pg_temp.setkv('rB', public.register_team(pg_temp.kv('link'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('rB'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('12'))));
select pg_temp.as_user('13'); select pg_temp.setkv('rC', public.register_team(pg_temp.kv('link'), pg_temp.k('C'))->>'registration_id');
select public.submit_squad(pg_temp.k('rC'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('13'))));
select pg_temp.as_user('14'); select pg_temp.setkv('rD', public.register_team(pg_temp.kv('link'), pg_temp.k('D'))->>'registration_id');
select public.submit_squad(pg_temp.k('rD'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('14'))));
select pg_temp.expect_err('a team leader cannot homologate their own squad',
  format($$select public.decide_squad(%L, 1, 'approve')$$, pg_temp.kv('rD')), 'league:not_found');
select pg_temp.as_anon();
select pg_temp.ok('anon: no team listed before homologation', jsonb_array_length(public.competition_teams_page(pg_temp.k('C1'))->'items') = 0);
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k(r), 1, 'approve') from unnest(array['rA','rB','rC','rD']) r;
select pg_temp.ok('4 registrations homologated with frozen names',
  (select count(*) from public.competition_teams where competition_id = pg_temp.k('C1') and status = 'homologated' and registered_name is not null) = 4);
reset role;
select pg_temp.expect_err('squad player rows are write-once (even for postgres)',
  format($$update public.competition_squad_players set shirt_number = 99 where registration_id = %L$$, pg_temp.kv('rA')), 'league:');
set local role authenticated;
select pg_temp.as_anon();
select pg_temp.ok('anon: 4 teams with squads by display name, no PII',
  jsonb_array_length(public.competition_teams_page(pg_temp.k('C1'))->'items') = 4
  and position('secret-' in public.competition_teams_page(pg_temp.k('C1'))::text) = 0
  and position('+35191' in public.competition_teams_page(pg_temp.k('C1'))::text) = 0);
-- Live roster changes do not alter the homologated squad.
select pg_temp.as_user('15'); select public.leave_team(pg_temp.k('A'));
select pg_temp.as_user('01');
select pg_temp.ok('player leaving the team stays in the homologated squad (no silent change)',
  exists (select 1 from public.competition_squad_players sp join public.competition_teams ct on ct.id = sp.registration_id and sp.version = ct.homologated_squad_version
           where ct.id = pg_temp.k('rA') and sp.player_id = pg_temp.pl('15')));
select pg_temp.ok('competition moves to registration_closed → in_progress',
  public.set_competition_status(pg_temp.k('C1'), 'registration_closed')->>'status' = 'registration_closed');
select pg_temp.ok('in_progress', public.set_competition_status(pg_temp.k('C1'), 'in_progress')->>'status' = 'in_progress');

-- ── 3. Audit trail ───────────────────────────────────────
reset role;
select pg_temp.ok('audit row for ' || a, exists (select 1 from public.league_audit_log where action = a and league_id = pg_temp.k('L')))
from unnest(array['competition_created','regulation_published','competition_status','registration_link_created']) a;

select n, check_name, ok, detail from _f order by n;
rollback;
