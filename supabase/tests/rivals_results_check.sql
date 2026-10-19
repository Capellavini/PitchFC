-- ─────────────────────────────────────────────────────────
-- Manual check for migration 20261014120000_rivals_results (PITCH Rivals
-- 3/3: results, RSVP, lineup, player stats, derived metrics, rematch).
-- Run in Supabase Dashboard → SQL Editor (paste the whole file, Run) right
-- AFTER the migration is applied. Everything runs inside a transaction that
-- ROLLS BACK. One row per check — every row must be ok = true.
--
-- NOTE: inside one transaction now() is constant, so "after kickoff" is
-- simulated by moving team_matches.kickoff_at into the past as postgres, and
-- "late cancellation" relies on a 5h-ahead kickoff.
--
-- Fixture (fixed uuids; all team-only players):
--   Ana    user …f201  player …e301  captain of A "Leões Teste"
--   Vasco  user …f202  player …e302  vice of A
--   Bruno  user …f203  player …e303  captain of B "Dragões Teste"
--   Carla  user …f204  player …e304  plain player of B
--   Paulo  user …f205  player …e305  captain of C "Águias Teste"
--   Zé     user …f206  player …e306  outsider (no team)
--   Dani   user …f207  player …e307  plain player of A
--   Eva    user …f208  player …e308  vice of B
--   Gil    user …f209  player …e309  plain player of A (never in a lineup at first)
--   anon   logged-out visitor
-- Matches (all A home): m1 A–B (main flow + correction), m2 A–B (dispute
-- chain → 1-1), m3 A–C (withdraw, stats, not played), m4/m5 A–B (cancelled),
-- m7 A–B (stays scheduled: scouting).
-- ─────────────────────────────────────────────────────────

begin;

