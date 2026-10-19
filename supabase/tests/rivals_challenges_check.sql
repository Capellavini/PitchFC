-- ─────────────────────────────────────────────────────────
-- Manual check for migration 20261013140000_rivals_challenges (PITCH
-- Rivals 2/3). Run in Supabase Dashboard → SQL Editor (paste the whole
-- file, Run) right AFTER the migration is applied. Everything runs inside
-- a transaction that ROLLS BACK. One row per check — every row must be
-- ok = true.
--
-- NOTE: inside one transaction now() is constant, so "expiry" is
-- simulated by moving expires_at into the past as postgres.
--
-- Fixture (fixed uuids; team-only players):
--   Ana    user …f101  player …e201  captain of A "Leões Teste"
--   Vasco  user …f102  player …e202  vice of A
--   Bruno  user …f103  player …e203  captain of B "Dragões Teste"
--   Carla  user …f104  player …e204  plain player of B
--   Paulo  user …f105  player …e205  captain of C "Águias Teste"
--   Zé     user …f106  player …e206  outsider (no team)
--   Rui    user …f107  player …e207  group player (group-RSVP regression)
--   anon   logged-out visitor
-- True concurrency (two sessions) → rivals_challenges_concurrency.sql.
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
grant execute on function pg_temp.ok(text, boolean, text), pg_temp.expect_err(text, text, text),
                          pg_temp.kv(text), pg_temp.setkv(text, text), pg_temp.terms(int, jsonb) to public;

-- ── Fixture (as postgres) ─────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f101', 'rv2-ana@example.test'),
  ('00000000-0000-0000-0000-00000000f102', 'rv2-vasco@example.test'),
  ('00000000-0000-0000-0000-00000000f103', 'rv2-bruno@example.test'),
  ('00000000-0000-0000-0000-00000000f104', 'rv2-carla@example.test'),
  ('00000000-0000-0000-0000-00000000f105', 'rv2-paulo@example.test'),
  ('00000000-0000-0000-0000-00000000f106', 'rv2-ze@example.test'),
  ('00000000-0000-0000-0000-00000000f107', 'rv2-rui@example.test');
insert into public.groups (id, name, recurring) values ('00000000-0000-0000-0000-0000000001e0', 'Rivals2 Test Group', false);
insert into public.players (id, user_id, group_id, name, nick, magic_token) values
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000f101', null, 'Ana Teste',   'Ana',   'rv2test000000000000000000000e201'),
  ('00000000-0000-0000-0000-00000000e202', '00000000-0000-0000-0000-00000000f102', null, 'Vasco Teste', 'Vasco', 'rv2test000000000000000000000e202'),
  ('00000000-0000-0000-0000-00000000e203', '00000000-0000-0000-0000-00000000f103', null, 'Bruno Teste', 'Bruno', 'rv2test000000000000000000000e203'),
  ('00000000-0000-0000-0000-00000000e204', '00000000-0000-0000-0000-00000000f104', null, 'Carla Teste', 'Carla', 'rv2test000000000000000000000e204'),
  ('00000000-0000-0000-0000-00000000e205', '00000000-0000-0000-0000-00000000f105', null, 'Paulo Teste', 'Paulo', 'rv2test000000000000000000000e205'),
  ('00000000-0000-0000-0000-00000000e206', '00000000-0000-0000-0000-00000000f106', null, 'Zé Teste',    'Zé',    'rv2test000000000000000000000e206'),
  ('00000000-0000-0000-0000-00000000e207', '00000000-0000-0000-0000-00000000f107', '00000000-0000-0000-0000-0000000001e0', 'Rui Teste', 'Rui', 'rv2test000000000000000000000e207');
insert into public.games (id, group_id, scheduled_at, status, spots) values
  ('00000000-0000-0000-0000-0000000001c7', '00000000-0000-0000-0000-0000000001e0', now() + interval '2 days', 'open', 10);

