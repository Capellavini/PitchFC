-- ─────────────────────────────────────────────────────────
-- Manual check for migration 20260101007000_rivals_teams (PITCH Rivals 1/3).
--
-- Run in Supabase Dashboard → SQL Editor (paste the whole file, Run), right
-- AFTER the migration is applied. Everything runs inside a transaction that
-- ROLLS BACK: fixture rows are never persisted and nothing real changes.
--
-- Same technique as adjunto_migrations_check.sql: throwaway fixtures as
-- postgres, then `set local role authenticated|anon` + a fake JWT to call
-- the RPCs as a given user. One row per check in the final SELECT — every
-- row must be ok = true.
--
-- Fixture (fixed uuids; all team-only players, no group):
--   Ana    user …f001  player …e101   creates "Rivais Teste FC" (captain)
--   Vasco  user …f002  player …e102   joins by invite → vice → demoted
--   Paulo  user …f003  player …e103   joins → vice → receives captaincy
--   Bruno  user …f004  player …e104   solo team (last member leaves → archived)
--   Carla  user …f005  player …e105   outsider, later joins via 1-use link and leaves
--   Zé     user …f006  player …e106   removed, can only return via a NEWER link
--   Rui    user …f007  player …e107   group player (group-RSVP regression)
--   anon   logged-out visitor
-- ─────────────────────────────────────────────────────────

begin;

