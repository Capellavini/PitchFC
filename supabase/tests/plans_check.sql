-- ─────────────────────────────────────────────────────────
-- PITCH plans — check for 20261019100000_plan_entitlements.sql
-- (group_plans / player_plans, group_entitlement, admin_set_group_plan,
-- admin_group_plans, 14-day trial trigger, launch backfill).
-- Same contract as the other supabase/tests/*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true.
--
-- Section R reads REAL data (run it in the SQL editor right after CI
-- applied the migration): it lists which groups the founder_forever
-- patterns matched — `detail` shows "<id> <name>" so the owner can confirm.
-- Exactly one match per pattern is expected; zero or several ⇒ ok = false
-- (fix with admin_set_group_plan, then re-run).
--
-- Fixture: 01 organizer of a NEW group · 02 member · 03 outsider ·
--          04 banned member · 09 admin
-- ─────────────────────────────────────────────────────────
begin;

create temp table _f (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _f_kv (k text primary key, v text) on commit drop;
grant all on _f, _f_kv to authenticated, anon, service_role;
grant usage on sequence _f_n_seq to authenticated, anon, service_role;
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
create function pg_temp.as_user(p_nn text) returns void language sql as $$
  select set_config('request.jwt.claims',
    format('{"sub":"00000000-0000-0000-0000-00000000c1%s","role":"authenticated","email":"%s"}', p_nn,
           case when p_nn = '09' then 'capella.vinicius@gmail.com' else 'plan-' || p_nn || '@example.test' end), true); $$;
create function pg_temp.pl(p_nn text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-00000000c2' || p_nn)::uuid; $$;
grant execute on all functions in schema pg_temp to public;

-- ── 0. Grants / RLS / trigger ────────────────────────────
select pg_temp.ok(t || ': anon has NO table privilege', not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))
from unnest(array['group_plans','player_plans']) t;
select pg_temp.ok(t || ': authenticated can SELECT but not write',
       has_table_privilege('authenticated', 'public.' || t, 'SELECT') and not has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE'))
from unnest(array['group_plans','player_plans']) t;
select pg_temp.ok(t || ': service_role full access',
       has_table_privilege('service_role', 'public.' || t, 'SELECT') and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE') and has_table_privilege('service_role', 'public.' || t, 'DELETE'))
from unnest(array['group_plans','player_plans']) t;
select pg_temp.ok(t || ': RLS on, only SELECT policies',
       c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd <> 'SELECT'))
from unnest(array['group_plans','player_plans']) t
join pg_class c on c.oid = ('public.' || t)::regclass;
select pg_temp.ok('execute ' || f || ' as anon = false', not has_function_privilege('anon', f, 'EXECUTE'))
from unnest(array['public.group_entitlement(uuid)', 'public.admin_set_group_plan(uuid,text,timestamptz,text)',
                  'public.admin_group_plans()', 'public.is_group_member(uuid)']) f;
select pg_temp.ok('trial trigger installed on groups',
  exists (select 1 from pg_trigger where tgname = 'trg_grant_group_trial' and tgrelid = 'public.groups'::regclass and not tgisinternal));

-- ── R. Real data (launch backfill) ───────────────────────
select pg_temp.ok('R founder_forever "Goodweather": exactly 1 group matched',
  count(*) = 1, coalesce(string_agg(g.id || ' ' || g.name, ' | '), 'NO MATCH'))
from public.group_plans gp join public.groups g on g.id = gp.group_id
where gp.source = 'founder_forever' and (g.name ilike 'goodweather%' or g.name ilike 'good weather%');
select pg_temp.ok('R founder_forever "Fut TJ 11x11": exactly 1 group matched',
  count(*) = 1, coalesce(string_agg(g.id || ' ' || g.name, ' | '), 'NO MATCH'))
from public.group_plans gp join public.groups g on g.id = gp.group_id
where gp.source = 'founder_forever' and g.name ~* '(\mtj\M|fut\s*tj)' and g.name ~* '(11\s*[xv]\s*11|onze\s*x\s*onze)';
select pg_temp.ok('R founder_forever rows: Club + AI, no end date',
  bool_and(plan = 'club_ai' and ends_at is null and status = 'active'), count(*) || ' row(s)')
from public.group_plans where source = 'founder_forever';
select pg_temp.ok('R every existing group has a plan row',
  count(*) = 0, coalesce(string_agg(g.id || ' ' || g.name, ' | '), 'all covered'))
from public.groups g where not exists (select 1 from public.group_plans gp where gp.group_id = g.id);
select pg_temp.ok('R Fundadores: Club + AI until 2026-12-31 23:59 Lisbon',
  coalesce(bool_and(plan = 'club_ai' and ends_at = timestamptz '2026-12-31 23:59:00+00'), true), count(*) || ' founder row(s)')
from public.group_plans where source = 'founder';

-- ── Fixture ──────────────────────────────────────────────
insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000c1' || n)::uuid, 'plan-' || n || '@example.test'
  from unnest(array['01','02','03','04','09']) n;
with g as (insert into public.groups (name) values ('Plano Teste Novo') returning id)
insert into _f_kv (k, v) select 'N', id::text from g;
with g as (insert into public.groups (name) values ('Plano Teste Outro') returning id)
insert into _f_kv (k, v) select 'O', id::text from g;
insert into public.players (id, user_id, group_id, name, nick, is_organizer, position)
select pg_temp.pl(x.n), ('00000000-0000-0000-0000-00000000c1' || x.n)::uuid,
       case when x.n in ('01','02') then pg_temp.k('N') when x.n = '03' then pg_temp.k('O') else null end,
       x.nm || ' Teste', x.nm, x.n = '01', 'Médio'
  from (values ('01','Olga'),('02','Bruno'),('03','Carla'),('04','Duarte'),('09','Admin')) x(n, nm);
-- 04 was a member of N but got banned.
insert into public.player_group_memberships (player_id, group_id, role, banned) values (pg_temp.pl('04'), pg_temp.k('N'), 'member', true);
insert into public.player_plans (player_id, plan, status, source, note) values (pg_temp.pl('02'), 'player_plus', 'active', 'manual', 'teste');

-- ── 1. New group → 14-day Club trial (trigger) ───────────
select pg_temp.ok('new group gets club / trialing / trial',
  exists (select 1 from public.group_plans where group_id = pg_temp.k('N') and plan = 'club' and status = 'trialing' and source = 'trial'));
select pg_temp.ok('trial ends 14 days after creation',
  (select abs(extract(epoch from (ends_at - (now() + interval '14 days')))) < 60 from public.group_plans where group_id = pg_temp.k('N')));

-- ── 2. Member reads ──────────────────────────────────────
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.ok('organizer: entitlement = club trialing, 14 days left',
  (select e->>'plan' = 'club' and e->>'status' = 'trialing' and (e->>'days_left')::int = 14 and not (e->>'expired')::boolean
   from (select public.group_entitlement(pg_temp.k('N')) e) x));
select pg_temp.as_user('02');
select pg_temp.ok('member reads the group''s plan row', (select count(*) = 1 from public.group_plans where group_id = pg_temp.k('N')));
select pg_temp.ok('member reads only their own groups'' rows', not exists (select 1 from public.group_plans where group_id = pg_temp.k('O')));
select pg_temp.ok('member reads their own player_plans row', (select count(*) = 1 from public.player_plans));
select pg_temp.expect_err('member cannot write group_plans directly',
  format($$update public.group_plans set plan = 'club_ai' where group_id = %L$$, pg_temp.kv('N')), 'permission denied');
select pg_temp.expect_err('member cannot insert group_plans directly',
  format($$insert into public.group_plans (group_id, plan, source) values (%L, 'club_ai', 'manual')$$, pg_temp.kv('O')), 'permission denied');
select pg_temp.expect_err('member cannot call admin_set_group_plan',
  format($$select public.admin_set_group_plan(%L, 'club_ai', null, 'hack')$$, pg_temp.kv('N')), 'plans:admin_only');
select pg_temp.expect_err('member cannot list admin_group_plans', $$select * from public.admin_group_plans()$$, 'plans:admin_only');

-- ── 3. Outsiders / banned ────────────────────────────────
select pg_temp.as_user('03');
select pg_temp.expect_err('outsider cannot read another group''s entitlement',
  format($$select public.group_entitlement(%L)$$, pg_temp.kv('N')), 'plans:forbidden');
select pg_temp.ok('outsider sees no row of that group', not exists (select 1 from public.group_plans where group_id = pg_temp.k('N')));
select pg_temp.ok('outsider sees nobody else''s player_plans', not exists (select 1 from public.player_plans));
select pg_temp.as_user('04');
select pg_temp.expect_err('banned member cannot read the entitlement',
  format($$select public.group_entitlement(%L)$$, pg_temp.kv('N')), 'plans:forbidden');

-- ── 4. Expiry rules ──────────────────────────────────────
reset role;
update public.group_plans set ends_at = now() - interval '1 hour' where group_id = pg_temp.k('N');
set local role authenticated;
select pg_temp.as_user('01');
select pg_temp.ok('expired trial ⇒ free (status expired, stored plan kept)',
  (select e->>'plan' = 'free' and e->>'status' = 'expired' and (e->>'expired')::boolean and e->>'stored_plan' = 'club' and e->'days_left' = 'null'::jsonb
   from (select public.group_entitlement(pg_temp.k('N')) e) x));
reset role;
update public.group_plans set plan = 'club_ai', status = 'active', source = 'founder', ends_at = now() + interval '30 days' where group_id = pg_temp.k('N');
set local role authenticated;
select pg_temp.ok('active founder ⇒ club_ai with days left',
  (select e->>'plan' = 'club_ai' and (e->>'days_left')::int = 30 from (select public.group_entitlement(pg_temp.k('N')) e) x));
reset role;
update public.group_plans set status = 'canceled' where group_id = pg_temp.k('N');
set local role authenticated;
select pg_temp.ok('canceled ⇒ free', (select public.group_entitlement(pg_temp.k('N'))->>'plan' = 'free'));
reset role;
update public.group_plans set status = 'past_due', ends_at = null where group_id = pg_temp.k('N');
set local role authenticated;
select pg_temp.ok('past_due keeps the plan (billing grace)', (select public.group_entitlement(pg_temp.k('N'))->>'plan' = 'club_ai'));
reset role;
delete from public.group_plans where group_id = pg_temp.k('N');
set local role authenticated;
select pg_temp.ok('no row ⇒ free', (select public.group_entitlement(pg_temp.k('N'))->>'plan' = 'free'));

-- ── 5. Admin ─────────────────────────────────────────────
select pg_temp.as_user('09');
select pg_temp.ok('admin sets Club + AI forever',
  (select e->>'plan' = 'club_ai' and e->>'source' = 'manual' and e->>'status' = 'active' and e->'ends_at' = 'null'::jsonb
   from (select public.admin_set_group_plan(pg_temp.k('N'), 'club_ai', null, 'oferta') e) x));
select pg_temp.ok('admin extends Club to a date',
  (select e->>'plan' = 'club' and (e->>'days_left')::int = 60
   from (select public.admin_set_group_plan(pg_temp.k('N'), 'club', now() + interval '60 days', null) e) x));
select pg_temp.ok('admin note kept when not re-sent', (select note = 'oferta' from public.group_plans where group_id = pg_temp.k('N')));
select pg_temp.ok('granted_by = the admin', (select granted_by = '00000000-0000-0000-0000-00000000c109'::uuid from public.group_plans where group_id = pg_temp.k('N')));
select pg_temp.expect_err('invalid plan refused', format($$select public.admin_set_group_plan(%L, 'gold', null, null)$$, pg_temp.kv('N')), 'plans:invalid_plan');
select pg_temp.expect_err('end date in the past refused', format($$select public.admin_set_group_plan(%L, 'club', now() - interval '1 day', null)$$, pg_temp.kv('N')), 'plans:ends_in_past');
select pg_temp.expect_err('unknown group refused', $$select public.admin_set_group_plan(gen_random_uuid(), 'club', null, null)$$, 'plans:group_not_found');
select pg_temp.ok('admin_group_plans lists the group with its effective plan',
  exists (select 1 from public.admin_group_plans() a where a.group_id = pg_temp.k('N') and a.effective_plan = 'club' and a.players = 2));
select pg_temp.ok('admin_group_plans covers every group', (select count(*) from public.admin_group_plans()) = (select count(*) from public.groups));
select pg_temp.ok('admin reads any group''s entitlement', (select public.group_entitlement(pg_temp.k('O'))->>'plan' = 'club'));
select pg_temp.ok('admin downgrade to free', (select public.admin_set_group_plan(pg_temp.k('O'), 'free', now() + interval '9 days', null)->>'plan' = 'free'));
select pg_temp.ok('a free row never carries an end date', (select ends_at is null from public.group_plans where group_id = pg_temp.k('O')));

-- ── 6. service_role (wa-bot) ─────────────────────────────
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.ok('service_role reads any entitlement', (select public.group_entitlement(pg_temp.k('N'))->>'plan' = 'club'));
select pg_temp.ok('service_role reads group_plans directly', (select count(*) >= 2 from public.group_plans));

reset role;
select n, check_name, ok, detail from _f order by n;
rollback;
