-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migration L-fans
-- (20261016155500_league_fans_follows.sql): supported team, follows,
-- notification preferences, my_following ("Acompanhando").
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- Source: docs/ligas-draft-sql/check_flow.sql §11 (fans part) + grants.
--
-- Fixture: 01 Olga owner · 04 Fábio fan (no role) · 05 Gil fan 2 ·
--          11 Ana captain A · 12 Bruno captain B · 09 admin
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

-- ── 0. Grants / RLS ──────────────────────────────────────
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['competition_supporters','follows','notification_preferences']) t;
select pg_temp.ok(t || ': authenticated has no INSERT/UPDATE/DELETE', not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['competition_supporters','follows','notification_preferences']) t;
select pg_temp.ok(t || ': service_role full access',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['competition_supporters','follows','notification_preferences']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['competition_supporters','follows','notification_preferences']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('execute ' || f || ' as anon = false', not has_function_privilege('anon', f, 'EXECUTE'))
from unnest(array['public.set_supported_team(uuid,uuid)', 'public.follow(text,uuid,boolean,boolean)',
                  'public.set_notification_preference(text,text,boolean)', 'public.my_following()']) f;

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f4' || n)::uuid, 'fl-' || n || '@example.test'
  from unnest(array['01','04','05','09','11','12']) n;
insert into public.players (id, user_id, name, nick, magic_token, email, phone, position)
select ('00000000-0000-0000-0000-00000000e5' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f4' || x.n)::uuid,
       x.nm || ' Teste', x.nm, 'fltest000000000000000000000e5' || x.n || 'x', 'secret-' || x.n || '@mail.test', '+3519100' || x.n, 'Médio'
  from (values ('01','Olga'),('04','Fábio'),('05','Gil'),('09','Admin'),('11','Ana'),('12','Bruno')) x(n, nm);

set local role authenticated;
select pg_temp.as_user('11'); select pg_temp.setkv('A', public.create_team('Leões Liga')->>'team_id');
select pg_temp.as_user('12'); select pg_temp.setkv('B', public.create_team('Dragões Liga')->>'team_id');
select pg_temp.as_user('01'); select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Fans"}')->>'request_id');
select pg_temp.as_user('09'); select public.review_league_access(pg_temp.k('req'), 'approve');
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Fans')->>'league_id');
select pg_temp.setkv('C1', public.create_competition(pg_temp.k('L'), '{"name":"Liga de Sábado"}', '{"squad":{"min":1,"max":10}}')->>'competition_id');
select public.publish_regulation(pg_temp.k('C1'), 1);
select public.set_competition_status(pg_temp.k('C1'), 'registration_open');
select pg_temp.setkv('link', public.create_registration_link(pg_temp.k('C1'))->>'token');
select pg_temp.as_user('11'); select pg_temp.setkv('rA', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id');
select public.submit_squad(pg_temp.k('rA'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('11'))));
select pg_temp.as_user('12'); select pg_temp.setkv('rB', public.register_team(pg_temp.kv('link'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('rB'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('12'))));
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k('rA'), 1, 'approve');

-- ── 1. Private league: fans cannot probe ─────────────────
select pg_temp.as_user('04');
select pg_temp.expect_err('fan cannot support a team in a PRIVATE competition', format($$select public.set_supported_team(%L, %L)$$, pg_temp.kv('C1'), pg_temp.kv('A')), 'league:not_found');
select pg_temp.expect_err('fan cannot follow a private league', format($$select public.follow('league', %L)$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.as_user('01'); select public.update_league(pg_temp.k('L'), '{"visibility":"public"}');

-- ── 2. Supported team + follows ──────────────────────────
select pg_temp.as_user('04');
select pg_temp.ok('fan (no role) supports team A', public.set_supported_team(pg_temp.k('C1'), pg_temp.k('A'))->>'team_id' = pg_temp.kv('A'));
select pg_temp.ok('supporting auto-follows team + competition', jsonb_array_length(public.my_following()->'follows') = 2);
select pg_temp.expect_err('fan cannot support a team not in the competition', format($$select public.set_supported_team(%L, %L)$$, pg_temp.kv('C1'), gen_random_uuid()), 'league:team_not_registered');
select pg_temp.expect_err('fan cannot support a team whose squad is not homologated', format($$select public.set_supported_team(%L, %L)$$, pg_temp.kv('C1'), pg_temp.kv('B')), 'league:team_not_registered');
select pg_temp.ok('fan follows the public league', (public.follow('league', pg_temp.k('L'))->>'following')::boolean);
select pg_temp.ok('follow is idempotent (no duplicate row)', (public.follow('league', pg_temp.k('L'), true, false)->>'following')::boolean
  and (select count(*) from public.follows where entity_type = 'league') = 1);
select pg_temp.expect_err('cannot follow yourself', format($$select public.follow('player', %L)$$, pg_temp.pl('04')), 'league:not_found');
select pg_temp.ok('fan follows an athlete', (public.follow('player', pg_temp.pl('11'))->>'following')::boolean);
select pg_temp.expect_err('unknown entity type refused', format($$select public.follow('group', %L)$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.ok('my_following: 1 supporting + 4 follows',
  jsonb_array_length(public.my_following()->'supporting') = 1 and jsonb_array_length(public.my_following()->'follows') = 4);
select pg_temp.ok('changing the supported team replaces it (one per competition)',
  public.set_supported_team(pg_temp.k('C1'), pg_temp.k('A'))->>'team_id' = pg_temp.kv('A')
  and (select count(*) from public.competition_supporters) = 1);
select pg_temp.ok('unfollow', not (public.follow('player', pg_temp.pl('11'), false)->>'following')::boolean);
select pg_temp.ok('clearing the supported team (null)', public.set_supported_team(pg_temp.k('C1'), null)->>'team_id' is null);
select pg_temp.ok('notification preference saved', (public.set_notification_preference('result', 'push', false)->>'enabled')::boolean = false);
select pg_temp.expect_err('invalid preference refused', $$select public.set_notification_preference('spam', 'push', true)$$, 'league:invalid_preference');

-- ── 3. Privacy: rows are owner-only ──────────────────────
select pg_temp.as_user('05');
select pg_temp.ok('another account reads none of the fan''s follows / preferences',
  not exists (select 1 from public.follows) and not exists (select 1 from public.notification_preferences)
  and not exists (select 1 from public.competition_supporters));
select pg_temp.ok('a fan holds no league role', not exists (select 1 from public.league_members where player_id = pg_temp.pl('04')));
select pg_temp.as_anon();
-- (the anon role itself has no EXECUTE — §0; here the claims are anon with no player)
select pg_temp.expect_err('a caller without a player cannot follow', format($$select public.follow('league', %L)$$, pg_temp.kv('L')), 'league:not_authenticated');

select n, check_name, ok, detail from _f order by n;
rollback;
