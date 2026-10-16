-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — check for migrations L3a + L3b
-- (20261016155300_league_match_origin.sql, 20261016155400_league_match_events.sql):
-- team_matches origin (challenge | competition), phases/rounds/fixtures,
-- officials, Rivals guards, the append-only event log + match lifecycle.
-- Same contract as supabase/tests/rivals_*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
-- ALSO re-run supabase/tests/rivals_*_check.sql after these migrations
-- (they change public.team_matches).
-- Source: docs/ligas-draft-sql/check_flow.sql §3–§5, §12 + grants.
--
-- Fixture: users …f4NN / players …e5NN
--   01 Olga owner   03 Sara scorer (assigned)   06 Zé outsider
--   11 Ana captain A  15 Abel player A   12 Bruno captain B  16 Beto player B
--   13 Caio captain C  14 Duda captain D  09 admin
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

-- ── 0. Grants / RLS matrix ───────────────────────────────
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['competition_phases','competition_groups','competition_rounds','team_match_officials','team_match_events','team_match_events_effective']) t;
select pg_temp.ok(t || ': authenticated has no INSERT/UPDATE/DELETE', not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['competition_phases','competition_groups','competition_rounds','team_match_officials','team_match_events','team_match_events_effective']) t;
select pg_temp.ok(t || ': service_role can read', has_table_privilege('service_role', 'public.' || t, 'SELECT'))
from unnest(array['competition_phases','competition_groups','competition_rounds','team_match_officials','team_match_events','team_match_events_effective']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['competition_phases','competition_groups','competition_rounds','team_match_officials','team_match_events']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('team_matches: existing rows default to source_type challenge',
  not exists (select 1 from public.team_matches where source_type is distinct from 'challenge' and competition_id is null));
select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.competition_matches(uuid,integer,text)', 'anon', true),
  ('public.match_live(uuid,text)', 'anon', true),
  ('public.record_match_event(uuid,jsonb)', 'anon', false),
  ('public.record_match_event(uuid,jsonb)', 'authenticated', true),
  ('public.create_fixtures(uuid,jsonb)', 'anon', false),
  ('public.league_rpc_begin()', 'authenticated', false)
) v(f, r, e);

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f4' || n)::uuid, 'fl-' || n || '@example.test'
  from unnest(array['01','03','06','09','11','12','13','14','15','16']) n;
insert into public.players (id, user_id, name, nick, magic_token, email, phone, position)
select ('00000000-0000-0000-0000-00000000e5' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f4' || x.n)::uuid,
       x.nm || ' Teste', x.nm, 'fltest000000000000000000000e5' || x.n || 'x', 'secret-' || x.n || '@mail.test', '+3519100' || x.n, 'Médio'
  from (values ('01','Olga'),('03','Sara'),('06','Zé'),('09','Admin'),('11','Ana'),('12','Bruno'),
               ('13','Caio'),('14','Duda'),('15','Abel'),('16','Beto')) x(n, nm);

set local role authenticated;
select pg_temp.as_user('11'); select pg_temp.setkv('A', public.create_team('Leões Liga')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.k('A'))->>'token');
select pg_temp.as_user('12'); select pg_temp.setkv('B', public.create_team('Dragões Liga')->>'team_id');
select pg_temp.setkv('iB', public.create_team_invite(pg_temp.k('B'))->>'token');
select pg_temp.as_user('13'); select pg_temp.setkv('C', public.create_team('Águias Liga')->>'team_id');
select pg_temp.as_user('14'); select pg_temp.setkv('D', public.create_team('Lobos Liga')->>'team_id');
select pg_temp.as_user('15'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('16'); select public.accept_team_invite(pg_temp.kv('iB'));

select pg_temp.as_user('01'); select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Flow"}')->>'request_id');
select pg_temp.as_user('09'); select public.review_league_access(pg_temp.k('req'), 'approve');
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Flow')->>'league_id');
select public.update_league(pg_temp.k('L'), '{"visibility":"public"}');
select pg_temp.setkv('iS', public.create_league_invite(pg_temp.k('L'), 'scorer')->>'token');
select pg_temp.as_user('03'); select public.accept_league_invite(pg_temp.kv('iS'));
select pg_temp.as_user('01');
select pg_temp.setkv('C1', public.create_competition(pg_temp.k('L'), '{"name":"Liga de Sábado"}', '{"squad":{"min":1,"max":10}}')->>'competition_id');
select public.publish_regulation(pg_temp.k('C1'), 1);
select public.set_competition_status(pg_temp.k('C1'), 'registration_open');
select pg_temp.setkv('link', public.create_registration_link(pg_temp.k('C1'))->>'token');
select pg_temp.as_user('11'); select pg_temp.setkv('rA', public.register_team(pg_temp.kv('link'), pg_temp.k('A'))->>'registration_id');
select public.submit_squad(pg_temp.k('rA'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('11')), jsonb_build_object('player_id', pg_temp.pl('15'))));
select pg_temp.as_user('12'); select pg_temp.setkv('rB', public.register_team(pg_temp.kv('link'), pg_temp.k('B'))->>'registration_id');
select public.submit_squad(pg_temp.k('rB'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('12')), jsonb_build_object('player_id', pg_temp.pl('16'))));
select pg_temp.as_user('13'); select pg_temp.setkv('rC', public.register_team(pg_temp.kv('link'), pg_temp.k('C'))->>'registration_id');
select public.submit_squad(pg_temp.k('rC'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('13'))));
select pg_temp.as_user('14'); select pg_temp.setkv('rD', public.register_team(pg_temp.kv('link'), pg_temp.k('D'))->>'registration_id');
select public.submit_squad(pg_temp.k('rD'), jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('14'))));
select pg_temp.as_user('01');
select public.decide_squad(pg_temp.k(r), 1, 'approve') from unnest(array['rA','rB','rC','rD']) r;
select public.set_competition_status(pg_temp.k('C1'), 'registration_closed');
select public.set_competition_status(pg_temp.k('C1'), 'in_progress');