create temp table _rv (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _rv_kv (k text primary key, v text) on commit drop;
grant all on _rv, _rv_kv to authenticated, anon;
grant usage on sequence _rv_n_seq to authenticated, anon;

-- ok(name, condition, detail)
create function pg_temp.ok(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into _rv (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail); $$;
-- expect_err(name, sql, needle): the statement must FAIL with an error
-- whose message contains `needle`.
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
grant execute on function pg_temp.ok(text, boolean, text), pg_temp.expect_err(text, text, text),
                          pg_temp.kv(text), pg_temp.setkv(text, text) to public;

-- ── Fixture (as postgres) ─────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f001', 'rivals-test-ana@example.test'),
  ('00000000-0000-0000-0000-00000000f002', 'rivals-test-vasco@example.test'),
  ('00000000-0000-0000-0000-00000000f003', 'rivals-test-paulo@example.test'),
  ('00000000-0000-0000-0000-00000000f004', 'rivals-test-bruno@example.test'),
  ('00000000-0000-0000-0000-00000000f005', 'rivals-test-carla@example.test'),
  ('00000000-0000-0000-0000-00000000f006', 'rivals-test-ze@example.test'),
  ('00000000-0000-0000-0000-00000000f007', 'rivals-test-rui@example.test');

insert into public.groups (id, name, recurring) values
  ('00000000-0000-0000-0000-0000000000e0', 'Rivals Test Group', false);

insert into public.players (id, user_id, group_id, name, nick, magic_token) values
  ('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-00000000f001', null, 'Ana Teste',   'Ana',   'rvtest0000000000000000000000e101'),
  ('00000000-0000-0000-0000-00000000e102', '00000000-0000-0000-0000-00000000f002', null, 'Vasco Teste', 'Vasco', 'rvtest0000000000000000000000e102'),
  ('00000000-0000-0000-0000-00000000e103', '00000000-0000-0000-0000-00000000f003', null, 'Paulo Teste', 'Paulo', 'rvtest0000000000000000000000e103'),
  ('00000000-0000-0000-0000-00000000e104', '00000000-0000-0000-0000-00000000f004', null, 'Bruno Teste', 'Bruno', 'rvtest0000000000000000000000e104'),
  ('00000000-0000-0000-0000-00000000e105', '00000000-0000-0000-0000-00000000f005', null, 'Carla Teste', 'Carla', 'rvtest0000000000000000000000e105'),
  ('00000000-0000-0000-0000-00000000e106', '00000000-0000-0000-0000-00000000f006', null, 'Zé Teste',    'Zé',    'rvtest0000000000000000000000e106'),
  ('00000000-0000-0000-0000-00000000e107', '00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-0000000000e0', 'Rui Teste', 'Rui', 'rvtest0000000000000000000000e107');

insert into public.games (id, group_id, scheduled_at, status, spots) values
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000e0', now() + interval '2 days', 'open', 10);

-- ── 1. Grants matrix ──────────────────────────────────────
select pg_temp.ok(t || ': authenticated SELECT only (no insert/update/delete)',
       has_table_privilege('authenticated', 'public.' || t, 'SELECT')
   and not has_table_privilege('authenticated', 'public.' || t, 'INSERT')
   and not has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
   and not has_table_privilege('authenticated', 'public.' || t, 'DELETE'))
from unnest(array['teams','team_members','team_invites','rivals_audit_log']) t;

select pg_temp.ok(t || ': anon has NO table privilege',
       not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['teams','team_members','team_invites','rivals_audit_log']) t;

select pg_temp.ok(t || ': service_role has select/insert/update/delete',
       has_table_privilege('service_role', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE')
   and has_table_privilege('service_role', 'public.' || t, 'SELECT')
   and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE')
   and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['teams','team_members','team_invites','rivals_audit_log']) t;

select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['teams','team_members','team_invites','rivals_audit_log']) t
join pg_class c on c.oid = ('public.' || t)::regclass;

select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.create_team(text,jsonb)',                     'authenticated', true),
  ('public.create_team(text,jsonb)',                     'anon',          false),
  ('public.update_team(uuid,jsonb)',                     'authenticated', true),
  ('public.update_team(uuid,jsonb)',                     'anon',          false),
  ('public.archive_team(uuid)',                          'anon',          false),
  ('public.create_team_invite(uuid,boolean,int,int)',    'authenticated', true),
  ('public.create_team_invite(uuid,boolean,int,int)',    'anon',          false),
  ('public.revoke_team_invite(uuid)',                    'anon',          false),
  ('public.accept_team_invite(text)',                    'authenticated', true),
  ('public.accept_team_invite(text)',                    'anon',          false),
  ('public.set_member_role(uuid,uuid,text)',             'anon',          false),
  ('public.transfer_captaincy(uuid,uuid)',               'anon',          false),
  ('public.remove_team_member(uuid,uuid)',               'anon',          false),
  ('public.leave_team(uuid)',                            'anon',          false),
  ('public.team_invite_preview(text)',                   'anon',          true),
  ('public.team_invite_preview(text)',                   'authenticated', true),
  ('public.team_profile(text)',                          'anon',          true),
  ('public.team_profile(text)',                          'authenticated', true),
  ('public.team_role(uuid)',                             'anon',          false),
  ('public.can_manage_team(uuid)',                       'authenticated', true),
  ('public.rivals_audit(uuid,text,jsonb)',               'authenticated', false),
  ('public.rivals_audit(uuid,text,jsonb)',               'anon',          false),
  ('public.rivals_unique_slug(text)',                    'authenticated', false),
  ('public.rivals_validate_team_fields(jsonb,boolean)',  'authenticated', false)
) v(f, r, e);

select pg_temp.ok('realtime publication has ' || t,
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t))
from unnest(array['teams','team_members']) t;

-- ── 2. Legacy backfill invariants (real data + fixtures) ──
select pg_temp.ok('every team has a slug', not exists (select 1 from public.teams where slug is null or slug = ''));
select pg_temp.ok('every live team''s captain_id has an ACTIVE captain row',
  not exists (
    select 1 from public.teams t
     where t.archived_at is null and t.captain_id is not null
       and not exists (select 1 from public.team_members m
                        where m.team_id = t.id and m.player_id = t.captain_id and m.role = 'captain' and m.status = 'active')));