-- Teams through the 007000 RPCs.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select pg_temp.setkv('A', public.create_team('Leões Teste', '{"city":"Porto"}')->>'team_id');
select pg_temp.setkv('iA', public.create_team_invite(pg_temp.kv('A')::uuid)->>'token');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.setkv('B', public.create_team('Dragões Teste', '{"city":"Porto"}')->>'team_id');
select pg_temp.setkv('iB', public.create_team_invite(pg_temp.kv('B')::uuid)->>'token');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}';
select pg_temp.setkv('C', public.create_team('Águias Teste', '{"city":"Maia"}')->>'team_id');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f102","role":"authenticated"}';
select public.accept_team_invite(pg_temp.kv('iA'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}';
select public.accept_team_invite(pg_temp.kv('iB'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select public.set_member_role(pg_temp.kv('A')::uuid, '00000000-0000-0000-0000-00000000e202', 'vice');
reset role;

-- ── 1. Grants matrix ──────────────────────────────────────
select pg_temp.ok(t || ': authenticated SELECT only',
       has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT')
   and not has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
   and not has_table_privilege('authenticated', 'public.' || t, 'DELETE'))
from unnest(array['team_challenges','team_challenge_versions','team_matches']) t;
select pg_temp.ok(t || ': anon has NO table privilege',
       not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['team_challenges','team_challenge_versions','team_matches']) t;
select pg_temp.ok(t || ': service_role select/insert/update/delete',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['team_challenges','team_challenge_versions','team_matches']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['team_challenges','team_challenge_versions','team_matches']) t
join pg_class c on c.oid = ('public.' || t)::regclass;

select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.create_challenge(uuid,uuid,jsonb,text)',               'authenticated', true),
  ('public.create_challenge(uuid,uuid,jsonb,text)',               'anon',          false),
  ('public.respond_challenge(uuid,int,text,uuid,text,text)',      'authenticated', true),
  ('public.respond_challenge(uuid,int,text,uuid,text,text)',      'anon',          false),
  ('public.counter_challenge(uuid,int,jsonb,uuid,text)',          'authenticated', true),
  ('public.counter_challenge(uuid,int,jsonb,uuid,text)',          'anon',          false),
  ('public.cancel_challenge(uuid,text)',                          'anon',          false),
  ('public.propose_match_change(uuid,int,jsonb,uuid)',            'anon',          false),
  ('public.respond_match_change(uuid,int,text,uuid)',             'anon',          false),
  ('public.set_field_status(uuid,text,text)',                     'authenticated', true),
  ('public.set_field_status(uuid,text,text)',                     'anon',          false),
  ('public.my_challenges()',                                      'authenticated', true),
  ('public.my_challenges()',                                      'anon',          false),
  ('public.get_challenge_invite(text)',                           'anon',          true),
  ('public.get_challenge_invite(text)',                           'authenticated', true),
  ('public.can_see_challenge(uuid)',                              'anon',          false),
  ('public.expire_rivals()',                                      'authenticated', false),
  ('public.expire_rivals()',                                      'anon',          false),
  ('public.rivals_expire_due(uuid)',                              'authenticated', false),
  ('public.rivals_norm_terms(jsonb,jsonb)',                       'authenticated', false),
  ('public.rivals_claim(public.team_challenges,uuid,text)',       'authenticated', false),
  ('public.rivals_insert_version(uuid,int,text,uuid,jsonb)',      'authenticated', false),
  ('public.archive_team(uuid)',                                   'anon',          false)
) v(f, r, e);

select pg_temp.ok('realtime publication has ' || t,
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t))
from unnest(array['team_challenges','team_matches']) t;
select pg_temp.ok('pg_cron job pitch-rivals-expire scheduled hourly',
  exists (select 1 from cron.job where jobname = 'pitch-rivals-expire' and schedule = '15 * * * *'));

-- ── 2. Group game tables untouched (option B regression) ──
select pg_temp.ok('games/attendances/matchdays policies identical to the ' || b || ' baseline',
  (select payload->>'group_policies_md5' from public.rivals_audit_log where action = b)
  = (select md5(coalesce(string_agg(
       format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
              coalesce(qual, ''), coalesce(with_check, '')),
       E'\n' order by tablename, policyname), ''))
     from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')))
from unnest(array['migration_baseline:007000','migration_baseline:20261013140000']) b;
select pg_temp.ok('no games/attendances/matchdays policy references challenges/matches',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')
               and (coalesce(qual, '') ilike '%challenge%' or coalesce(with_check, '') ilike '%challenge%'
                    or coalesce(qual, '') ilike '%team_match%' or coalesce(with_check, '') ilike '%team_match%')));

-- ── 3. Create (directed) ──────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
do $$
declare r jsonb; r2 jsonb; c public.team_challenges%rowtype;
begin
  r := public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, pg_temp.terms(72), 'clientref-0001');
  perform pg_temp.setkv('c1', r->>'challenge_id');
  select * into c from public.team_challenges where id = (r->>'challenge_id')::uuid;
  perform pg_temp.ok('create: directed, pending, v1, turn = challenged',
    (r->>'created')::boolean and c.mode = 'directed' and c.status = 'pending' and c.current_version = 1
    and c.turn_team_id = pg_temp.kv('B')::uuid and char_length(c.invite_token) = 32, r::text);
  perform pg_temp.ok('create: deadline = now + 24h when kickoff is far', c.expires_at = now() + interval '24 hours', c.expires_at::text);
  perform pg_temp.ok('create: version 1 = proposal by challenger, defaults filled (tz, currency, split, field)',
    exists (select 1 from public.team_challenge_versions v where v.challenge_id = c.id and v.version = 1 and v.kind = 'proposal'
             and v.proposed_by_team_id = pg_temp.kv('A')::uuid and v.timezone = 'Europe/Lisbon' and v.currency = 'EUR'
             and v.cost_split = 'split' and v.field_responsible = 'challenger' and v.outcome is null));
  r2 := public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('B')::uuid, pg_temp.terms(72), 'clientref-0001');
  perform pg_temp.ok('create: same client_ref → same challenge, created = false',
    r2->>'challenge_id' = r->>'challenge_id' and not (r2->>'created')::boolean, r2::text);
  r := public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid, pg_temp.terms(10));
  perform pg_temp.setkv('c_ac', r->>'challenge_id');
  perform pg_temp.ok('create: deadline = kickoff − 2h when kickoff is close',
    (r->>'expires_at')::timestamptz = now() + interval '8 hours', r::text);