-- ── 1. Phase + fixtures ──────────────────────────────────
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
select pg_temp.ok('create_fixtures: 6 matches', (public.create_fixtures(pg_temp.k('P'), pg_temp.kv('fx')::jsonb)->>'matches')::int = 6);
select pg_temp.ok('6 fixtures, all unscheduled with no kickoff, same table as friendlies',
  (select count(*) from public.team_matches where competition_id = pg_temp.k('C1') and match_status = 'unscheduled' and kickoff_at is null
     and source_type = 'competition' and challenge_id is null) = 6);
select pg_temp.ok('create_fixtures replay with the same set is idempotent', not (public.create_fixtures(pg_temp.k('P'), pg_temp.kv('fx')::jsonb)->>'created')::boolean);
select pg_temp.setkv('m1', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('A') and m.away_team_id = pg_temp.k('B')));
select pg_temp.setkv('m3', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('C') and m.away_team_id = pg_temp.k('D')));
select pg_temp.setkv('m4', (select m.id::text from public.team_matches m where m.competition_id = pg_temp.k('C1') and m.home_team_id = pg_temp.k('B') and m.away_team_id = pg_temp.k('D')));
select public.schedule_match(pg_temp.k(m), now() - interval '1 hour', '{"name":"Campo Flow"}') from unnest(array['m1','m3','m4']) m;
select pg_temp.ok('scheduled match has kickoff and status scheduled',
  exists (select 1 from public.team_matches where id = pg_temp.k('m1') and match_status = 'scheduled' and kickoff_at is not null));
select public.assign_official(pg_temp.k('m1'), pg_temp.pl('03'), 'scorer');
select pg_temp.expect_err('only league collaborators can be assigned', format($$select public.assign_official(%L, %L, 'referee')$$, pg_temp.kv('m1'), pg_temp.pl('06')), 'league:not_a_collaborator');
-- (RPC and its verification in separate statements: uncorrelated sub-selects can run first)
select pg_temp.ok('set_match_off(postponed) returns', public.set_match_off(pg_temp.k('m4'), 'postponed', 'Campo alagado') is not null);
select pg_temp.ok('postpone keeps the same id and clears the kickoff',
  exists (select 1 from public.team_matches where id = pg_temp.k('m4') and match_status = 'postponed' and kickoff_at is null));
select pg_temp.expect_err('set_match_off requires a reason', format($$select public.set_match_off(%L, 'cancelled', '')$$, pg_temp.kv('m3')), 'league:');
select pg_temp.as_anon();
select pg_temp.ok('anon: competition_matches lists the 6 fixtures', jsonb_array_length(public.competition_matches(pg_temp.k('C1'))->'items') >= 6
  or jsonb_array_length(public.competition_matches(pg_temp.k('C1'))->'rounds') = 3);