select pg_temp.ok('no team has 2 active captains or 2 active vices',
  not exists (select 1 from public.team_members where status = 'active' and role in ('captain','vice')
               group by team_id, role having count(*) > 1));
select pg_temp.ok('legacy members kept active (no deactivation without an audit row)',
  not exists (
    select 1 from public.team_members m
     where m.status <> 'active'
       and m.joined_at < (select created_at from public.rivals_audit_log where action = 'migration_baseline:007000')
       and not exists (select 1 from public.rivals_audit_log a
                        where a.team_id = m.team_id and a.action in ('member_left','member_removed')
                          and a.payload->>'player_id' = m.player_id::text)));

-- ── 3. Group game tables untouched (option B regression) ──
select pg_temp.ok('games/attendances/matchdays policies identical to the pre-migration baseline',
  (select payload->>'group_policies_md5' from public.rivals_audit_log where action = 'migration_baseline:007000')
  = (select md5(coalesce(string_agg(
       format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
              coalesce(qual, ''), coalesce(with_check, '')),
       E'\n' order by tablename, policyname), ''))
     from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')));
select pg_temp.ok('no games/attendances/matchdays policy references teams',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('games','attendances','matchdays')
               and (coalesce(qual, '') ilike '%team_%' or coalesce(with_check, '') ilike '%team_%')));

-- ── 4. Ana creates a team (double-tap idempotent) ─────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
do $$
declare r1 jsonb; r2 jsonb; inv jsonb; inv2 jsonb;
begin
  r1 := public.create_team('Rivais Teste FC', '{"city":"Porto","preferred_format":"7v7","color":"#FF3B5C","secondary_color":"#FFFFFF"}');
  r2 := public.create_team('rivais teste fc', '{}');
  perform pg_temp.setkv('t1', r1->>'team_id');
  perform pg_temp.setkv('slug1', r1->>'slug');
  perform pg_temp.ok('create_team: created = true, slug derived', (r1->>'created')::boolean and r1->>'slug' = 'rivais-teste-fc', r1::text);
  perform pg_temp.ok('create_team double-tap: same team, created = false', r2->>'team_id' = r1->>'team_id' and not (r2->>'created')::boolean, r2::text);
  perform pg_temp.ok('creator is captain', public.team_role((r1->>'team_id')::uuid) = 'captain');

  inv := public.create_team_invite((r1->>'team_id')::uuid);
  inv2 := public.create_team_invite((r1->>'team_id')::uuid);
  perform pg_temp.setkv('i1', inv->>'token');
  perform pg_temp.ok('invite: 32-char token, ~14 days', char_length(inv->>'token') = 32
    and (inv->>'expires_at')::timestamptz between now() + interval '13 days' and now() + interval '15 days', inv::text);
  perform pg_temp.ok('invite: second call returns the same live link', inv2->>'token' = inv->>'token');
  perform pg_temp.ok('leader can read the team''s invites',
    (select count(*) from public.team_invites where team_id = (r1->>'team_id')::uuid) = 1);

  perform public.update_team((r1->>'team_id')::uuid, '{"name":"Rivais Renomeados"}');
  perform pg_temp.ok('captain rename keeps the slug',
    (select slug from public.teams where id = (r1->>'team_id')::uuid) = 'rivais-teste-fc'
    and (select name from public.teams where id = (r1->>'team_id')::uuid) = 'Rivais Renomeados');
end $$;
select pg_temp.expect_err('update_team rejects slug (allow-list)',
  format($q$select public.update_team(%L, '{"slug":"hack"}')$q$, pg_temp.kv('t1')), 'rivals:invalid_field');
select pg_temp.expect_err('update_team rejects a bad colour',
  format($q$select public.update_team(%L, '{"color":"red"}')$q$, pg_temp.kv('t1')), 'rivals:invalid_color');
select pg_temp.expect_err('create_team rejects a 1-char name', $q$select public.create_team('X', '{}')$q$, 'rivals:invalid_name');