end $$;
select pg_temp.expect_err('one open proposal per pair (same direction)',
  format('select public.create_challenge(%L, %L, pg_temp.terms(96))', pg_temp.kv('A'), pg_temp.kv('B')), 'rivals:pair_open_challenge');
select pg_temp.expect_err('kickoff < 3h ahead refused',
  format('select public.create_challenge(%L, null, pg_temp.terms(1))', pg_temp.kv('A')), 'rivals:kickoff_too_soon');
select pg_temp.expect_err('kickoff > 180 days refused',
  format('select public.create_challenge(%L, null, pg_temp.terms(24*200))', pg_temp.kv('A')), 'rivals:kickoff_too_far');
select pg_temp.expect_err('challenging yourself refused',
  format('select public.create_challenge(%L, %L, pg_temp.terms(48))', pg_temp.kv('A'), pg_temp.kv('A')), 'rivals:invalid_opponent');
select pg_temp.expect_err('unknown terms key refused',
  format($q$select public.create_challenge(%L, null, pg_temp.terms(48, '{"hack":1}'))$q$, pg_temp.kv('A')), 'rivals:invalid_field');
select pg_temp.expect_err('bad split refused',
  format($q$select public.create_challenge(%L, null, pg_temp.terms(48, '{"cost_split":"winner"}'))$q$, pg_temp.kv('A')), 'rivals:invalid_split');
-- No direct writes.
select pg_temp.expect_err('direct INSERT team_challenges denied',
  format($q$insert into public.team_challenges (challenger_team_id, mode, expires_at) values (%L, 'claimable', now())$q$, pg_temp.kv('A')), 'permission denied');
select pg_temp.expect_err('direct UPDATE team_challenges denied',
  format($q$update public.team_challenges set status = 'agreed' where id = %L$q$, pg_temp.kv('c1')), 'permission denied');