select pg_temp.as_user('06');
select pg_temp.ok('outsider reads public league fixtures through the table (RLS can_see_competition)',
  (select count(*) from public.team_matches where competition_id = pg_temp.k('C1')) = 6);

-- ── 2. Rivals RPCs cannot touch a league match ───────────
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
reset role;
select pg_temp.expect_err('direct team_matches update outside league RPCs refused (even postgres)',
  format($$update public.team_matches set venue_name = 'x' where id = %L$$, pg_temp.kv('m1')), 'league:managed_by_league');
select pg_temp.expect_err('lineup trigger: a team member outside the homologated squad refused',
  format($$insert into public.team_match_lineup (match_id, player_id, team_id) values (%L, %L, %L)$$, pg_temp.kv('m1'), pg_temp.pl('13'), pg_temp.kv('B')),
  'league:player_not_in_squad');
set local role authenticated;

-- ── 3. Event log ─────────────────────────────────────────
select pg_temp.as_user('03');
select pg_temp.expect_err('events refused before the match is live',
  format($$select public.record_match_event(%L, pg_temp.ev('001', '{"type":"goal","team_id":"%s"}'))$$, pg_temp.kv('m1'), pg_temp.kv('A')), 'league:match_not_live');
select pg_temp.expect_err('start with a stale seq refused', format($$select public.set_match_phase(%L, 'live', -1)$$, pg_temp.kv('m1')), 'league:stale_seq');
select pg_temp.ok('scorer starts the match', public.set_match_phase(pg_temp.k('m1'), 'live', pg_temp.seq('m1'))->>'match_status' = 'live');
select public.record_match_event(pg_temp.k('m1'), pg_temp.ev('001', jsonb_build_object('type', 'goal', 'team_id', pg_temp.kv('A'),
  'player_id', pg_temp.pl('11'), 'assist_player_id', pg_temp.pl('15'), 'period', '1H', 'minute', 12)));
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
select pg_temp.as_user('03');
select pg_temp.ok('scorer ends the match → provisional', public.set_match_phase(pg_temp.k('m1'), 'finished', pg_temp.seq('m1'))->>'result_status' = 'provisional');
select pg_temp.expect_err('a scorer cannot submit the súmula (referee/manager)', format($$select public.set_match_phase(%L, 'submitted', %s)$$, pg_temp.kv('m1'), pg_temp.seq('m1')), 'league:not_allowed');
select pg_temp.as_user('01');
select pg_temp.ok('manager submits the súmula', public.set_match_phase(pg_temp.k('m1'), 'submitted', pg_temp.seq('m1'))->>'result_status' = 'submitted');
select pg_temp.ok('league match never touches Rivals metrics (team_record A: 0 played)',
  (public.team_record(pg_temp.k('A'))->>'played')::int = 0);

-- ── 4. Cards stay league-only; friendlies unchanged ──────
select pg_temp.as_user('11');
select pg_temp.setkv('ch', public.create_challenge(pg_temp.k('A'), pg_temp.k('B'),
  jsonb_build_object('kickoff_at', now() + interval '72 hours', 'venue_name', 'Campo', 'format', '7v7', 'duration_min', 60, 'cost_cents', 6000))->>'challenge_id');
select pg_temp.as_user('12');
select pg_temp.setkv('fr', public.respond_challenge(pg_temp.k('ch'), 1, 'accept')->>'match_id');
reset role;
select pg_temp.ok('a Rivals friendly is still created as a challenge-origin row',
  (select source_type from public.team_matches where id = pg_temp.k('fr')) = 'challenge');
select pg_temp.expect_err('no events (cards) on a friendly — league-only', format($$insert into public.team_match_events (id, match_id, seq, type, team_id, player_id)
  values (gen_random_uuid(), %L, 1, 'yellow', %L, %L)$$, pg_temp.kv('fr'), pg_temp.kv('A'), pg_temp.pl('11')), 'league:events_competition_only');
select pg_temp.expect_err('origin CHECK: a competition row cannot be confirmed',
  format($$update public.team_matches set result_status = 'confirmed' where id = %L$$, pg_temp.kv('m1')), 'violates check constraint');
select pg_temp.expect_err('origin CHECK: a challenge row needs its challenge columns',
  format($$update public.team_matches set kickoff_at = null where id = %L$$, pg_temp.kv('fr')), 'violates check constraint');

select n, check_name, ok, detail from _f order by n;
rollback;