-- No direct writes, even for the captain.
select pg_temp.expect_err('direct INSERT teams denied', $q$insert into public.teams (name, slug) values ('Hack', 'hack')$q$, 'permission denied');
select pg_temp.expect_err('direct UPDATE teams (captain_id hijack) denied',
  format($q$update public.teams set captain_id = '00000000-0000-0000-0000-00000000e105' where id = %L$q$, pg_temp.kv('t1')), 'permission denied');
select pg_temp.expect_err('direct INSERT team_members denied',
  format($q$insert into public.team_members (team_id, player_id, role) values (%L, '00000000-0000-0000-0000-00000000e105', 'captain')$q$, pg_temp.kv('t1')), 'permission denied');
select pg_temp.expect_err('direct DELETE team_members denied',
  format($q$delete from public.team_members where team_id = %L$q$, pg_temp.kv('t1')), 'permission denied');
select pg_temp.expect_err('direct INSERT team_invites denied',
  format($q$insert into public.team_invites (team_id) values (%L)$q$, pg_temp.kv('t1')), 'permission denied');
select pg_temp.expect_err('direct INSERT rivals_audit_log denied',
  $q$insert into public.rivals_audit_log (action) values ('hack')$q$, 'permission denied');
reset role;

-- ── 5. Outsider (Carla) and anon ──────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select pg_temp.ok('outsider can read the team', (select count(*) from public.teams where id = pg_temp.kv('t1')::uuid) = 1);
select pg_temp.ok('outsider can NOT read the invite token', (select count(*) from public.team_invites where team_id = pg_temp.kv('t1')::uuid) = 0);
select pg_temp.expect_err('outsider cannot create an invite', format('select public.create_team_invite(%L)', pg_temp.kv('t1')), 'rivals:not_team_leader');
select pg_temp.expect_err('outsider cannot edit the team', format($q$select public.update_team(%L, '{"city":"Lisboa"}')$q$, pg_temp.kv('t1')), 'rivals:not_team_leader');
reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare p jsonb; pr jsonb; nf jsonb;
begin
  p := public.team_invite_preview(pg_temp.kv('i1'));
  perform pg_temp.ok('anon invite preview: valid + team name + no roster',
    p->>'status' = 'valid' and p->'team'->>'name' = 'Rivais Renomeados' and (p->'team'->>'member_count')::int = 1
    and not (p ? 'members') and not (p->'team' ? 'members') and p->>'invited_by' = 'Ana', p::text);
  nf := public.team_invite_preview('doesnotexist000');
  perform pg_temp.ok('anon invite preview: unknown token → not_found', nf->>'status' = 'not_found', nf::text);
  pr := public.team_profile(pg_temp.kv('slug1'));
  perform pg_temp.ok('anon team_profile: identity + zero record, no roster',
    pr->>'name' = 'Rivais Renomeados' and (pr->'record'->>'played')::int = 0 and not (pr ? 'members') and pr->>'my_role' is null, pr::text);
end $$;
select pg_temp.expect_err('anon cannot read teams directly', 'select count(*) from public.teams', 'permission denied');
select pg_temp.expect_err('anon cannot accept an invite', format('select public.accept_team_invite(%L)', pg_temp.kv('i1')), 'permission denied');
reset role;

-- ── 6. Joining by invite → always 'player', idempotent ────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f003","role":"authenticated","email":"rivals-test-paulo@example.test"}';
do $$
declare a1 jsonb; a2 jsonb;
begin
  a1 := public.accept_team_invite(pg_temp.kv('i1'));
  a2 := public.accept_team_invite(pg_temp.kv('i1'));
  perform pg_temp.ok('accept: joins as player', not (a1->>'already_member')::boolean
    and public.team_role(pg_temp.kv('t1')::uuid) = 'player', a1::text);
  perform pg_temp.ok('accept twice: already_member = true', (a2->>'already_member')::boolean, a2::text);