select pg_temp.expect_err('direct UPDATE team_challenge_versions denied',
  format($q$update public.team_challenge_versions set cost_cents = 0 where challenge_id = %L$q$, pg_temp.kv('c1')), 'permission denied');
select pg_temp.expect_err('direct INSERT team_matches denied',
  format($q$insert into public.team_matches (challenge_id, home_team_id, away_team_id, agreed_version, kickoff_at, timezone, format, duration_min, field_responsible, currency, cost_split) values (%L, %L, %L, 1, now(), 'Europe/Lisbon', '7v7', 60, 'challenger', 'EUR', 'split')$q$,
         pg_temp.kv('c1'), pg_temp.kv('A'), pg_temp.kv('B')), 'permission denied');
reset role;

-- Reverse direction also blocked; plain member can't challenge.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.expect_err('one open proposal per pair (reverse direction)',
  format('select public.create_challenge(%L, %L, pg_temp.terms(96))', pg_temp.kv('B'), pg_temp.kv('A')), 'rivals:pair_open_challenge');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}';
select pg_temp.expect_err('plain member cannot create a challenge',
  format('select public.create_challenge(%L, null, pg_temp.terms(48))', pg_temp.kv('B')), 'rivals:not_team_leader');
select pg_temp.expect_err('plain member cannot respond',
  format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c1')), 'rivals:not_team_leader');
select pg_temp.ok('plain member of the challenged team sees the challenge + versions',
  (select count(*) from public.team_challenges where id = pg_temp.kv('c1')::uuid) = 1
  and (select count(*) from public.team_challenge_versions where challenge_id = pg_temp.kv('c1')::uuid) = 1);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f106","role":"authenticated"}';
select pg_temp.ok('outsider sees no challenge / version rows',
  (select count(*) from public.team_challenges where id = pg_temp.kv('c1')::uuid) = 0
  and (select count(*) from public.team_challenge_versions where challenge_id = pg_temp.kv('c1')::uuid) = 0);
select pg_temp.expect_err('outsider cannot respond', format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c1')), 'rivals:not_team_leader');
reset role;

-- ── 4. Turn rules: proposer can't accept own; counter flips turn ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select pg_temp.expect_err('proposer cannot accept its own proposal (not its turn)',
  format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c1')), 'rivals:not_your_turn');
select pg_temp.expect_err('proposer cannot counter its own proposal',
  format($q$select public.counter_challenge(%L, 1, '{"duration_min":70}')$q$, pg_temp.kv('c1')), 'rivals:not_your_turn');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.expect_err('counter with no change refused',
  format($q$select public.counter_challenge(%L, 1, '{"duration_min":60}')$q$, pg_temp.kv('c1')), 'rivals:no_changes');
do $$
declare r jsonb; c public.team_challenges%rowtype;
begin
  r := public.counter_challenge(pg_temp.kv('c1')::uuid, 1, jsonb_build_object('kickoff_at', now() + interval '96 hours', 'cost_split', 'challenger'));
  select * into c from public.team_challenges where id = pg_temp.kv('c1')::uuid;
  perform pg_temp.ok('counter: v2, turn flips to challenger, deadline reset',
    (r->>'version')::int = 2 and c.current_version = 2 and c.turn_team_id = pg_temp.kv('A')::uuid
    and c.expires_at = now() + interval '24 hours' and c.status = 'pending', r::text);
  perform pg_temp.ok('counter: v1 marked countered, v2 kind counter by challenged, unchanged keys carried over',
    (select outcome from public.team_challenge_versions where challenge_id = c.id and version = 1) = 'countered'
    and exists (select 1 from public.team_challenge_versions v where v.challenge_id = c.id and v.version = 2 and v.kind = 'counter'
                 and v.proposed_by_team_id = pg_temp.kv('B')::uuid and v.cost_split = 'challenger' and v.venue_name = 'Campo Teste'
                 and v.cost_cents = 6000));
end $$;
select pg_temp.expect_err('counter author cannot accept its own counter',
  format($q$select public.respond_challenge(%L, 2, 'accept')$q$, pg_temp.kv('c1')), 'rivals:not_your_turn');
select pg_temp.expect_err('stale base version refused on counter',
  format($q$select public.counter_challenge(%L, 1, '{"duration_min":90}')$q$, pg_temp.kv('c1')), 'rivals:stale_version');
reset role;

-- ── 5. Accept: stale refused, one match, idempotent ───────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select pg_temp.expect_err('accepting an old version refused',
  format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c1')), 'rivals:stale_version');
do $$
declare r jsonb; r2 jsonb; m public.team_matches%rowtype;
begin
  r := public.respond_challenge(pg_temp.kv('c1')::uuid, 2, 'accept');
  perform pg_temp.setkv('m1', r->>'match_id');
  select * into m from public.team_matches where id = (r->>'match_id')::uuid;
  perform pg_temp.ok('accept: agreed + one shared match with v2 terms',
    r->>'status' = 'agreed' and not (r->>'already_agreed')::boolean and m.agreed_version = 2
    and m.home_team_id = pg_temp.kv('A')::uuid and m.away_team_id = pg_temp.kv('B')::uuid
    and m.kickoff_at = now() + interval '96 hours' and m.cost_split = 'challenger', r::text);
  perform pg_temp.ok('accept does NOT book the pitch: field unconfirmed, result none',
    m.field_status = 'unconfirmed' and m.result_status = 'none' and m.match_status = 'scheduled');
  r2 := public.respond_challenge(pg_temp.kv('c1')::uuid, 2, 'accept');
  perform pg_temp.ok('double accept → same match, already_agreed', r2->>'match_id' = r->>'match_id' and (r2->>'already_agreed')::boolean, r2::text);
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f102","role":"authenticated"}';
select pg_temp.ok('second leader (vice) accepting again → same match',
  public.respond_challenge(pg_temp.kv('c1')::uuid, 2, 'accept')->>'match_id' = pg_temp.kv('m1'));
select pg_temp.expect_err('counter after agreement refused',
  format($q$select public.counter_challenge(%L, 2, '{"duration_min":90}')$q$, pg_temp.kv('c1')), 'rivals:challenge_agreed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}';
select pg_temp.ok('both teams see the same match (plain member of B)',
  (select count(*) from public.team_matches where id = pg_temp.kv('m1')::uuid) = 1);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f106","role":"authenticated"}';
select pg_temp.ok('outsider does not see the match', (select count(*) from public.team_matches where id = pg_temp.kv('m1')::uuid) = 0);
reset role;
select pg_temp.ok('exactly one match for the challenge', (select count(*) from public.team_matches where challenge_id = pg_temp.kv('c1')::uuid) = 1);
select pg_temp.expect_err('DB refuses a second match for the same challenge (unique)',
  format($q$insert into public.team_matches (challenge_id, home_team_id, away_team_id, agreed_version, kickoff_at, timezone, format, duration_min, field_responsible, currency, cost_split) values (%L, %L, %L, 2, now(), 'Europe/Lisbon', '7v7', 60, 'challenger', 'EUR', 'split')$q$,
         pg_temp.kv('c1'), pg_temp.kv('A'), pg_temp.kv('B')), 'team_matches_challenge_key');
select pg_temp.expect_err('versions are immutable (terms cannot be rewritten)',
  format($q$update public.team_challenge_versions set cost_cents = 1 where challenge_id = %L and version = 1$q$, pg_temp.kv('c1')), 'rivals:version_immutable');

-- ── 6. Field status ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.expect_err('the non-responsible team cannot set the field status',
  format($q$select public.set_field_status(%L, 'confirmed')$q$, pg_temp.kv('m1')), 'rivals:not_field_responsible');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select public.set_field_status(pg_temp.kv('m1')::uuid, 'confirmed', 'Reservado às 21h');
select pg_temp.ok('responsible team confirms the pitch',
  (select field_status = 'confirmed' and field_note = 'Reservado às 21h' from public.team_matches where id = pg_temp.kv('m1')::uuid));
reset role;

-- ── 7. Change after agreement needs consent ───────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.expect_err('change with no difference refused',
  format($q$select public.propose_match_change(%L, 2, '{"duration_min":60}')$q$, pg_temp.kv('m1')), 'rivals:no_changes');
select public.propose_match_change(pg_temp.kv('m1')::uuid, 2, jsonb_build_object('kickoff_at', now() + interval '120 hours'));
select pg_temp.ok('change: v3 pending, turn to the other team, match untouched',
  (select pending_change_version = 3 and current_version = 3 and turn_team_id = pg_temp.kv('A')::uuid and status = 'agreed'
     from public.team_challenges where id = pg_temp.kv('c1')::uuid)
  and (select kickoff_at = now() + interval '96 hours' and field_status = 'confirmed' from public.team_matches where id = pg_temp.kv('m1')::uuid));
select pg_temp.expect_err('one open change at a time',
  format($q$select public.propose_match_change(%L, 3, '{"duration_min":90}')$q$, pg_temp.kv('m1')), 'rivals:change_pending');
select pg_temp.expect_err('proposer cannot accept its own change',
  format($q$select public.respond_match_change(%L, 3, 'accept')$q$, pg_temp.kv('m1')), 'rivals:not_your_turn');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select public.respond_match_change(pg_temp.kv('m1')::uuid, 3, 'accept');
select pg_temp.ok('change accepted: new kickoff, agreed_version 3, field back to unconfirmed',
  (select kickoff_at = now() + interval '120 hours' and agreed_version = 3 and field_status = 'unconfirmed' and field_note is null
     from public.team_matches where id = pg_temp.kv('m1')::uuid)
  and (select pending_change_version is null and turn_team_id is null from public.team_challenges where id = pg_temp.kv('c1')::uuid));
reset role;

-- ── 8. Cancel is never a loss ─────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
do $$
declare r jsonb; r2 jsonb;
begin
  r := public.cancel_challenge(pg_temp.kv('c1')::uuid, 'Faltam jogadores');
  r2 := public.cancel_challenge(pg_temp.kv('c1')::uuid, null);
  perform pg_temp.ok('cancel agreed → match cancelled, who + reason kept',
    r->>'match_status' = 'cancelled' and (select match_status = 'cancelled' and cancelled_by_team_id = pg_temp.kv('B')::uuid
      and cancel_reason = 'Faltam jogadores' from public.team_matches where id = pg_temp.kv('m1')::uuid), r::text);
  perform pg_temp.ok('cancel ≠ loss: no result, no score', (select result_status = 'none' and official_home_score is null
      and official_away_score is null from public.team_matches where id = pg_temp.kv('m1')::uuid));
  perform pg_temp.ok('cancel twice is a no-op', r2->>'match_status' = 'cancelled', r2::text);
end $$;
reset role;

-- ── 9. Claimable link ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.create_challenge(pg_temp.kv('A')::uuid, null, pg_temp.terms(48));
  perform pg_temp.setkv('cl', r->>'challenge_id');
  perform pg_temp.setkv('tok', r->>'token');
  perform pg_temp.ok('claimable: mode claimable, nobody''s turn yet',
    r->>'mode' = 'claimable' and (select challenged_team_id is null and turn_team_id is null from public.team_challenges where id = (r->>'challenge_id')::uuid), r::text);
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.ok('unclaimed claimable is invisible to other teams via RLS',
  (select count(*) from public.team_challenges where id = pg_temp.kv('cl')::uuid) = 0);
reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare p jsonb;
begin
  p := public.get_challenge_invite(pg_temp.kv('tok'));
  perform pg_temp.ok('anon preview: pending, terms + challenger, no roster, not logged in',
    p->>'status' = 'pending' and p->>'mode' = 'claimable' and not (p->>'claimed')::boolean
    and p->'challenger'->>'name' = 'Leões Teste' and p->'terms'->>'venue_name' = 'Campo Teste'
    and not (p->'viewer'->>'logged_in')::boolean and not (p ? 'members') and not (p->'challenger' ? 'members'), p::text);
  perform pg_temp.ok('anon preview: unknown token → not_found', public.get_challenge_invite('nope00000000')->>'status' = 'not_found');
end $$;
select pg_temp.expect_err('anon cannot read team_challenges', 'select count(*) from public.team_challenges', 'permission denied');
select pg_temp.expect_err('anon cannot respond', format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('cl')), 'permission denied');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}';
select pg_temp.expect_err('plain member cannot claim for their team',
  format($q$select public.respond_challenge(%L, 1, 'accept', %L, %L)$q$, pg_temp.kv('cl'), pg_temp.kv('B'), pg_temp.kv('tok')), 'rivals:not_team_leader');
select pg_temp.ok('plain member: no eligible team in the preview',
  jsonb_array_length(public.get_challenge_invite(pg_temp.kv('tok'))->'viewer'->'eligible_teams') = 0);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.ok('logged-in leader: B is an eligible team',
  exists (select 1 from jsonb_array_elements(public.get_challenge_invite(pg_temp.kv('tok'))->'viewer'->'eligible_teams') e
           where e->>'id' = pg_temp.kv('B')));
select pg_temp.expect_err('claim without the token refused',
  format($q$select public.respond_challenge(%L, 1, 'accept', %L, null)$q$, pg_temp.kv('cl'), pg_temp.kv('B')), 'rivals:invalid_token');
select pg_temp.expect_err('decline of an unclaimed link refused',
  format($q$select public.respond_challenge(%L, 1, 'decline', %L, %L)$q$, pg_temp.kv('cl'), pg_temp.kv('B'), pg_temp.kv('tok')), 'rivals:not_your_turn');
-- Two statements: a read in the same statement as the RPC sees the pre-update snapshot.
select pg_temp.setkv('cl_match', public.respond_challenge(pg_temp.kv('cl')::uuid, 1, 'accept', pg_temp.kv('B')::uuid, pg_temp.kv('tok'))->>'match_id');
select pg_temp.ok('claim + accept as B → agreed with a match',
  pg_temp.kv('cl_match') is not null
  and (select challenged_team_id = pg_temp.kv('B')::uuid and status = 'agreed' from public.team_challenges where id = pg_temp.kv('cl')::uuid));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}';
select pg_temp.expect_err('claimable can be claimed once (C after B)',
  format($q$select public.respond_challenge(%L, 1, 'accept', %L, %L)$q$, pg_temp.kv('cl'), pg_temp.kv('C'), pg_temp.kv('tok')), 'rivals:challenge_claimed');
select pg_temp.ok('preview for a third team says claimed', public.get_challenge_invite(pg_temp.kv('tok'))->>'status' = 'claimed');
reset role;
select pg_temp.ok('still exactly one match for the claimable', (select count(*) from public.team_matches where challenge_id = pg_temp.kv('cl')::uuid) = 1);

-- Archive blocked while a match is scheduled.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}';
select pg_temp.expect_err('archive_team blocked by a scheduled match',
  format('select public.archive_team(%L)', pg_temp.kv('B')), 'rivals:team_has_scheduled_match');
