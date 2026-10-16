-- ─────────────────────────────────────────────────────────
-- DRAFT check for PR L1 (01_league_orgs.sql) — same contract as
-- supabase/tests/rivals_*_check.sql: run in the SQL editor right after the
-- migration; everything is inside a transaction that ROLLS BACK; one row
-- per check; every row must be ok = true.
-- When L1 ships, move to supabase/tests/league_orgs_check.sql.
--
-- Fixture (fixed uuids):
--   Olga  user …f301  player …e401  requester → owner of league L ("Liga Teste")
--   Manu  user …f302  player …e402  manager of L (via invite)
--   Sara  user …f303  player …e403  scorer of L (via invite from Manu)
--   Zé    user …f304  player …e404  outsider (signed in, no role)
--   Bea   user …f305  player …e405  owner of league B (isolation)
--   Admin user …f309  player …e409  app admin (JWT email)
--   anon  logged-out visitor
-- ─────────────────────────────────────────────────────────

begin;

create temp table _lc (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _lc_kv (k text primary key, v text) on commit drop;
grant all on _lc, _lc_kv to authenticated, anon;
grant usage on sequence _lc_n_seq to authenticated, anon;

create function pg_temp.ok(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into _lc (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail); $$;
create function pg_temp.expect_err(p_name text, p_sql text, p_needle text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into _lc (check_name, ok, detail) values (p_name, false, 'no error raised');
exception when others then
  insert into _lc (check_name, ok, detail) values (p_name, position(p_needle in sqlerrm) > 0, sqlerrm);
end $$;
create function pg_temp.kv(p_k text) returns text language sql stable as $$ select v from _lc_kv where k = p_k; $$;
create function pg_temp.setkv(p_k text, p_v text) returns void language sql as $$
  insert into _lc_kv (k, v) values (p_k, p_v) on conflict (k) do update set v = excluded.v; $$;
create function pg_temp.as_user(p_nn text) returns void language sql as $$
  select set_config('request.jwt.claims',
    format('{"sub":"00000000-0000-0000-0000-00000000f3%s","role":"authenticated","email":"%s"}', p_nn,
           case when p_nn = '09' then 'capella.vinicius@gmail.com' else 'lg-' || p_nn || '@example.test' end), true); $$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true); $$;
create function pg_temp.pl(p_nn text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-00000000e4' || p_nn)::uuid; $$;
grant execute on function pg_temp.ok(text, boolean, text), pg_temp.expect_err(text, text, text), pg_temp.kv(text),
                          pg_temp.setkv(text, text), pg_temp.as_user(text), pg_temp.as_anon(), pg_temp.pl(text) to public;

-- ── Fixture (as postgres) ─────────────────────────────────
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000f3' || n)::uuid, 'lg-' || n || '@example.test'
  from unnest(array['01','02','03','04','05','09']) n;
insert into public.players (id, user_id, group_id, name, nick, magic_token, email, phone)
select ('00000000-0000-0000-0000-00000000e4' || x.n)::uuid, ('00000000-0000-0000-0000-00000000f3' || x.n)::uuid, null,
       x.nm || ' Teste', x.nm, 'lgtest00000000000000000000000e4' || x.n, 'secret-' || x.n || '@mail.test', '+35191000' || x.n
  from (values ('01','Olga'), ('02','Manu'), ('03','Sara'), ('04','Zé'), ('05','Bea'), ('09','Admin')) x(n, nm);

-- ── 1. Grants / RLS matrix ───────────────────────────────
select pg_temp.ok(t || ': anon has NO table privilege',
       not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['league_access_requests','leagues','league_members','league_invites','league_audit_log']) t;
select pg_temp.ok(t || ': authenticated has no INSERT/UPDATE/DELETE',
       not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['league_access_requests','leagues','league_members','league_invites','league_audit_log']) t;
select pg_temp.ok(t || ': service_role full access',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['league_access_requests','leagues','league_members','league_invites','league_audit_log']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT')
   and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd = 'SELECT'))
from unnest(array['league_access_requests','leagues','league_members','league_invites','league_audit_log']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('leagues.view_key is NOT readable by authenticated (column grant)',
       not has_column_privilege('authenticated', 'public.leagues', 'view_key', 'SELECT')
   and has_column_privilege('authenticated', 'public.leagues', 'name', 'SELECT'));

select pg_temp.ok('execute ' || f || ' as ' || r || ' = ' || e, has_function_privilege(r, f, 'EXECUTE') = e)
from (values
  ('public.league_page(text,text)', 'anon', true),
  ('public.league_invite_preview(text)', 'anon', true),
  ('public.create_league(text,jsonb,text)', 'anon', false),
  ('public.create_league(text,jsonb,text)', 'authenticated', true),
  ('public.request_league_access(jsonb)', 'anon', false),
  ('public.review_league_access(uuid,text,text)', 'anon', false),
  ('public.accept_league_invite(text)', 'anon', false),
  ('public.my_leagues()', 'anon', false),
  ('public.league_audit(uuid,text,jsonb,uuid,uuid)', 'authenticated', false),
  ('public.league_person_name(uuid)', 'authenticated', false),
  ('public.league_unique_slug(text)', 'authenticated', false)
) v(f, r, e);

-- ── 2. Pilot gate: request ≠ approval ────────────────────
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('create_league without an approved request → access_not_approved',
  $$select public.create_league('Liga Teste')$$, 'league:access_not_approved');
select pg_temp.setkv('req', public.request_league_access('{"org_name":"Liga Teste","city":"Porto","expected_teams":8}')->>'request_id');
select pg_temp.ok('request_league_access is idempotent while pending',
  (public.request_league_access('{"org_name":"Liga Teste 2"}')->>'request_id') = pg_temp.kv('req')
  and (select count(*) from public.league_access_requests) = 1);
select pg_temp.expect_err('a pending request still does not allow create_league',
  $$select public.create_league('Liga Teste')$$, 'league:access_not_approved');
select pg_temp.expect_err('requester cannot approve their own request (admin only)',
  format($$select public.review_league_access(%L, 'approve')$$, pg_temp.kv('req')), 'league:admin_only');
select pg_temp.as_user('04');
select pg_temp.ok('outsider does not see someone else''s access request',
  not exists (select 1 from public.league_access_requests));
select pg_temp.as_user('09');
select pg_temp.ok('admin approves the request', public.review_league_access(pg_temp.kv('req')::uuid, 'approve')->>'status' = 'approved');
select pg_temp.ok('review is idempotent (already_reviewed)',
  (public.review_league_access(pg_temp.kv('req')::uuid, 'reject')->>'already_reviewed')::boolean);

-- ── 3. create_league ─────────────────────────────────────
select pg_temp.as_user('01');
select pg_temp.setkv('L', public.create_league('Liga Teste', '{"city":"Porto"}', 'ref-1')->>'league_id');
select pg_temp.ok('create_league: caller is the single active owner',
  (select count(*) from public.league_members where league_id = pg_temp.kv('L')::uuid and role = 'owner' and status = 'active'
     and player_id = pg_temp.pl('01')) = 1);
select pg_temp.ok('create_league starts as draft + private',
  exists (select 1 from public.leagues where id = pg_temp.kv('L')::uuid and status = 'draft' and visibility = 'private'));
select pg_temp.ok('create_league is idempotent on client_ref',
  (public.create_league('Liga Teste', '{}', 'ref-1')->>'league_id') = pg_temp.kv('L')
  and (select count(*) from public.leagues) = 1);
select pg_temp.expect_err('an approval is single-use (second league refused)',
  $$select public.create_league('Outra Liga', '{}', 'ref-2')$$, 'league:access_not_approved');
reset role;
select pg_temp.expect_err('DB: one league per approved request (unique access_request_id)',
  format($$insert into public.leagues (slug, name, access_request_id) values ('dup-liga', 'Dup', %L)$$, pg_temp.kv('req')), 'leagues_access_request_key');
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.expect_err('create_league refuses unknown fields',
  $$select public.create_league('Liga X', '{"owner":"me"}')$$, 'league:invalid_field');
select pg_temp.expect_err('direct INSERT into leagues is denied',
  $$insert into public.leagues (slug, name) values ('hack', 'Hack')$$, 'permission denied');
select pg_temp.expect_err('direct UPDATE of league_members is denied',
  $$update public.league_members set role = 'owner'$$, 'permission denied');

-- League B for isolation (admin bypasses the pilot gate).
select pg_temp.as_user('09');
select pg_temp.setkv('B', public.create_league('Liga Bea')->>'league_id');
reset role;
update public.league_members set player_id = pg_temp.pl('05') where league_id = pg_temp.kv('B')::uuid and role = 'owner';
set local role authenticated;

-- ── 4. Visibility: draft / private / key / public ────────
select pg_temp.as_anon();
select pg_temp.ok('anon: a draft league page is null (indistinguishable from not found)',
  public.league_page((select slug from public.leagues where id = pg_temp.kv('L')::uuid)) is null);
select pg_temp.as_user('01');
select pg_temp.ok('owner sees own draft league page with view_key', (public.league_page('liga-teste')->>'view_key') is not null);
select pg_temp.setkv('key', public.league_page('liga-teste')->>'view_key');
select pg_temp.expect_err('manager-only fields: owner cannot set an invalid visibility',
  $$select public.update_league((select id from public.leagues where slug = 'liga-teste'), '{"visibility":"secret"}')$$, 'league:invalid_visibility');
select pg_temp.ok('owner activates the league', public.set_league_status(pg_temp.kv('L')::uuid, 'active')->>'status' = 'active');
select pg_temp.as_anon();
select pg_temp.ok('anon: active PRIVATE league without key → null', public.league_page('liga-teste') is null);
select pg_temp.ok('anon: private league with a wrong key → null', public.league_page('liga-teste', repeat('0', 32)) is null);
select pg_temp.ok('anon: private league with the view_key → payload', public.league_page('liga-teste', pg_temp.kv('key')) ->> 'name' = 'Liga Teste');
select pg_temp.ok('anon payload never exposes view_key / email / phone',
  public.league_page('liga-teste', pg_temp.kv('key'))->>'view_key' is null
  and position('secret-' in public.league_page('liga-teste', pg_temp.kv('key'))::text) = 0
  and position('+35191' in public.league_page('liga-teste', pg_temp.kv('key'))::text) = 0);
select pg_temp.as_user('04');
select pg_temp.ok('outsider: private league row not readable through the table', not exists (select 1 from public.leagues where slug = 'liga-teste'));
select pg_temp.as_user('01');
select pg_temp.ok('owner makes it public', public.update_league(pg_temp.kv('L')::uuid, '{"visibility":"public"}') ? 'league_id');
select pg_temp.as_user('04');
select pg_temp.ok('outsider: public active league readable through the table', exists (select 1 from public.leagues where slug = 'liga-teste'));
select pg_temp.ok('outsider: still cannot read its members table', not exists (select 1 from public.league_members where league_id = pg_temp.kv('L')::uuid));
select pg_temp.as_anon();
select pg_temp.ok('anon: public league page lists responsáveis by display name only',
  public.league_page('liga-teste')->'responsaveis'->0->>'name' = 'Olga'
  and position('secret-' in public.league_page('liga-teste')::text) = 0);

-- ── 5. Invites carry the role; never owner ───────────────
select pg_temp.as_user('01');
select pg_temp.expect_err('invite with role owner refused', format($$select public.create_league_invite(%L, 'owner')$$, pg_temp.kv('L')), 'league:invalid_role');
select pg_temp.setkv('iM', public.create_league_invite(pg_temp.kv('L')::uuid, 'manager')->>'token');
select pg_temp.as_anon();
select pg_temp.ok('anon preview of the invite: valid, role manager, league name',
  public.league_invite_preview(pg_temp.kv('iM')) @> '{"status":"valid","role":"manager","league":{"name":"Liga Teste"}}');
select pg_temp.ok('preview of a garbage token → not_found', public.league_invite_preview('nope')->>'status' = 'not_found');
select pg_temp.as_user('02');
select pg_temp.ok('Manu accepts → manager', public.accept_league_invite(pg_temp.kv('iM'))->>'role' = 'manager');
select pg_temp.ok('accept is idempotent for the same person', (public.accept_league_invite(pg_temp.kv('iM'))->>'already_member')::boolean);
select pg_temp.as_user('04');
select pg_temp.expect_err('a used invite cannot be reused by someone else', format($$select public.accept_league_invite(%L)$$, pg_temp.kv('iM')), 'league:invite_used');
select pg_temp.as_user('02');
select pg_temp.expect_err('manager cannot invite another manager', format($$select public.create_league_invite(%L, 'manager')$$, pg_temp.kv('L')), 'league:owner_only');
select pg_temp.setkv('iS', public.create_league_invite(pg_temp.kv('L')::uuid, 'scorer')->>'token');
select pg_temp.expect_err('manager cannot change visibility', format($$select public.update_league(%L, '{"visibility":"private"}')$$, pg_temp.kv('L')), 'league:owner_only');
select pg_temp.expect_err('manager cannot activate/archive the league', format($$select public.set_league_status(%L, 'archived')$$, pg_temp.kv('L')), 'league:owner_only');
select pg_temp.ok('manager can edit identity fields', public.update_league(pg_temp.kv('L')::uuid, '{"description":"Liga de sábado"}') ? 'league_id');
select pg_temp.as_user('03');
select pg_temp.ok('Sara accepts → scorer', public.accept_league_invite(pg_temp.kv('iS'))->>'role' = 'scorer');
select pg_temp.ok('my_leagues lists L with role scorer for Sara',
  public.my_leagues()->'items' @> format('[{"league_id":"%s","roles":["scorer"]}]', pg_temp.kv('L'))::jsonb);
select pg_temp.expect_err('scorer cannot create invites', format($$select public.create_league_invite(%L, 'referee')$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.expect_err('scorer cannot remove the manager',
  format($$select public.remove_league_member((select id from public.league_members where league_id = %L and role = 'manager'))$$, pg_temp.kv('L')),
  'league:not_allowed');
reset role;
update public.league_invites set expires_at = now() - interval '1 minute' where token = pg_temp.kv('iS');
insert into public.league_invites (league_id, role, created_by, expires_at, token)
values (pg_temp.kv('L')::uuid, 'referee', pg_temp.pl('01'), now() - interval '1 minute', 'ffffffffffffffffffffffffffffffff');
set local role authenticated;
select pg_temp.as_user('04');
select pg_temp.expect_err('expired invite refused', $$select public.accept_league_invite('ffffffffffffffffffffffffffffffff')$$, 'league:invite_expired');

-- ── 6. Removal + ownership ───────────────────────────────
select pg_temp.as_user('02');
select pg_temp.ok('manager removes the scorer',
  (public.remove_league_member((select id from public.league_members where league_id = pg_temp.kv('L')::uuid and role = 'scorer' and status = 'active'))->>'removed')::boolean);
select pg_temp.as_user('01');
select pg_temp.expect_err('owner cannot remove themselves',
  format($$select public.remove_league_member((select id from public.league_members where league_id = %L and role = 'owner'))$$, pg_temp.kv('L')),
  'league:transfer_ownership_first');
select pg_temp.expect_err('ownership cannot go to a non-manager', format($$select public.transfer_league_ownership(%L, %L)$$, pg_temp.kv('L'), pg_temp.pl('04')),
  'league:new_owner_must_be_manager');
-- (separate statements: uncorrelated sub-selects may run before the RPC in one expression)
select pg_temp.ok('ownership transfer returns the new owner',
  public.transfer_league_ownership(pg_temp.kv('L')::uuid, pg_temp.pl('02'))->>'owner' = pg_temp.pl('02')::text);
select pg_temp.ok('after transfer: one owner (Manu), previous owner demoted to manager',
  (select count(*) from public.league_members where league_id = pg_temp.kv('L')::uuid and role = 'owner' and status = 'active') = 1
  and exists (select 1 from public.league_members where league_id = pg_temp.kv('L')::uuid and player_id = pg_temp.pl('01') and role = 'manager' and status = 'active'));

-- ── 7. Isolation between leagues ─────────────────────────
select pg_temp.as_user('05');
select pg_temp.expect_err('owner of B cannot update league L', format($$select public.update_league(%L, '{"description":"x"}')$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.expect_err('owner of B cannot invite into L', format($$select public.create_league_invite(%L, 'scorer')$$, pg_temp.kv('L')), 'league:not_found');
select pg_temp.ok('owner of B does not read L''s audit log', not exists (select 1 from public.league_audit_log where league_id = pg_temp.kv('L')::uuid));
select pg_temp.ok('owner of B does not read L''s invites', not exists (select 1 from public.league_invites where league_id = pg_temp.kv('L')::uuid));
select pg_temp.ok('owner of B reads B''s audit log', exists (select 1 from public.league_audit_log where league_id = pg_temp.kv('B')::uuid));
select pg_temp.as_user('02');
select pg_temp.ok('owner of L does not see draft private league B', not exists (select 1 from public.leagues where id = pg_temp.kv('B')::uuid)
  and public.league_page('liga-bea') is null);

-- ── 8. Audit trail ───────────────────────────────────────
reset role;
select pg_temp.ok('audit row for ' || a, exists (select 1 from public.league_audit_log where action = a))
from unnest(array['access_requested','access_approved','league_created','league_updated','league_active','invite_created',
                  'member_joined','member_removed','ownership_transferred']) a;

select n, check_name, ok, detail from _lc order by n;
rollback;