create temp table _rv (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _rv_kv (k text primary key, v text) on commit drop;
grant all on _rv, _rv_kv to authenticated, anon;
grant usage on sequence _rv_n_seq to authenticated, anon;

create function pg_temp.ok(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into _rv (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail); $$;
create function pg_temp.expect_err(p_name text, p_sql text, p_needle text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into _rv (check_name, ok, detail) values (p_name, false, 'no error raised');
exception when others then
  insert into _rv (check_name, ok, detail) values (p_name, position(p_needle in sqlerrm) > 0, sqlerrm);
end $$;
create function pg_temp.kv(p_k text) returns text language sql stable as $$ select v from _rv_kv where k = p_k; $$;
create function pg_temp.setkv(p_k text, p_v text) returns void language sql as $$
  insert into _rv_kv (k, v) values (p_k, p_v) on conflict (k) do update set v = excluded.v; $$;
create function pg_temp.terms(p_hours int, p_extra jsonb default '{}'::jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object('kickoff_at', now() + make_interval(hours => p_hours), 'venue_name', 'Campo Teste',
                            'format', '7v7', 'duration_min', 60, 'cost_cents', 6000) || p_extra; $$;
-- Act as user f2<nn> (JWT claims only — the role is switched separately).
create function pg_temp.as_user(p_nn text) returns void language sql as $$
  select set_config('request.jwt.claims',
    format('{"sub":"00000000-0000-0000-0000-00000000f2%s","role":"authenticated"}', p_nn), true); $$;
create function pg_temp.pl(p_nn text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000e3' || p_nn)::uuid; $$;
-- A (by user p_from_user) challenges B (p_to_user accepts) → agreed match stored under p_key.
create function pg_temp.mk_match(p_from uuid, p_to uuid, p_from_user text, p_to_user text, p_key text, p_hours int default 72)
returns void language plpgsql as $$
declare r jsonb; a jsonb;
begin
  perform pg_temp.as_user(p_from_user);
  r := public.create_challenge(p_from, p_to, pg_temp.terms(p_hours));
  perform pg_temp.as_user(p_to_user);
  a := public.respond_challenge((r->>'challenge_id')::uuid, 1, 'accept');
  perform pg_temp.setkv(p_key, a->>'match_id');
  perform pg_temp.setkv(p_key || '_ch', r->>'challenge_id');
end $$;
-- The `match` object of one of my challenges (via my_challenges()).
create function pg_temp.mymatch(p_key text) returns jsonb language sql stable as $$
  select i->'match' from jsonb_array_elements(public.my_challenges()->'items') i where i->'match'->>'id' = pg_temp.kv(p_key); $$;
create function pg_temp.past(p_key text, p_hours int) returns void language sql as $$
  update public.team_matches set kickoff_at = now() - make_interval(hours => p_hours) where id = pg_temp.kv(p_key)::uuid; $$;
grant execute on function pg_temp.ok(text, boolean, text), pg_temp.expect_err(text, text, text),
                          pg_temp.kv(text), pg_temp.setkv(text, text), pg_temp.terms(int, jsonb),
                          pg_temp.as_user(text), pg_temp.pl(text), pg_temp.mymatch(text),
                          pg_temp.mk_match(uuid, uuid, text, text, text, int), pg_temp.past(text, int) to public;

-- ── Fixture (as postgres) ─────────────────────────────────
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000f2' || n)::uuid, 'rv4-' || n || '@example.test'
  from unnest(array['01','02','03','04','05','06','07','08','09']) n;
insert into public.players (id, user_id, group_id, name, nick, magic_token, position)
select ('00000000-0000-0000-0000-00000000e3' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f2' || x.n)::uuid, null,
       x.nm || ' Teste', x.nm, 'rv4test0000000000000000000000e3' || x.n, x.pos
  from (values ('01','Ana','Avançado'), ('02','Vasco','Médio'), ('03','Bruno','Defesa'), ('04','Carla','Médio'),
               ('05','Paulo','Avançado'), ('06','Zé','Defesa'), ('07','Dani','Guarda-redes'), ('08','Eva','Avançado'),
               ('09','Gil','Médio')) x(n, nm, pos);

-- Teams through the 007000 RPCs.
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.setkv('A', public.create_team('Leões Teste', '{"city":"Porto"}')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.kv('A')::uuid)->>'token');
select pg_temp.as_user('03');
select pg_temp.setkv('B', public.create_team('Dragões Teste', '{"city":"Porto"}')->>'team_id');
select pg_temp.setkv('iB', public.create_team_invite(pg_temp.kv('B')::uuid)->>'token');
select pg_temp.as_user('05');
select pg_temp.setkv('C', public.create_team('Águias Teste', '{"city":"Maia"}')->>'team_id');
select pg_temp.as_user('02'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('07'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('09'); select public.accept_team_invite(pg_temp.kv('iA'));
select pg_temp.as_user('04'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('08'); select public.accept_team_invite(pg_temp.kv('iB'));
select pg_temp.as_user('01'); select public.set_member_role(pg_temp.kv('A')::uuid, pg_temp.pl('02'), 'vice');
select pg_temp.as_user('03'); select public.set_member_role(pg_temp.kv('B')::uuid, pg_temp.pl('08'), 'vice');
reset role;

select pg_temp.setkv('slugA', (select slug from public.teams where id = pg_temp.kv('A')::uuid));
-- Agreed matches (A is always the home team).
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, '01', '03', 'm1');
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, '01', '03', 'm2');
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid, '01', '05', 'm3');
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, '01', '03', 'm4');
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, '01', '03', 'm5', 5);
select pg_temp.mk_match(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, '01', '03', 'm7');

-- ── 1. Grants matrix ──────────────────────────────────────
select pg_temp.ok(t || ': authenticated SELECT only',
       has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT')
   and not has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
   and not has_table_privilege('authenticated', 'public.' || t, 'DELETE'))
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t;
select pg_temp.ok(t || ': anon has NO table privilege',
       not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t;
select pg_temp.ok(t || ': service_role select/insert/update/delete',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t
join pg_class c on c.oid = ('public.' || t)::regclass;

select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.set_match_availability(uuid,text)',                  'authenticated', true),
  ('public.set_match_availability(uuid,text)',                  'anon',          false),
  ('public.set_match_lineup(uuid,uuid[])',                      'authenticated', true),
  ('public.set_match_lineup(uuid,uuid[])',                      'anon',          false),
  ('public.set_match_player_stats(uuid,jsonb)',                 'authenticated', true),
  ('public.set_match_player_stats(uuid,jsonb)',                 'anon',          false),
  ('public.report_match_result(uuid,int,int,text)',             'authenticated', true),
  ('public.report_match_result(uuid,int,int,text)',             'anon',          false),
  ('public.confirm_match_result(uuid,int)',                     'authenticated', true),
  ('public.confirm_match_result(uuid,int)',                     'anon',          false),
  ('public.contest_match_result(uuid,int,int,int,text)',        'authenticated', true),
  ('public.contest_match_result(uuid,int,int,int,text)',        'anon',          false),
  ('public.propose_result_correction(uuid,int,int,text)',       'authenticated', true),
  ('public.propose_result_correction(uuid,int,int,text)',       'anon',          false),
  ('public.withdraw_result_proposal(uuid,int)',                 'authenticated', true),
  ('public.withdraw_result_proposal(uuid,int)',                 'anon',          false),
  ('public.mark_match_not_played(uuid,text)',                   'authenticated', true),
  ('public.mark_match_not_played(uuid,text)',                   'anon',          false),
  ('public.create_rematch(uuid,jsonb,text)',                    'authenticated', true),
  ('public.create_rematch(uuid,jsonb,text)',                    'anon',          false),
  ('public.get_match_availability(uuid)',                       'authenticated', true),
  ('public.get_match_availability(uuid)',                       'anon',          false),
  ('public.get_match_lineup(uuid)',                             'anon',          false),
  ('public.get_match_results(uuid)',                            'anon',          false),
  ('public.get_match_player_stats(uuid)',                       'anon',          false),
  ('public.team_record(uuid)',                                  'authenticated', true),
  ('public.team_record(uuid)',                                  'anon',          false),
  ('public.team_head_to_head(uuid,uuid)',                       'anon',          false),
  ('public.team_player_stats(uuid)',                            'anon',          false),
  ('public.scout_opponent(uuid)',                               'authenticated', true),
  ('public.scout_opponent(uuid)',                               'anon',          false),
  ('public.my_team_career()',                                   'anon',          false),
  ('public.my_challenges()',                                    'authenticated', true),
  ('public.my_challenges()',                                    'anon',          false),
  ('public.team_profile(text)',                                 'anon',          true),
  ('public.team_profile(text)',                                 'authenticated', true),
  ('public.can_see_match(uuid)',                                'anon',          false),
  ('public.rivals_team_record(uuid)',                           'authenticated', false),
  ('public.rivals_team_results(uuid)',                          'authenticated', false),
  ('public.rivals_roster_stats(uuid,boolean)',                  'authenticated', false),
  ('public.rivals_answering_team(public.team_matches,public.team_match_results)', 'authenticated', false),
  ('public.rivals_match_extras(public.team_matches,uuid)',      'authenticated', false),
  ('public.rivals_leader_team(public.team_matches)',            'authenticated', false)
) v(f, r, e);

select pg_temp.ok('realtime publication has ' || t,
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t))
from unnest(array['team_match_results','team_match_availability']) t;
select pg_temp.ok('pg_cron job pitch-rivals-expire still scheduled hourly',
  exists (select 1 from cron.job where jobname = 'pitch-rivals-expire' and schedule = '15 * * * *'));

-- ── 2. Group game tables untouched (option B regression) ──
select pg_temp.ok('games/attendances/matchdays policies identical to the ' || b || ' baseline',
  (select payload->>'group_policies_md5' from public.rivals_audit_log where action = b)
  = (select md5(coalesce(string_agg(
       format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
              coalesce(qual, ''), coalesce(with_check, '')),
       E'\n' order by tablename, policyname), ''))
     from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')))
from unnest(array['migration_baseline:007000','migration_baseline:20261013140000','migration_baseline:20261014120000']) b;
select pg_temp.ok('no games/attendances/matchdays policy references the results tables',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')
               and (coalesce(qual, '') ilike '%team_match%' or coalesce(with_check, '') ilike '%team_match%')));

-- ── 3. No direct writes (authenticated) / no access (anon) ─
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('direct ' || o.op || ' on ' || t || ' denied',
  case o.op when 'insert' then format('insert into public.%I default values', t)
            when 'update' then format('update public.%I set match_id = match_id', t)
            else format('delete from public.%I', t) end, 'permission denied')
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t
cross join (values ('insert'), ('update'), ('delete')) o(op);
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.expect_err('anon cannot read ' || t, format('select count(*) from public.%I', t), 'permission denied')
from unnest(array['team_match_results','team_match_availability','team_match_lineup','team_match_player_stats']) t;
select pg_temp.expect_err('anon cannot call report_match_result',
  format($q$select public.report_match_result(%L, 1, 0)$q$, pg_temp.kv('m1')), 'permission denied');
select pg_temp.expect_err('anon cannot call team_record', format('select public.team_record(%L)', pg_temp.kv('A')), 'permission denied');
reset role;

-- ── 4. RSVP (convocatória) ────────────────────────────────
set local role authenticated;
select pg_temp.as_user('07');  -- Dani, plain member of A
do $$
declare r jsonb;
begin
  r := public.set_match_availability(pg_temp.kv('m1')::uuid, 'yes');
  perform pg_temp.ok('rsvp: a plain member answers for their own team', r->>'status' = 'yes' and r->>'team_id' = pg_temp.kv('A'), r::text);
  perform public.set_match_availability(pg_temp.kv('m1')::uuid, 'no');
  perform public.set_match_availability(pg_temp.kv('m1')::uuid, 'yes');
  perform pg_temp.ok('rsvp: changing the answer keeps ONE row (upsert)',
    (select count(*) from public.team_match_availability where match_id = pg_temp.kv('m1')::uuid and player_id = pg_temp.pl('07')) = 1);
end $$;
select pg_temp.expect_err('rsvp: invalid status refused',
  format($q$select public.set_match_availability(%L, 'sure')$q$, pg_temp.kv('m1')), 'rivals:invalid_status');
select pg_temp.as_user('04');  -- Carla, plain member of B
select public.set_match_availability(pg_temp.kv('m1')::uuid, 'maybe');
select pg_temp.as_user('06');  -- Zé, outsider
select pg_temp.expect_err('rsvp: an outsider cannot answer',
  format($q$select public.set_match_availability(%L, 'yes')$q$, pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.expect_err('rsvp: an outsider cannot read the availability',
  format('select public.get_match_availability(%L)', pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.ok('rsvp: an outsider sees no availability rows',
  (select count(*) from public.team_match_availability where match_id = pg_temp.kv('m1')::uuid) = 0);
select pg_temp.as_user('05');  -- Paulo, captain of C (not in m1)
select pg_temp.expect_err('rsvp: a third team cannot answer',
  format($q$select public.set_match_availability(%L, 'yes')$q$, pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.as_user('03');  -- Bruno, captain of B
do $$
declare a jsonb;
begin
  a := public.get_match_availability(pg_temp.kv('m1')::uuid);
  perform pg_temp.ok('availability: the other team reads only ITS OWN roster (3 players, none from A)',
    jsonb_array_length(a->'items') = 3
    and not exists (select 1 from jsonb_array_elements(a->'items') i where (i->>'player_id')::uuid = pg_temp.pl('07')), a::text);
  perform pg_temp.ok('availability: B counts = 1 maybe, 2 pending, 0 yes (A answers invisible)',
    (a->'counts'->>'maybe')::int = 1 and (a->'counts'->>'pending')::int = 2 and (a->'counts'->>'yes')::int = 0, (a->'counts')::text);
  perform pg_temp.ok('availability: the other team cannot see A through the table either',
    (select count(*) from public.team_match_availability where match_id = pg_temp.kv('m1')::uuid) = 1
    and not exists (select 1 from public.team_match_availability where player_id = pg_temp.pl('07')));
end $$;
select pg_temp.as_user('01');  -- Ana
do $$
declare a jsonb;
begin
  a := public.get_match_availability(pg_temp.kv('m1')::uuid);
  perform pg_temp.ok('availability: A sees its 4 players with Dani = yes, counts yes 1 / pending 3',
    jsonb_array_length(a->'items') = 4 and (a->'counts'->>'yes')::int = 1 and (a->'counts'->>'pending')::int = 3
    and exists (select 1 from jsonb_array_elements(a->'items') i where (i->>'player_id')::uuid = pg_temp.pl('07') and i->>'status' = 'yes'
                  and i->>'role' = 'player'), a::text);
end $$;
select pg_temp.as_user('07');
do $$
declare mm jsonb;
begin
  mm := pg_temp.mymatch('m1');
  perform pg_temp.ok('my_challenges: match gains my_availability / availability_counts / lineup_count / stats_recorded / result',
    mm->>'my_availability' = 'yes' and (mm->'availability_counts'->>'yes')::int = 1 and (mm->'availability_counts'->>'pending')::int = 3
    and (mm->>'lineup_count')::int = 0 and (mm->>'stats_recorded')::boolean = false
    and mm->'result'->>'status' = 'none' and mm->'result'->'open_revision' = 'null'::jsonb and (mm->'result'->>'revisions_count')::int = 0, mm::text);
  perform pg_temp.ok('my_challenges: every pre-existing match key is still there',
    mm ?& array['id','home_team_id','away_team_id','agreed_version','match_status','field_status','result_status',
                'official_home_score','official_away_score','cancelled_by_team_id','cancel_reason','kickoff_at','format','venue_name']);
end $$;
reset role;

-- ── 5. Lineup ─────────────────────────────────────────────
set local role authenticated;
select pg_temp.as_user('07');
select pg_temp.expect_err('lineup: a plain member cannot set it',
  format('select public.set_match_lineup(%L, array[%L]::uuid[])', pg_temp.kv('m1'), pg_temp.pl('07')), 'rivals:not_team_leader');
select pg_temp.as_user('06');
select pg_temp.expect_err('lineup: an outsider cannot set it',
  format('select public.set_match_lineup(%L, array[%L]::uuid[])', pg_temp.kv('m1'), pg_temp.pl('07')), 'rivals:not_team_leader');
select pg_temp.as_user('01');
select pg_temp.expect_err('lineup: a player of the OTHER team is refused',
  format('select public.set_match_lineup(%L, array[%L, %L]::uuid[])', pg_temp.kv('m1'), pg_temp.pl('01'), pg_temp.pl('04')), 'rivals:invalid_lineup');
select pg_temp.expect_err('lineup: duplicates refused',
  format('select public.set_match_lineup(%L, array[%L, %L]::uuid[])', pg_temp.kv('m1'), pg_temp.pl('01'), pg_temp.pl('01')), 'rivals:invalid_lineup');
select pg_temp.expect_err('lineup: null array refused',
  format('select public.set_match_lineup(%L, null)', pg_temp.kv('m1')), 'rivals:invalid_lineup');
select pg_temp.expect_err('lineup: more than 22 ids refused',
  format('select public.set_match_lineup(%L, (select array_agg(gen_random_uuid()) from generate_series(1, 23)))', pg_temp.kv('m1')), 'rivals:invalid_lineup');
do $$
declare r jsonb;
begin
  r := public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('02'), pg_temp.pl('07')]);
  perform pg_temp.ok('lineup: the captain sets 3 active members of A', (r->>'count')::int = 3 and r->>'team_id' = pg_temp.kv('A'), r::text);
  r := public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('02'), pg_temp.pl('07')]);
  perform pg_temp.ok('lineup: setting it again replaces (still 3 rows)',
    (select count(*) from public.team_match_lineup where match_id = pg_temp.kv('m1')::uuid and team_id = pg_temp.kv('A')::uuid) = 3);
end $$;
select pg_temp.as_user('03');
select public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('03'), pg_temp.pl('04')]);
select pg_temp.ok('lineup: before the match is played each team sees only its own lineup',
  (select jsonb_array_length(public.get_match_lineup(pg_temp.kv('m1')::uuid)->'items')) = 2
  and not exists (select 1 from jsonb_array_elements(public.get_match_lineup(pg_temp.kv('m1')::uuid)->'items') i where i->>'team_id' = pg_temp.kv('A'))
  and (select count(*) from public.team_match_lineup where match_id = pg_temp.kv('m1')::uuid) = 2);
select pg_temp.as_user('06');
select pg_temp.expect_err('lineup: an outsider cannot read it', format('select public.get_match_lineup(%L)', pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.as_user('07');
select pg_temp.ok('my_challenges: lineup_count = my team''s lineup (3)', (pg_temp.mymatch('m1')->>'lineup_count')::int = 3);
reset role;

-- ── 6. Stats are post-game only ───────────────────────────
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('stats: before kickoff refused',
  format($q$select public.set_match_player_stats(%L, '[]'::jsonb)$q$, pg_temp.kv('m1')), 'rivals:too_early');
select pg_temp.expect_err('result: reporting before kickoff refused',
  format('select public.report_match_result(%L, 1, 0)', pg_temp.kv('m1')), 'rivals:too_early');
select pg_temp.expect_err('not played: before kickoff refused',
  format('select public.mark_match_not_played(%L)', pg_temp.kv('m1')), 'rivals:too_early');
reset role;

-- Kickoff passes: m1 3h ago, m2 1h ago (m2 is the newer one), m3 2h ago.
select pg_temp.past('m1', 3);
select pg_temp.past('m2', 1);
select pg_temp.past('m3', 2);

set local role authenticated;
select pg_temp.as_user('07');
select pg_temp.expect_err('rsvp: after kickoff refused',
  format($q$select public.set_match_availability(%L, 'yes')$q$, pg_temp.kv('m1')), 'rivals:too_late');
select pg_temp.expect_err('stats: a plain member cannot set them',
  format($q$select public.set_match_player_stats(%L, '[]'::jsonb)$q$, pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('01');
select pg_temp.expect_err('stats: a player outside the lineup is refused (Gil)',
  format($q$select public.set_match_player_stats(%L, jsonb_build_array(jsonb_build_object('player_id', %L, 'goals', 1, 'assists', 0)))$q$,
         pg_temp.kv('m1'), pg_temp.pl('09')), 'rivals:invalid_stats');
select pg_temp.expect_err('stats: a player of the other team is refused',
  format($q$select public.set_match_player_stats(%L, jsonb_build_array(jsonb_build_object('player_id', %L, 'goals', 1, 'assists', 0)))$q$,
         pg_temp.kv('m1'), pg_temp.pl('04')), 'rivals:invalid_stats');
select pg_temp.expect_err('stats: goals above 30 refused',
  format($q$select public.set_match_player_stats(%L, jsonb_build_array(jsonb_build_object('player_id', %L, 'goals', 31, 'assists', 0)))$q$,
         pg_temp.kv('m1'), pg_temp.pl('01')), 'rivals:invalid_stats');
select pg_temp.expect_err('stats: negative assists refused',
  format($q$select public.set_match_player_stats(%L, jsonb_build_array(jsonb_build_object('player_id', %L, 'goals', 0, 'assists', -1)))$q$,
         pg_temp.kv('m1'), pg_temp.pl('01')), 'rivals:invalid_stats');
select pg_temp.expect_err('stats: duplicate player refused',
  format($q$select public.set_match_player_stats(%L, jsonb_build_array(jsonb_build_object('player_id', %L), jsonb_build_object('player_id', %L)))$q$,
         pg_temp.kv('m1'), pg_temp.pl('01'), pg_temp.pl('01')), 'rivals:invalid_stats');
select pg_temp.expect_err('stats: not an array refused',
  format($q$select public.set_match_player_stats(%L, '{"a":1}'::jsonb)$q$, pg_temp.kv('m1')), 'rivals:invalid_stats');
do $$
declare r jsonb;
begin
  r := public.set_match_player_stats(pg_temp.kv('m1')::uuid, jsonb_build_array(
         jsonb_build_object('player_id', pg_temp.pl('01'), 'goals', 2, 'assists', 1),
         jsonb_build_object('player_id', pg_temp.pl('02'), 'goals', 1, 'assists', 1)));
  perform pg_temp.ok('stats: the captain records goals/assists for lineup players', (r->>'count')::int = 2 and r->>'team_id' = pg_temp.kv('A'), r::text);
end $$;
select pg_temp.as_user('03');
do $$
declare s jsonb;
begin
  s := public.get_match_player_stats(pg_temp.kv('m1')::uuid);
  perform pg_temp.ok('stats: members of the OTHER team can read them (Ana 2g 1a first)',
    jsonb_array_length(s->'items') = 2 and s->'items'->0->>'nick' = 'Ana' and (s->'items'->0->>'goals')::int = 2, s::text);
end $$;
select pg_temp.as_user('06');
select pg_temp.expect_err('stats: an outsider cannot read them', format('select public.get_match_player_stats(%L)', pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.ok('stats: an outsider sees no stats rows', (select count(*) from public.team_match_player_stats) = 0);
-- Informational until confirmed: nothing feeds the metrics yet.
select pg_temp.as_user('01');
select pg_temp.ok('metrics: unconfirmed stats/lineup count nothing (no appearances, no goals)',
  (select (i->>'appearances')::int = 0 and (i->>'goals')::int = 0
     from jsonb_array_elements(public.team_player_stats(pg_temp.kv('A')::uuid)->'items') i where (i->>'player_id')::uuid = pg_temp.pl('01')));
select pg_temp.ok('metrics: a team with no confirmed match has an empty record',
  (public.team_record(pg_temp.kv('A')::uuid)->>'played')::int = 0
  and public.team_record(pg_temp.kv('A')::uuid)->'form' = '[]'::jsonb
  and public.team_record(pg_temp.kv('A')::uuid)->'streak' = '{"type":null,"n":0}'::jsonb);
reset role;

-- ── 7. Report → confirm by the OTHER team ─────────────────
set local role authenticated;
select pg_temp.as_user('07');
select pg_temp.expect_err('report: a plain member cannot', format('select public.report_match_result(%L, 3, 2)', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('06');
select pg_temp.expect_err('report: an outsider cannot', format('select public.report_match_result(%L, 3, 2)', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('01');
select pg_temp.expect_err('report: negative score refused', format('select public.report_match_result(%L, -1, 2)', pg_temp.kv('m1')), 'rivals:invalid_score');
select pg_temp.expect_err('report: score above 99 refused', format('select public.report_match_result(%L, 100, 2)', pg_temp.kv('m1')), 'rivals:invalid_score');
select pg_temp.expect_err('report: note above 280 chars refused',
  format('select public.report_match_result(%L, 3, 2, repeat(''x'', 281))', pg_temp.kv('m1')), 'rivals:note_too_long');
do $$
declare r jsonb;
begin
  r := public.report_match_result(pg_temp.kv('m1')::uuid, 3, 2, 'Jogo bom');
  perform pg_temp.ok('report: revision 1, kind report, proposed by A',
    (r->>'revision')::int = 1 and r->>'kind' = 'report' and r->>'status' = 'proposed' and (r->>'home_score')::int = 3
    and (r->>'away_score')::int = 2 and r->>'reported_by_team_id' = pg_temp.kv('A') and r->>'note' = 'Jogo bom', r::text);
  perform pg_temp.ok('report: provisional — result_status reported, official score still empty',
    (select result_status = 'reported' and official_home_score is null and official_away_score is null and confirmed_revision is null
       from public.team_matches where id = pg_temp.kv('m1')::uuid));
end $$;
select pg_temp.expect_err('report: a second report is refused (result_exists)',
  format('select public.report_match_result(%L, 3, 2)', pg_temp.kv('m1')), 'rivals:result_exists');
select pg_temp.ok('metrics: a provisional result is NOT counted',
  (public.team_record(pg_temp.kv('A')::uuid)->>'played')::int = 0 and (public.team_record(pg_temp.kv('B')::uuid)->>'played')::int = 0);
-- Provisional + stale/own checks.
select pg_temp.expect_err('the reporter cannot confirm its own result', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.expect_err('the reporter cannot contest its own result', format('select public.contest_match_result(%L, 1, 0, 0)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.as_user('02');
select pg_temp.expect_err('the reporting team''s vice cannot confirm either', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.as_user('04');
select pg_temp.expect_err('a plain member of the other team cannot confirm', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('06');
select pg_temp.expect_err('an outsider cannot confirm', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.expect_err('an outsider cannot read the revisions', format('select public.get_match_results(%L)', pg_temp.kv('m1')), 'rivals:not_team_member');
select pg_temp.ok('an outsider sees no result rows', (select count(*) from public.team_match_results) = 0);
select pg_temp.as_user('03');
select pg_temp.expect_err('confirming a wrong revision number → stale_revision', format('select public.confirm_match_result(%L, 2)', pg_temp.kv('m1')), 'rivals:stale_revision');
select pg_temp.expect_err('confirm on a match without a proposal → no_open_proposal', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m7')), 'rivals:no_open_proposal');
do $$
declare r jsonb; r2 jsonb;
begin
  r := public.confirm_match_result(pg_temp.kv('m1')::uuid, 1);
  perform pg_temp.ok('confirm: the OTHER team confirms revision 1', r->>'status' = 'confirmed' and (r->>'revision')::int = 1, r::text);
  perform pg_temp.ok('confirm: official score written, match played, revision + timestamp stored',
    (select official_home_score = 3 and official_away_score = 2 and result_status = 'confirmed' and match_status = 'played'
            and confirmed_revision = 1 and result_confirmed_at is not null from public.team_matches where id = pg_temp.kv('m1')::uuid));
  r2 := public.confirm_match_result(pg_temp.kv('m1')::uuid, 1);
  perform pg_temp.ok('confirm: repeating it is idempotent (already_confirmed)', (r2->>'already_confirmed')::boolean and r2->>'status' = 'confirmed', r2::text);
end $$;
select pg_temp.as_user('01');
select pg_temp.expect_err('the proposer cannot confirm after the fact either', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.expect_err('report: a confirmed match refuses a new report', format('select public.report_match_result(%L, 1, 1)', pg_temp.kv('m1')), 'rivals:result_exists');

-- Metrics now count m1 (3-2, A home).
do $$
declare a jsonb; b jsonb; h jsonb; hb jsonb;
begin
  a := public.team_record(pg_temp.kv('A')::uuid);
  b := public.team_record(pg_temp.kv('B')::uuid);
  perform pg_temp.ok('team_record(A): 1 played, 1 W, gf 3 ga 2 gd 1, form [W], streak W×1, biggest win 3-2 vs Dragões',
    (a->>'played')::int = 1 and (a->>'wins')::int = 1 and (a->>'draws')::int = 0 and (a->>'losses')::int = 0
    and (a->>'gf')::int = 3 and (a->>'ga')::int = 2 and (a->>'gd')::int = 1 and a->'form' = '["W"]'::jsonb
    and a->'streak' = '{"type":"W","n":1}'::jsonb and a->'biggest_win'->>'opponent' = 'Dragões Teste' and a->'biggest_win'->>'score' = '3-2'
    and (a->>'clean_sheets')::int = 0, a::text);
  perform pg_temp.ok('team_record(B): 1 played, 1 L, gf 2 ga 3, form [L], streak L×1, no biggest win',
    (b->>'played')::int = 1 and (b->>'losses')::int = 1 and (b->>'gf')::int = 2 and (b->>'ga')::int = 3 and b->'form' = '["L"]'::jsonb
    and b->'streak' = '{"type":"L","n":1}'::jsonb and b->'biggest_win' = 'null'::jsonb, b::text);
  h := public.team_head_to_head(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid);
  hb := public.team_head_to_head(pg_temp.kv('B')::uuid, pg_temp.kv('A')::uuid);
  perform pg_temp.ok('h2h(A,B): 1 meeting, 1 W, last 3-2, confronto_n 2',
    (h->>'played')::int = 1 and (h->>'wins')::int = 1 and (h->>'gf')::int = 3 and (h->>'ga')::int = 2
    and h->'last'->>'score' = '3-2' and h->'last'->>'result' = 'W' and (h->>'confronto_n')::int = 2, h::text);
  perform pg_temp.ok('h2h(B,A): same meeting from B''s side (L, 2-3)',
    (hb->>'losses')::int = 1 and hb->'last'->>'score' = '2-3' and (hb->>'confronto_n')::int = 2, hb::text);
  perform pg_temp.ok('h2h(A,C): no meetings yet, last null, confronto_n 1',
    (public.team_head_to_head(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid)->>'confronto_n')::int = 1
    and public.team_head_to_head(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid)->'last' = 'null'::jsonb);
end $$;
-- Player stats: appearances (lineup) + goals/assists, only because m1 is confirmed now.
do $$
declare s jsonb;
begin
  s := public.team_player_stats(pg_temp.kv('A')::uuid);
  perform pg_temp.ok('team_player_stats(A): Ana 1 app 2g 1a, Vasco 1 app 1g 1a, Dani 1 app, Gil 0 app',
    exists (select 1 from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('01')
              and (i->>'appearances')::int = 1 and (i->>'goals')::int = 2 and (i->>'assists')::int = 1)
    and exists (select 1 from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('02')
              and (i->>'appearances')::int = 1 and (i->>'goals')::int = 1 and (i->>'assists')::int = 1)
    and exists (select 1 from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('07')
              and (i->>'appearances')::int = 1 and (i->>'goals')::int = 0)
    and exists (select 1 from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('09')
              and (i->>'appearances')::int = 0), s::text);
  perform pg_temp.ok('team_player_stats: own roster only has names + member_since + attrs',
    (s->'items'->0) ?& array['player_id','nick','name','photo_url','position','attrs','appearances','goals','assists','member_since']
    and jsonb_array_length(s->'items') = 4);
end $$;
select pg_temp.expect_err('team_player_stats(B) by an A member refused (opponent only via scout_opponent)',
  format('select public.team_player_stats(%L)', pg_temp.kv('B')), 'rivals:not_team_member');
-- Lineup is editable on a played match, and a CONFIRMED match counts appearances.
select public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('02'), pg_temp.pl('07'), pg_temp.pl('09')]);
select pg_temp.ok('lineup: still editable once played; Gil now has 1 appearance',
  (select (i->>'appearances')::int from jsonb_array_elements(public.team_player_stats(pg_temp.kv('A')::uuid)->'items') i where (i->>'player_id')::uuid = pg_temp.pl('09')) = 1);
select public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('02'), pg_temp.pl('07')]);
select pg_temp.ok('lineup: dropping a player with stats (Vasco) removes only his stats row',
  (public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('07')])->>'stats_removed')::int = 1);
select pg_temp.ok('lineup: ... and exactly one stats row (Ana) is left',
  (select count(*) from public.team_match_player_stats where match_id = pg_temp.kv('m1')::uuid) = 1);
select public.set_match_lineup(pg_temp.kv('m1')::uuid, array[pg_temp.pl('01'), pg_temp.pl('02'), pg_temp.pl('07')]);
select public.set_match_player_stats(pg_temp.kv('m1')::uuid, jsonb_build_array(
         jsonb_build_object('player_id', pg_temp.pl('01'), 'goals', 2, 'assists', 1),
         jsonb_build_object('player_id', pg_temp.pl('02'), 'goals', 1, 'assists', 1)));
-- Played match: both lineups visible; the opponent shows first names only.
select pg_temp.as_user('03');
do $$
declare l jsonb;
begin
  l := public.get_match_lineup(pg_temp.kv('m1')::uuid);
  perform pg_temp.ok('lineup: once played both teams'' lineups are visible (3 + 2)', jsonb_array_length(l->'items') = 5, l::text);
  perform pg_temp.ok('lineup: opponent players come with first name only (Ana, not Ana Teste); own players keep the full name',
    exists (select 1 from jsonb_array_elements(l->'items') i where i->>'nick' = 'Ana' and i->>'name' = 'Ana')
    and exists (select 1 from jsonb_array_elements(l->'items') i where i->>'nick' = 'Bruno' and i->>'name' = 'Bruno Teste'), l::text);
end $$;
-- Public / signed-in team card.
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare p jsonb;
begin
  p := public.team_profile(pg_temp.kv('slugA'));
  perform pg_temp.ok('team_profile (anon): real record + form from CONFIRMED results',
    (p->'record'->>'played')::int = 1 and (p->'record'->>'wins')::int = 1 and (p->'record'->>'goals_for')::int = 3
    and (p->'record'->>'goals_against')::int = 2 and p->'form' = '["W"]'::jsonb, p::text);
  perform pg_temp.ok('team_profile (anon): no roster, no top scorers, no member list',
    not (p ? 'top_scorers') and not (p ? 'top_assisters') and not (p ? 'members') and not (p ? 'roster'), p::text);
end $$;
reset role;
set local role authenticated;
select pg_temp.as_user('06');  -- an outsider, just signed in
do $$
declare p jsonb;
begin
  p := public.team_profile(pg_temp.kv('slugA'));
  perform pg_temp.ok('team_profile (signed in): top 3 scorers/assisters from confirmed matches, still no roster',
    p->'top_scorers' = '[{"n":2,"nick":"Ana"},{"n":1,"nick":"Vasco"}]'::jsonb
    and p->'top_assisters' = '[{"n":1,"nick":"Ana"},{"n":1,"nick":"Vasco"}]'::jsonb
    and not (p ? 'members') and not (p ? 'roster'), p::text);
  perform pg_temp.ok('team_profile: unknown slug → null', public.team_profile('nao-existe') is null);
  perform pg_temp.ok('team_record: any signed-in user (outsider) can read the public card', (public.team_record(pg_temp.kv('A')::uuid)->>'played')::int = 1);
end $$;
select pg_temp.as_user('01');
do $$
declare c jsonb; li jsonb;
begin
  c := public.my_team_career();
  perform pg_temp.ok('my_team_career: Ana @ A = 1 app, 2 goals, 1 assist, 1 win',
    exists (select 1 from jsonb_array_elements(c->'items') i where i->>'team_id' = pg_temp.kv('A') and (i->>'appearances')::int = 1
              and (i->>'goals')::int = 2 and (i->>'assists')::int = 1 and (i->>'wins')::int = 1 and (i->>'draws')::int = 0 and (i->>'losses')::int = 0), c::text);
  li := public.list_teams('PT');
  perform pg_temp.ok('list_teams: real record + form instead of the placeholders',
    exists (select 1 from jsonb_array_elements(li->'items') i where i->>'slug' = pg_temp.kv('slugA') and (i->'record'->>'wins')::int = 1 and i->'form' = '["W"]'::jsonb), li::text);
end $$;
reset role;

-- ── 8. Scouting the opponent (while the challenge is agreed) ─
set local role authenticated;
select pg_temp.as_user('01');
do $$
declare s jsonb;
begin
  s := public.scout_opponent(pg_temp.kv('m7')::uuid);
  perform pg_temp.ok('scout_opponent: card + record + h2h + roster of the OTHER team (B)',
    s->'team'->>'name' = 'Dragões Teste' and (s->'record'->>'played')::int = 1 and (s->'h2h'->>'played')::int = 1
    and jsonb_array_length(s->'items') = 3, s::text);
  perform pg_temp.ok('scout_opponent: items carry nick/photo/position/attrs/appearances/goals/assists and NOTHING identifying',
    (s->'items'->0) ?& array['player_id','nick','photo_url','position','attrs','appearances','goals','assists']
    and not exists (select 1 from jsonb_array_elements(s->'items') i where i ? 'name' or i ? 'phone' or i ? 'email' or i ? 'member_since'),
    (s->'items')::text);
  perform pg_temp.ok('scout_opponent: no full name / email anywhere in the payload',
    position('Bruno Teste' in s::text) = 0 and position('Carla Teste' in s::text) = 0 and position('example.test' in s::text) = 0
    and position('"phone"' in s::text) = 0, null);
  perform pg_temp.ok('scout_opponent: Bruno shows his appearance from the confirmed match',
    exists (select 1 from jsonb_array_elements(s->'items') i where i->>'nick' = 'Bruno' and (i->>'appearances')::int = 1));
end $$;
select pg_temp.as_user('03');
select pg_temp.ok('scout_opponent: the other side sees A', public.scout_opponent(pg_temp.kv('m7')::uuid)->'team'->>'name' = 'Leões Teste');
select pg_temp.as_user('06');
select pg_temp.expect_err('scout_opponent: an outsider is refused', format('select public.scout_opponent(%L)', pg_temp.kv('m7')), 'rivals:not_team_member');
select pg_temp.as_user('05');
select pg_temp.expect_err('scout_opponent: a third team is refused', format('select public.scout_opponent(%L)', pg_temp.kv('m7')), 'rivals:not_team_member');
reset role;

-- ── 9. Correction keeps the official score until confirmed ─
set local role authenticated;
select pg_temp.as_user('07');
select pg_temp.expect_err('correction: a plain member cannot', format('select public.propose_result_correction(%L, 3, 3)', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('01');
select pg_temp.expect_err('correction: the same score as the official one refused', format('select public.propose_result_correction(%L, 3, 2)', pg_temp.kv('m1')), 'rivals:same_score');
select pg_temp.expect_err('correction: on a match without a confirmed result refused', format('select public.propose_result_correction(%L, 1, 0)', pg_temp.kv('m2')), 'rivals:result_not_confirmed');
do $$
declare r jsonb;
begin
  r := public.propose_result_correction(pg_temp.kv('m1')::uuid, 3, 3, 'Foi 3-3');
  perform pg_temp.ok('correction: revision 2, kind correction, proposed',
    (r->>'revision')::int = 2 and r->>'kind' = 'correction' and r->>'status' = 'proposed', r::text);
  perform pg_temp.ok('correction: the OFFICIAL score is unchanged (3-2) and the match stays confirmed',
    (select official_home_score = 3 and official_away_score = 2 and result_status = 'confirmed' and confirmed_revision = 1
       from public.team_matches where id = pg_temp.kv('m1')::uuid));
  perform pg_temp.ok('correction: metrics still use 3-2 (W) while it is pending',
    (public.team_record(pg_temp.kv('A')::uuid)->>'wins')::int = 1 and (public.team_record(pg_temp.kv('A')::uuid)->>'gf')::int = 3);
  perform pg_temp.ok('my_challenges: result.open_revision shows the pending correction',
    pg_temp.mymatch('m1')->'result'->'open_revision'->>'kind' = 'correction' and (pg_temp.mymatch('m1')->'result'->>'revisions_count')::int = 2);
end $$;
select pg_temp.expect_err('correction: a second open proposal refused', format('select public.propose_result_correction(%L, 4, 4)', pg_temp.kv('m1')), 'rivals:proposal_open');
select pg_temp.expect_err('correction: the proposer cannot confirm it', format('select public.confirm_match_result(%L, 2)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.as_user('03');
select pg_temp.expect_err('withdraw: only the proposing team can', format('select public.withdraw_result_proposal(%L, 2)', pg_temp.kv('m1')), 'rivals:not_proposer');
select pg_temp.as_user('02');  -- the vice of A may withdraw A's proposal
do $$
declare r jsonb; r2 jsonb;
begin
  r := public.withdraw_result_proposal(pg_temp.kv('m1')::uuid, 2);
  perform pg_temp.ok('withdraw (correction): withdrawn, official score and confirmed status untouched',
    r->>'status' = 'withdrawn' and (select official_home_score = 3 and official_away_score = 2 and result_status = 'confirmed'
                                      from public.team_matches where id = pg_temp.kv('m1')::uuid), r::text);
  r2 := public.withdraw_result_proposal(pg_temp.kv('m1')::uuid, 2);
  perform pg_temp.ok('withdraw: repeating it is a no-op', (r2->>'already_withdrawn')::boolean, r2::text);
end $$;
select pg_temp.as_user('01');
select public.propose_result_correction(pg_temp.kv('m1')::uuid, 3, 3, 'Foi mesmo 3-3');   -- revision 3
select pg_temp.as_user('03');
select pg_temp.expect_err('contest: stale revision refused (2 was withdrawn)', format('select public.contest_match_result(%L, 2, 4, 2)', pg_temp.kv('m1')), 'rivals:stale_revision');
select pg_temp.expect_err('contest a correction with its own score refused', format('select public.contest_match_result(%L, 3, 3, 3)', pg_temp.kv('m1')), 'rivals:same_score');
do $$
declare r jsonb;
begin
  r := public.contest_match_result(pg_temp.kv('m1')::uuid, 3, 4, 2, 'Foi 4-2');
  perform pg_temp.ok('contest a correction: counter revision 4 by B; official score still 3-2 and still counted',
    (r->>'revision')::int = 4 and r->>'kind' = 'counter' and r->>'status' = 'proposed' and r->>'reported_by_team_id' = pg_temp.kv('B')
    and (select official_home_score = 3 and result_status = 'confirmed' from public.team_matches where id = pg_temp.kv('m1')::uuid)
    and (public.team_record(pg_temp.kv('A')::uuid)->>'played')::int = 1, r::text);
  perform pg_temp.ok('contest: the contested revision is now disputed',
    (select status from public.team_match_results where match_id = pg_temp.kv('m1')::uuid and revision = 3) = 'disputed');
end $$;
select pg_temp.expect_err('contest: B cannot answer its own counter', format('select public.confirm_match_result(%L, 4)', pg_temp.kv('m1')), 'rivals:own_proposal');
select pg_temp.as_user('01');
do $$
declare r jsonb;
begin
  r := public.confirm_match_result(pg_temp.kv('m1')::uuid, 4);
  perform pg_temp.ok('confirm the counter: official score becomes 4-2, revision 4, previous confirmed → superseded',
    (select official_home_score = 4 and official_away_score = 2 and confirmed_revision = 4 and result_status = 'confirmed'
       from public.team_matches where id = pg_temp.kv('m1')::uuid)
    and (select status from public.team_match_results where match_id = pg_temp.kv('m1')::uuid and revision = 1) = 'superseded', r::text);
  perform pg_temp.ok('revision log of m1: superseded, withdrawn, disputed, confirmed',
    (select jsonb_agg(i->>'status' order by (i->>'revision')::int) from jsonb_array_elements(public.get_match_results(pg_temp.kv('m1')::uuid)->'items') i)
      = '["superseded","withdrawn","disputed","confirmed"]'::jsonb
    and (public.get_match_results(pg_temp.kv('m1')::uuid)->'official'->>'home_score')::int = 4);
  perform pg_temp.ok('metrics follow the confirmed correction (gf 4, ga 2), still ONE match played',
    (public.team_record(pg_temp.kv('A')::uuid)->>'gf')::int = 4 and (public.team_record(pg_temp.kv('A')::uuid)->>'played')::int = 1);
end $$;
reset role;

-- ── 10. Contest chain: 4th revision → needs_help ──────────
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.ok('report m2 2-1 (rev 1)', (public.report_match_result(pg_temp.kv('m2')::uuid, 2, 1)->>'revision')::int = 1);
select pg_temp.expect_err('not played: refused once a result was reported', format('select public.mark_match_not_played(%L)', pg_temp.kv('m2')), 'rivals:not_played_blocked');
select pg_temp.as_user('03');
select pg_temp.expect_err('contest with the same score → same_score', format('select public.contest_match_result(%L, 1, 2, 1)', pg_temp.kv('m2')), 'rivals:same_score');
select pg_temp.expect_err('contest: invalid score refused', format('select public.contest_match_result(%L, 1, 200, 1)', pg_temp.kv('m2')), 'rivals:invalid_score');
do $$
declare r jsonb; m jsonb;
begin
  r := public.contest_match_result(pg_temp.kv('m2')::uuid, 1, 1, 1, 'Foi empate');
  perform pg_temp.ok('contest: rev 2 counter by B; rev 1 disputed; result_status disputed; no official score',
    (r->>'revision')::int = 2 and r->>'kind' = 'counter'
    and (select status from public.team_match_results where match_id = pg_temp.kv('m2')::uuid and revision = 1) = 'disputed'
    and (select result_status = 'disputed' and official_home_score is null from public.team_matches where id = pg_temp.kv('m2')::uuid), r::text);
  perform pg_temp.ok('metrics: a disputed result is NOT counted (B still has 1 played)', (public.team_record(pg_temp.kv('B')::uuid)->>'played')::int = 1);
  m := pg_temp.mymatch('m2');
  perform pg_temp.ok('my_challenges: disputed state + open revision 2 (B)',
    m->'result'->>'status' = 'disputed' and (m->'result'->'open_revision'->>'revision')::int = 2 and (m->'result'->>'revisions_count')::int = 2, m::text);
end $$;
select pg_temp.expect_err('the contester cannot confirm its own counter', format('select public.confirm_match_result(%L, 2)', pg_temp.kv('m2')), 'rivals:own_proposal');
select pg_temp.expect_err('the contester cannot contest its own counter', format('select public.contest_match_result(%L, 2, 0, 0)', pg_temp.kv('m2')), 'rivals:own_proposal');
select pg_temp.as_user('01');
select pg_temp.expect_err('the old revision cannot be confirmed any more → stale_revision', format('select public.confirm_match_result(%L, 1)', pg_temp.kv('m2')), 'rivals:stale_revision');
select pg_temp.ok('the turn flipped: A contests revision 2 with 2-2 → rev 3',
  (public.contest_match_result(pg_temp.kv('m2')::uuid, 2, 2, 2)->>'revision')::int = 3);
select pg_temp.as_user('03');
select pg_temp.expect_err('B cannot withdraw A''s rev 3', format('select public.withdraw_result_proposal(%L, 3)', pg_temp.kv('m2')), 'rivals:not_proposer');
select pg_temp.expect_err('4th revision of the chain → needs_help', format('select public.contest_match_result(%L, 3, 3, 3)', pg_temp.kv('m2')), 'rivals:needs_help');
select pg_temp.ok('needs_help leaves the dispute untouched (rev 3 still open)',
  (select revision from public.team_match_results where match_id = pg_temp.kv('m2')::uuid and status = 'proposed') = 3);
select pg_temp.as_user('01');
do $$
declare r jsonb;
begin
  r := public.withdraw_result_proposal(pg_temp.kv('m2')::uuid, 3);
  perform pg_temp.ok('withdraw a counter: rev 3 withdrawn, rev 2 re-opened, result_status back to reported',
    r->>'status' = 'withdrawn'
    and (select status from public.team_match_results where match_id = pg_temp.kv('m2')::uuid and revision = 2) = 'proposed'
    and (select result_status = 'reported' and official_home_score is null from public.team_matches where id = pg_temp.kv('m2')::uuid), r::text);
  r := public.confirm_match_result(pg_temp.kv('m2')::uuid, 2);
  perform pg_temp.ok('A confirms B''s 1-1 (rev 2): m2 played 1-1, rev 1 stays disputed',
    r->>'status' = 'confirmed' and (select official_home_score = 1 and official_away_score = 1 and result_status = 'confirmed' and match_status = 'played'
                                      from public.team_matches where id = pg_temp.kv('m2')::uuid)
    and (select status from public.team_match_results where match_id = pg_temp.kv('m2')::uuid and revision = 1) = 'disputed', r::text);
end $$;
-- Lineup on a played match + more metrics.
select public.set_match_lineup(pg_temp.kv('m2')::uuid, array[pg_temp.pl('01'), pg_temp.pl('09')]);
do $$
declare a jsonb; b jsonb; h jsonb; s jsonb;
begin
  a := public.team_record(pg_temp.kv('A')::uuid);
  b := public.team_record(pg_temp.kv('B')::uuid);
  perform pg_temp.ok('team_record(A) after m1 (4-2 W) and m2 (1-1 D): 2 played, form [D,W] newest first, streak D×1, gf 5 ga 3, biggest win 4-2',
    (a->>'played')::int = 2 and (a->>'wins')::int = 1 and (a->>'draws')::int = 1 and a->'form' = '["D","W"]'::jsonb
    and a->'streak' = '{"type":"D","n":1}'::jsonb and (a->>'gf')::int = 5 and (a->>'ga')::int = 3 and a->'biggest_win'->>'score' = '4-2', a::text);
  perform pg_temp.ok('team_record(B): form [D,L], streak D×1',
    b->'form' = '["D","L"]'::jsonb and b->'streak' = '{"type":"D","n":1}'::jsonb and (b->>'draws')::int = 1 and (b->>'losses')::int = 1, b::text);
  h := public.team_head_to_head(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid);
  perform pg_temp.ok('h2h(A,B): 2 meetings (1W 1D), last = the 1-1, confronto_n 3',
    (h->>'played')::int = 2 and (h->>'wins')::int = 1 and (h->>'draws')::int = 1 and h->'last'->>'score' = '1-1' and (h->>'confronto_n')::int = 3, h::text);
  s := public.team_player_stats(pg_temp.kv('A')::uuid);
  perform pg_temp.ok('appearances count confirmed matches only: Ana 2 (m1+m2), Gil 1 (m2), Dani 1 (m1)',
    (select (i->>'appearances')::int from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('01')) = 2
    and (select (i->>'appearances')::int from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('09')) = 1
    and (select (i->>'appearances')::int from jsonb_array_elements(s->'items') i where (i->>'player_id')::uuid = pg_temp.pl('07')) = 1, s::text);
end $$;
-- A scheduled (future) match's lineup never counts.
select public.set_match_lineup(pg_temp.kv('m7')::uuid, array[pg_temp.pl('01'), pg_temp.pl('07'), pg_temp.pl('09')]);
select pg_temp.ok('appearances: a lineup on a scheduled (future) match does NOT count',
  (select (i->>'appearances')::int from jsonb_array_elements(public.team_player_stats(pg_temp.kv('A')::uuid)->'items') i where (i->>'player_id')::uuid = pg_temp.pl('07')) = 1);
reset role;

-- ── 11. Withdraw the first report; stats; not played is not a loss ──
set local role authenticated;
select pg_temp.as_user('01');
select public.set_match_lineup(pg_temp.kv('m3')::uuid, array[pg_temp.pl('01'), pg_temp.pl('09')]);
select public.set_match_player_stats(pg_temp.kv('m3')::uuid, jsonb_build_array(jsonb_build_object('player_id', pg_temp.pl('09'), 'goals', 7, 'assists', 0)));
select pg_temp.ok('m3: A reports 1-0 (rev 1)', (public.report_match_result(pg_temp.kv('m3')::uuid, 1, 0)->>'revision')::int = 1);
select pg_temp.as_user('05');
select pg_temp.expect_err('withdraw: C cannot withdraw A''s report', format('select public.withdraw_result_proposal(%L, 1)', pg_temp.kv('m3')), 'rivals:not_proposer');
select pg_temp.as_user('01');
do $$
declare r jsonb;
begin
  r := public.withdraw_result_proposal(pg_temp.kv('m3')::uuid, 1);
  perform pg_temp.ok('withdraw the first report: result_status back to none, no official score',
    r->>'status' = 'withdrawn' and (select result_status = 'none' and official_home_score is null from public.team_matches where id = pg_temp.kv('m3')::uuid), r::text);
end $$;
select pg_temp.as_user('05');
select pg_temp.ok('after a withdrawn report the OTHER team can report: revision numbering continues (rev 2)',
  (public.report_match_result(pg_temp.kv('m3')::uuid, 0, 2)->>'revision')::int = 2);
select pg_temp.ok('... and it is C''s report',
  (select reported_by_team_id from public.team_match_results where match_id = pg_temp.kv('m3')::uuid and revision = 2) = pg_temp.kv('C')::uuid);
select public.withdraw_result_proposal(pg_temp.kv('m3')::uuid, 2);
select pg_temp.as_user('06');
select pg_temp.expect_err('not played: an outsider cannot', format('select public.mark_match_not_played(%L)', pg_temp.kv('m3')), 'rivals:not_team_leader');
select pg_temp.as_user('05');
do $$
declare r jsonb;
begin
  r := public.mark_match_not_played(pg_temp.kv('m3')::uuid, 'Chuva');
  perform pg_temp.ok('mark_match_not_played: match not_played with reason, result still none (never a loss)',
    r->>'match_status' = 'not_played'
    and (select match_status = 'not_played' and not_played_reason = 'Chuva' and not_played_at is not null and result_status = 'none'
            and official_home_score is null from public.team_matches where id = pg_temp.kv('m3')::uuid), r::text);
  perform pg_temp.ok('not played is idempotent', public.mark_match_not_played(pg_temp.kv('m3')::uuid)->>'match_status' = 'not_played');
end $$;
select pg_temp.expect_err('report on a not_played match refused', format('select public.report_match_result(%L, 1, 0)', pg_temp.kv('m3')), 'rivals:match_not_scheduled');
select pg_temp.expect_err('not played with a 281-char reason refused', format('select public.mark_match_not_played(%L, repeat(''x'', 281))', pg_temp.kv('m3')), 'rivals:note_too_long');
select pg_temp.as_user('01');
do $$
declare a jsonb; c jsonb;
begin
  a := public.team_record(pg_temp.kv('A')::uuid);
  c := public.team_record(pg_temp.kv('C')::uuid);
  perform pg_temp.ok('metrics: not_played counted separately, never W/D/L (A: still 2 played, 0 losses; not_played 1)',
    (a->>'not_played')::int = 1 and (a->>'played')::int = 2 and (a->>'losses')::int = 0, a::text);
  perform pg_temp.ok('metrics: C has no results, 1 not_played, 0 losses', (c->>'played')::int = 0 and (c->>'losses')::int = 0 and (c->>'not_played')::int = 1, c::text);
  perform pg_temp.ok('metrics: goals recorded on a not-played match never count (Gil still 0 goals)',
    (select (i->>'goals')::int from jsonb_array_elements(public.team_player_stats(pg_temp.kv('A')::uuid)->'items') i where (i->>'player_id')::uuid = pg_temp.pl('09')) = 0);
end $$;
reset role;

-- ── 12. Cancelled matches: counted apart, never a loss ────
set local role authenticated;
select pg_temp.as_user('03');
select public.cancel_challenge((select challenge_id from public.team_matches where id = pg_temp.kv('m4')::uuid), 'Sem jogadores');
select public.cancel_challenge((select challenge_id from public.team_matches where id = pg_temp.kv('m5')::uuid), 'Lesões');
do $$
declare a jsonb; b jsonb;
begin
  a := public.team_record(pg_temp.kv('A')::uuid);
  b := public.team_record(pg_temp.kv('B')::uuid);
  perform pg_temp.ok('metrics: B cancelled 2 matches (1 late, <24h) — they are NOT losses',
    (b->>'cancellations')::int = 2 and (b->>'late_cancellations')::int = 1 and (b->>'losses')::int = 1 and (b->>'played')::int = 2, b::text);
  perform pg_temp.ok('metrics: A (not the canceller) has 0 cancellations', (a->>'cancellations')::int = 0 and (a->>'late_cancellations')::int = 0, a::text);
end $$;
select pg_temp.expect_err('rsvp on a cancelled match refused', format($q$select public.set_match_availability(%L, 'yes')$q$, pg_temp.kv('m4')), 'rivals:match_not_scheduled');
select pg_temp.expect_err('scout on a cancelled match refused', format('select public.scout_opponent(%L)', pg_temp.kv('m4')), 'rivals:scout_unavailable');
reset role;
select pg_temp.past('m4', 2);
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('report on a cancelled match refused', format('select public.report_match_result(%L, 1, 0)', pg_temp.kv('m4')), 'rivals:match_not_scheduled');
select pg_temp.expect_err('lineup on a cancelled match refused', format('select public.set_match_lineup(%L, array[%L]::uuid[])', pg_temp.kv('m4'), pg_temp.pl('01')), 'rivals:match_not_scheduled');
reset role;

-- ── 13. Rematch ───────────────────────────────────────────
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('rematch: kickoff_at is required', format($q$select public.create_rematch(%L, '{"venue_name":"Outro"}')$q$, pg_temp.kv('m1')), 'rivals:invalid_kickoff');
select pg_temp.expect_err('rematch: a match that was never played/confirmed is not eligible (m7)',
  format('select public.create_rematch(%L, pg_temp.terms(96))', pg_temp.kv('m7')), 'rivals:not_eligible_rematch');
select pg_temp.expect_err('rematch: a cancelled match is not eligible (m4)',
  format('select public.create_rematch(%L, pg_temp.terms(96))', pg_temp.kv('m4')), 'rivals:not_eligible_rematch');
select pg_temp.expect_err('rematch: a not_played match is not eligible (m3)',
  format('select public.create_rematch(%L, pg_temp.terms(96))', pg_temp.kv('m3')), 'rivals:not_eligible_rematch');
select pg_temp.as_user('06');
select pg_temp.expect_err('rematch: an outsider cannot', format('select public.create_rematch(%L, pg_temp.terms(96))', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('07');
select pg_temp.expect_err('rematch: a plain member cannot', format('select public.create_rematch(%L, pg_temp.terms(96))', pg_temp.kv('m1')), 'rivals:not_team_leader');
select pg_temp.as_user('01');
select pg_temp.expect_err('rematch: kickoff too soon is validated like create_challenge',
  format('select public.create_rematch(%L, pg_temp.terms(1))', pg_temp.kv('m1')), 'rivals:kickoff_too_soon');
do $$
declare r jsonb; r2 jsonb; c public.team_challenges%rowtype;
begin
  r := public.create_rematch(pg_temp.kv('m1')::uuid, pg_temp.terms(96), 'rematch-ref-0001');
  perform pg_temp.setkv('rm1', r->>'challenge_id');
  select * into c from public.team_challenges where id = (r->>'challenge_id')::uuid;
  perform pg_temp.ok('rematch: directed challenge from A to B linked to m1, pending, turn B, same shape as create_challenge',
    (r->>'created')::boolean and r->>'mode' = 'directed' and r->>'status' = 'pending' and (r->>'version')::int = 1
    and r ?& array['challenge_id','token','status','version','expires_at','mode','created']
    and c.rematch_of_match_id = pg_temp.kv('m1')::uuid and c.challenger_team_id = pg_temp.kv('A')::uuid
    and c.challenged_team_id = pg_temp.kv('B')::uuid and c.turn_team_id = pg_temp.kv('B')::uuid, r::text);
  perform pg_temp.ok('rematch: terms default from the match (venue, format, cost) with a fresh kickoff and no note',
    exists (select 1 from public.team_challenge_versions v where v.challenge_id = c.id and v.version = 1 and v.kind = 'proposal'
             and v.venue_name = 'Campo Teste' and v.format = '7v7' and v.cost_cents = 6000 and v.kickoff_at = now() + interval '96 hours'
             and v.note is null and v.proposed_by_team_id = pg_temp.kv('A')::uuid));
  r2 := public.create_rematch(pg_temp.kv('m1')::uuid, pg_temp.terms(96), 'rematch-ref-0001');
  perform pg_temp.ok('rematch: same client_ref → same challenge, created = false', r2->>'challenge_id' = r->>'challenge_id' and not (r2->>'created')::boolean, r2::text);
  perform pg_temp.ok('my_challenges: rematch_of_match_id exposed',
    exists (select 1 from jsonb_array_elements(public.my_challenges()->'items') i where i->>'id' = r->>'challenge_id' and i->>'rematch_of_match_id' = pg_temp.kv('m1')));
end $$;
select pg_temp.expect_err('rematch: open-pair uniqueness (another rematch while one is pending)',
  format('select public.create_rematch(%L, pg_temp.terms(120))', pg_temp.kv('m2')), 'rivals:pair_open_challenge');
select pg_temp.as_user('03');
select pg_temp.expect_err('rematch: the other side cannot open a second one either (reverse pair)',
  format('select public.create_rematch(%L, pg_temp.terms(120))', pg_temp.kv('m2')), 'rivals:pair_open_challenge');
select public.respond_challenge(pg_temp.kv('rm1')::uuid, 1, 'decline', null, null, 'Agora não');
-- B proposes the rematch of m2 (B was the AWAY team): the relative fields must flip.
do $$
declare r jsonb; v public.team_challenge_versions%rowtype;
begin
  r := public.create_rematch(pg_temp.kv('m2')::uuid, pg_temp.terms(120, '{"cost_split":"loser"}'));
  select * into v from public.team_challenge_versions where challenge_id = (r->>'challenge_id')::uuid and version = 1;
  perform pg_temp.ok('rematch from the away team: B challenges A, kickoff/split from the new terms',
    exists (select 1 from public.team_challenges c where c.id = (r->>'challenge_id')::uuid and c.challenger_team_id = pg_temp.kv('B')::uuid
             and c.challenged_team_id = pg_temp.kv('A')::uuid and c.rematch_of_match_id = pg_temp.kv('m2')::uuid)
    and v.cost_split = 'loser', r::text);
  perform pg_temp.ok('rematch from the away team: field_responsible flipped so it still points at A (challenged now)', v.field_responsible = 'challenged', v.field_responsible);
end $$;
reset role;

-- ── 14. Expiry never touches results ──────────────────────
select pg_temp.setkv('res_before', (select count(*)::text || '/' || string_agg(status, ',' order by match_id, revision) from public.team_match_results));
select pg_temp.setkv('ms_before', (select string_agg(result_status || coalesce(official_home_score::text, '-'), ',' order by id) from public.team_matches));
update public.team_challenges set expires_at = now() - interval '2 days' where id in (select challenge_id from public.team_matches);
-- Run the cron in its own statement, so the reads below see its effects.
select pg_temp.setkv('expired_n2', public.expire_rivals()::text);
select pg_temp.ok('expire_rivals() leaves results and match result_status untouched',
  pg_temp.kv('expired_n2')::int >= 0
  and (select count(*)::text || '/' || string_agg(status, ',' order by match_id, revision) from public.team_match_results) = pg_temp.kv('res_before')
  and (select string_agg(result_status || coalesce(official_home_score::text, '-'), ',' order by id) from public.team_matches) = pg_temp.kv('ms_before'));

-- ── 15. Database invariants (as postgres) ─────────────────
select pg_temp.expect_err('DB: a confirmed match must carry an official score',
  format($q$update public.team_matches set result_status = 'confirmed', official_home_score = null where id = %L$q$, pg_temp.kv('m7')), 'team_matches_confirmed_has_score');
select pg_temp.expect_err('DB: a second CONFIRMED revision per match is impossible (m1 already has one)',
  format($q$insert into public.team_match_results (match_id, revision, kind, home_score, away_score, reported_by_team_id, status) values (%L, 21, 'correction', 1, 1, %L, 'confirmed')$q$, pg_temp.kv('m1'), pg_temp.kv('A')),
  'team_match_results_one_confirmed_key');
insert into public.team_match_results (match_id, revision, kind, home_score, away_score, reported_by_team_id, status)
values (pg_temp.kv('m7')::uuid, 1, 'report', 1, 1, pg_temp.kv('A')::uuid, 'proposed');
select pg_temp.expect_err('DB: a second PROPOSED revision on the same match → unique violation',
  format($q$insert into public.team_match_results (match_id, revision, kind, home_score, away_score, reported_by_team_id, status) values (%L, 2, 'counter', 2, 2, %L, 'proposed')$q$, pg_temp.kv('m7'), pg_temp.kv('B')),
  'team_match_results_one_proposed_key');
select pg_temp.expect_err('DB: duplicate (match, revision) refused',
  format($q$insert into public.team_match_results (match_id, revision, kind, home_score, away_score, reported_by_team_id, status) values (%L, 1, 'counter', 2, 2, %L, 'withdrawn')$q$, pg_temp.kv('m7'), pg_temp.kv('B')),
  'team_match_results_match_revision_key');
select pg_temp.expect_err('DB: scores above 99 refused',
  format($q$insert into public.team_match_results (match_id, revision, kind, home_score, away_score, reported_by_team_id, status) values (%L, 5, 'counter', 100, 0, %L, 'withdrawn')$q$, pg_temp.kv('m7'), pg_temp.kv('B')),
  'violates check constraint');
select pg_temp.expect_err('DB: goals above 30 refused',
  format($q$insert into public.team_match_player_stats (match_id, player_id, team_id, goals) values (%L, %L, %L, 31)$q$, pg_temp.kv('m7'), pg_temp.pl('01'), pg_temp.kv('A')),
  'violates check constraint');

-- ── 16. Audit trail ───────────────────────────────────────
select pg_temp.ok('audit row for ' || a,
  exists (select 1 from public.rivals_audit_log where action = a and match_id in (select id from public.team_matches where home_team_id = pg_temp.kv('A')::uuid)))
from unnest(array['availability_set','lineup_set','stats_set','result_reported','result_confirmed','result_contested',
                  'result_correction_proposed','result_withdrawn','match_not_played','rematch_created']) a;
set local role authenticated;
select pg_temp.as_user('04');  -- a plain member of B reads A-initiated result audit rows of its match
select pg_temp.ok('the other team reads the result audit rows of its match',
  exists (select 1 from public.rivals_audit_log where match_id = pg_temp.kv('m1')::uuid and action = 'result_reported'));
reset role;

-- ── 17. Final state of the main match (what the app sees) ─
set local role authenticated;
select pg_temp.as_user('07');
do $$
declare mm jsonb;
begin
  mm := pg_temp.mymatch('m1');
  perform pg_temp.ok('my_challenges m1: confirmed 4-2, no open revision, 4 revisions, lineup 3, stats recorded, my RSVP kept',
    mm->'result'->>'status' = 'confirmed' and (mm->'result'->>'official_home_score')::int = 4 and (mm->'result'->>'official_away_score')::int = 2
    and mm->'result'->'open_revision' = 'null'::jsonb and (mm->'result'->>'revisions_count')::int = 4
    and (mm->>'lineup_count')::int = 3 and (mm->>'stats_recorded')::boolean and mm->>'my_availability' = 'yes'
    and mm->>'result_status' = 'confirmed', mm::text);
end $$;
reset role;

-- ── Results ───────────────────────────────────────────────
select n, check_name, ok, detail from _rv order by n;

rollback;