reset role;

-- ── 10. Decline + cancel pending ──────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}';
select public.respond_challenge(pg_temp.kv('c_ac')::uuid, 1, 'decline', null, null, 'Já temos jogo');
select pg_temp.ok('decline: declined + reason + version outcome',
  (select status = 'declined' and reason = 'Já temos jogo' and decided_by_team_id = pg_temp.kv('C')::uuid from public.team_challenges where id = pg_temp.kv('c_ac')::uuid)
  and (select outcome from public.team_challenge_versions where challenge_id = pg_temp.kv('c_ac')::uuid and version = 1) = 'declined');
select pg_temp.expect_err('responding to a declined challenge refused',
  format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c_ac')), 'rivals:challenge_declined');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select pg_temp.setkv('c_ac2', public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid, pg_temp.terms(30))->>'challenge_id');
select public.cancel_challenge(pg_temp.kv('c_ac2')::uuid, null);
select pg_temp.ok('cancel pending: cancelled, outcome cancelled, no match',
  (select status from public.team_challenges where id = pg_temp.kv('c_ac2')::uuid) = 'cancelled'
  and (select outcome from public.team_challenge_versions where challenge_id = pg_temp.kv('c_ac2')::uuid and version = 1) = 'cancelled'
  and not exists (select 1 from public.team_matches where challenge_id = pg_temp.kv('c_ac2')::uuid));
select pg_temp.setkv('c_ac3', public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid, pg_temp.terms(30))->>'challenge_id');
reset role;