end $$;
select pg_temp.expect_err('player cannot create an invite', format('select public.create_team_invite(%L)', pg_temp.kv('t1')), 'rivals:not_team_leader');
select pg_temp.expect_err('player cannot promote self to vice',
  format($q$select public.set_member_role(%L, '00000000-0000-0000-0000-00000000e103', 'vice')$q$, pg_temp.kv('t1')), 'rivals:captain_only');
reset role;
select pg_temp.ok('idempotent accept did not count a second use',
  (select uses from public.team_invites where token = pg_temp.kv('i1')) = 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f002","role":"authenticated","email":"rivals-test-vasco@example.test"}';
select public.accept_team_invite(pg_temp.kv('i1'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f006","role":"authenticated","email":"rivals-test-ze@example.test"}';
select public.accept_team_invite(pg_temp.kv('i1'));
reset role;

-- ── 7. Roles: ≤1 vice, captain-only actions ───────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
do $$
declare r jsonb;
begin
  perform public.set_member_role(pg_temp.kv('t1')::uuid, '00000000-0000-0000-0000-00000000e102', 'vice');
  r := public.set_member_role(pg_temp.kv('t1')::uuid, '00000000-0000-0000-0000-00000000e103', 'vice');
  perform pg_temp.ok('second vice demotes the first (≤1 vice)',
    r->>'demoted' = '00000000-0000-0000-0000-00000000e102'
    and (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid and role = 'vice' and status = 'active') = 1
    and (select role from public.team_members where team_id = pg_temp.kv('t1')::uuid and player_id = '00000000-0000-0000-0000-00000000e103') = 'vice', r::text);
end $$;
select pg_temp.expect_err('set_member_role cannot touch the captain',
  format($q$select public.set_member_role(%L, '00000000-0000-0000-0000-00000000e101', 'player')$q$, pg_temp.kv('t1')), 'rivals:use_transfer');
select pg_temp.expect_err('set_member_role rejects non-members',
  format($q$select public.set_member_role(%L, '00000000-0000-0000-0000-00000000e105', 'vice')$q$, pg_temp.kv('t1')), 'rivals:not_a_member');
select pg_temp.expect_err('set_member_role rejects role captain',
  format($q$select public.set_member_role(%L, '00000000-0000-0000-0000-00000000e103', 'captain')$q$, pg_temp.kv('t1')), 'rivals:invalid_role');
reset role;

-- Paulo is vice now.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f003","role":"authenticated","email":"rivals-test-paulo@example.test"}';
select pg_temp.expect_err('vice cannot rename (captain only)', format($q$select public.update_team(%L, '{"name":"Golpe"}')$q$, pg_temp.kv('t1')), 'rivals:captain_only');
select public.update_team(pg_temp.kv('t1')::uuid, '{"city":"Matosinhos"}');
select pg_temp.ok('vice can edit other fields', (select city from public.teams where id = pg_temp.kv('t1')::uuid) = 'Matosinhos');
select pg_temp.expect_err('vice cannot remove the captain',
  format($q$select public.remove_team_member(%L, '00000000-0000-0000-0000-00000000e101')$q$, pg_temp.kv('t1')), 'rivals:cannot_remove_captain');
select pg_temp.expect_err('vice cannot transfer captaincy',
  format($q$select public.transfer_captaincy(%L, '00000000-0000-0000-0000-00000000e103')$q$, pg_temp.kv('t1')), 'rivals:captain_only');
select public.remove_team_member(pg_temp.kv('t1')::uuid, '00000000-0000-0000-0000-00000000e106');
select pg_temp.ok('vice removes a player (soft: status removed, left_at set)',
  (select status = 'removed' and left_at is not null from public.team_members
    where team_id = pg_temp.kv('t1')::uuid and player_id = '00000000-0000-0000-0000-00000000e106'));
select pg_temp.ok('vice can share the invite link', (public.create_team_invite(pg_temp.kv('t1')::uuid))->>'token' = pg_temp.kv('i1'));
reset role;

-- Removed player: the old link doesn't bring him back; still sees own row.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f006","role":"authenticated","email":"rivals-test-ze@example.test"}';
select pg_temp.expect_err('removed player cannot rejoin with a link older than the removal',
  format('select public.accept_team_invite(%L)', pg_temp.kv('i1')), 'rivals:removed_from_team');
select pg_temp.ok('removed player still sees his own history row',
  (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid and player_id = '00000000-0000-0000-0000-00000000e106') = 1);
reset role;

-- Visibility of history: outsiders see only active rows, members see all.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select pg_temp.ok('outsider sees the active roster but not removed rows',
  (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid) = 3
  and (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid and status <> 'active') = 0);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
select pg_temp.ok('member sees the team history (removed rows)',
  (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid and status = 'removed') = 1);
reset role;

-- ── 8. Expired / revoked / used-up invites ────────────────
update public.team_invites set expires_at = now() - interval '1 second' where token = pg_temp.kv('i1');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select pg_temp.expect_err('expired invite cannot be used', format('select public.accept_team_invite(%L)', pg_temp.kv('i1')), 'rivals:invite_expired');
select pg_temp.ok('expired invite preview says expired', public.team_invite_preview(pg_temp.kv('i1'))->>'status' = 'expired');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
do $$
declare i2 jsonb;
begin
  i2 := public.create_team_invite(pg_temp.kv('t1')::uuid);
  perform pg_temp.setkv('i2', i2->>'token');
  perform pg_temp.ok('expired link is replaced by a new one (old revoked)', i2->>'token' <> pg_temp.kv('i1')
    and (select revoked_at is not null from public.team_invites where token = pg_temp.kv('i1')));
  perform pg_temp.ok('revoke_team_invite revokes the live link', (public.revoke_team_invite(pg_temp.kv('t1')::uuid)->>'revoked')::int = 1);
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select pg_temp.expect_err('revoked invite cannot be used', format('select public.accept_team_invite(%L)', pg_temp.kv('i2')), 'rivals:invite_revoked');
select pg_temp.ok('revoked invite preview says revoked', public.team_invite_preview(pg_temp.kv('i2'))->>'status' = 'revoked');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
select pg_temp.setkv('i3', public.create_team_invite(pg_temp.kv('t1')::uuid, true)->>'token');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f006","role":"authenticated","email":"rivals-test-ze@example.test"}';
select public.accept_team_invite(pg_temp.kv('i3'));
select pg_temp.ok('removed player returns via a link created after the removal, as player',
  public.team_role(pg_temp.kv('t1')::uuid) = 'player');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
select pg_temp.setkv('i4', public.create_team_invite(pg_temp.kv('t1')::uuid, true, 14, 1)->>'token');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select public.accept_team_invite(pg_temp.kv('i4'));
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f004","role":"authenticated","email":"rivals-test-bruno@example.test"}';
select pg_temp.expect_err('1-use invite: second person is refused', format('select public.accept_team_invite(%L)', pg_temp.kv('i4')), 'rivals:invite_used_up');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select public.leave_team(pg_temp.kv('t1')::uuid);
select pg_temp.ok('player leaves (status left)', public.team_role(pg_temp.kv('t1')::uuid) is null);
reset role;

-- ── 9. Captaincy invariants ───────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f001","role":"authenticated","email":"rivals-test-ana@example.test"}';
select pg_temp.expect_err('captain with teammates cannot leave', format('select public.leave_team(%L)', pg_temp.kv('t1')), 'rivals:captain_must_transfer');
select pg_temp.expect_err('captaincy cannot go to a non-member',
  format($q$select public.transfer_captaincy(%L, '00000000-0000-0000-0000-00000000e104')$q$, pg_temp.kv('t1')), 'rivals:invalid_target');
select public.transfer_captaincy(pg_temp.kv('t1')::uuid, '00000000-0000-0000-0000-00000000e103');
select pg_temp.ok('transfer: vice becomes captain, old captain becomes vice, captain_id synced',
  (select captain_id from public.teams where id = pg_temp.kv('t1')::uuid) = '00000000-0000-0000-0000-00000000e103'
  and public.team_role(pg_temp.kv('t1')::uuid) = 'vice'
  and (select count(*) from public.team_members where team_id = pg_temp.kv('t1')::uuid and role = 'captain' and status = 'active') = 1);
select pg_temp.expect_err('ex-captain can no longer transfer',
  format($q$select public.transfer_captaincy(%L, '00000000-0000-0000-0000-00000000e102')$q$, pg_temp.kv('t1')), 'rivals:captain_only');
select public.leave_team(pg_temp.kv('t1')::uuid);
select pg_temp.ok('vice can leave', public.team_role(pg_temp.kv('t1')::uuid) is null);
reset role;
select pg_temp.expect_err('DB refuses a second active captain (unique index)',
  format($q$update public.team_members set role = 'captain' where team_id = %L and player_id = '00000000-0000-0000-0000-00000000e102'$q$, pg_temp.kv('t1')),
  'team_members_one_captain_key');

-- Last member leaving archives; the name is free again afterwards.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f004","role":"authenticated","email":"rivals-test-bruno@example.test"}';
do $$
declare t2 jsonb; l jsonb; t3 jsonb;
begin
  t2 := public.create_team('Bruno Solo', '{}');
  l := public.leave_team((t2->>'team_id')::uuid);
  perform pg_temp.setkv('t2', t2->>'team_id');
  perform pg_temp.ok('last member leaving archives the team', (l->>'archived')::boolean
    and (select archived_at is not null from public.teams where id = (t2->>'team_id')::uuid), l::text);
  t3 := public.create_team('Bruno Solo', '{}');
  perform pg_temp.ok('archived name can be reused (new team)', (t3->>'created')::boolean and t3->>'team_id' <> t2->>'team_id'
    and t3->>'slug' = 'bruno-solo-2', t3::text);
end $$;
select pg_temp.expect_err('archived team: no new invites', format('select public.create_team_invite(%L)', pg_temp.kv('t2')), 'rivals:team_archived');
reset role;

-- ── 10. Audit trail ───────────────────────────────────────
select pg_temp.ok('audit row for ' || a,
  exists (select 1 from public.rivals_audit_log where team_id = pg_temp.kv('t1')::uuid and action = a))
from unnest(array['team_created','team_updated','invite_created','invite_revoked','member_joined',
                  'role_changed','member_removed','captaincy_transferred','member_left']) a;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f005","role":"authenticated","email":"rivals-test-carla@example.test"}';
select pg_temp.ok('ex-member cannot read the team audit log',
  (select count(*) from public.rivals_audit_log where team_id = pg_temp.kv('t1')::uuid) = 0);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f003","role":"authenticated","email":"rivals-test-paulo@example.test"}';
select pg_temp.ok('member can read the team audit log',
  (select count(*) from public.rivals_audit_log where team_id = pg_temp.kv('t1')::uuid) > 5);
reset role;

-- ── 11. Group RSVP still works (magic link, anon) ─────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select public.magic_set_status('rvtest0000000000000000000000e107', 'confirmed', '00000000-0000-0000-0000-0000000000c7');
reset role;
select pg_temp.ok('group RSVP via magic_set_status still confirms',
  (select status from public.attendances where game_id = '00000000-0000-0000-0000-0000000000c7'
     and player_id = '00000000-0000-0000-0000-00000000e107') = 'confirmed');

-- ── Results ───────────────────────────────────────────────
select n, check_name, ok, detail from _rv order by n;

rollback;