-- ── 11. Expiry: lazy in RPCs + cron ───────────────────────
update public.team_challenges set expires_at = now() - interval '1 second' where id = pg_temp.kv('c_ac3')::uuid;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}';
select pg_temp.expect_err('lazy expiry: overdue challenge cannot be accepted',
  format($q$select public.respond_challenge(%L, 1, 'accept')$q$, pg_temp.kv('c_ac3')), 'rivals:challenge_expired');
select pg_temp.ok('lazy expiry: my_challenges reports it as expired',
  exists (select 1 from jsonb_array_elements(public.my_challenges()->'items') i where i->>'id' = pg_temp.kv('c_ac3') and i->>'effective_status' = 'expired'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}';
select pg_temp.setkv('c_ac4', public.create_challenge(pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid, pg_temp.terms(30))->>'challenge_id');
select pg_temp.ok('create persists the expiry of the stale pair row, then opens a new one',
  (select status from public.team_challenges where id = pg_temp.kv('c_ac3')::uuid) = 'expired'
  and (select status from public.team_challenges where id = pg_temp.kv('c_ac4')::uuid) = 'pending');
reset role;
update public.team_challenges set expires_at = now() - interval '1 second' where id = pg_temp.kv('c_ac4')::uuid;
-- Run the cron in its OWN statement: a check in the same statement would read
-- the pre-update snapshot (the function's writes aren't visible to sibling subqueries).
select pg_temp.setkv('expired_n', public.expire_rivals()::text);
select pg_temp.ok('cron expire_rivals() expires overdue pending rows', pg_temp.kv('expired_n')::int >= 1
  and (select status from public.team_challenges where id = pg_temp.kv('c_ac4')::uuid) = 'expired'
  and (select outcome from public.team_challenge_versions where challenge_id = pg_temp.kv('c_ac4')::uuid and version = 1) = 'expired'
  and not exists (select 1 from public.team_matches where challenge_id = pg_temp.kv('c_ac4')::uuid));

-- ── 12. Anti-spam: ≤ 10 pending per team ─────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}';
do $$
begin
  for i in 1..10 loop perform public.create_challenge(pg_temp.kv('C')::uuid, null, pg_temp.terms(48 + i)); end loop;
end $$;
select pg_temp.expect_err('11th pending challenge refused',
  format('select public.create_challenge(%L, null, pg_temp.terms(80))', pg_temp.kv('C')), 'rivals:too_many_pending');
reset role;

-- ── 13. Audit trail ───────────────────────────────────────
select pg_temp.ok('audit row for ' || a, exists (select 1 from public.rivals_audit_log where action = a
    and (challenge_id in (select id from public.team_challenges where challenger_team_id in (pg_temp.kv('A')::uuid, pg_temp.kv('C')::uuid)))))
from unnest(array['challenge_created','challenge_countered','challenge_accepted','challenge_declined','challenge_cancelled',
                  'challenge_claimed','challenge_expired','match_change_proposed','match_change_accepted',
                  'field_status_set','match_cancelled']) a;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}';
select pg_temp.ok('the other team reads the challenge audit rows (B member, A-initiated)',
  exists (select 1 from public.rivals_audit_log where challenge_id = pg_temp.kv('c1')::uuid and action = 'challenge_created'));
reset role;

-- ── 14. Group RSVP still works (magic link, anon) ─────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select public.magic_set_status('rv2test000000000000000000000e207', 'confirmed', '00000000-0000-0000-0000-0000000001c7');
reset role;
select pg_temp.ok('group RSVP via magic_set_status still confirms',
  (select status from public.attendances where game_id = '00000000-0000-0000-0000-0000000001c7'
     and player_id = '00000000-0000-0000-0000-00000000e207') = 'confirmed');

-- ── Results ───────────────────────────────────────────────
select n, check_name, ok, detail from _rv order by n;

rollback;
