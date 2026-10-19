-- ─────────────────────────────────────────────────────────
-- AI onboarding usage — check for 20261019160000_ai_onboarding_usage.sql
-- Same contract as the other supabase/tests/*_check.sql: transaction +
-- ROLLBACK, one row per check, every row ok = true. Each RPC call is its
-- own statement; its effect is read in a LATER statement (never in the
-- same one — a statement's snapshot can't see its own function's writes).
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
grant execute on all functions in schema pg_temp to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a101', 'oa-01@example.test'),
  ('00000000-0000-0000-0000-00000000a102', 'oa-02@example.test');

-- ── 0. Grants / RLS ──────────────────────────────────────
select pg_temp.ok('anon: no table privilege', not has_table_privilege('anon', 'public.ai_onboarding_usage', 'SELECT,INSERT,UPDATE,DELETE'));
select pg_temp.ok('authenticated: no table privilege', not has_table_privilege('authenticated', 'public.ai_onboarding_usage', 'SELECT,INSERT,UPDATE,DELETE'));
select pg_temp.ok('service_role: full table access',
  has_table_privilege('service_role', 'public.ai_onboarding_usage', 'SELECT') and has_table_privilege('service_role', 'public.ai_onboarding_usage', 'INSERT')
  and has_table_privilege('service_role', 'public.ai_onboarding_usage', 'UPDATE') and has_table_privilege('service_role', 'public.ai_onboarding_usage', 'DELETE'));
select pg_temp.ok('RLS enabled, no policies',
  (select relrowsecurity from pg_class where oid = 'public.ai_onboarding_usage'::regclass)
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_onboarding_usage'));
select pg_temp.ok('anon cannot execute ' || f, not has_function_privilege('anon', f, 'EXECUTE'))
from unnest(array['public.ai_onboarding_bump(uuid,int)', 'public.ai_onboarding_add_cost(uuid,bigint)']) f;
select pg_temp.ok('authenticated cannot execute ' || f, not has_function_privilege('authenticated', f, 'EXECUTE'))
from unnest(array['public.ai_onboarding_bump(uuid,int)', 'public.ai_onboarding_add_cost(uuid,bigint)']) f;
select pg_temp.ok('service_role can execute ' || f, has_function_privilege('service_role', f, 'EXECUTE'))
from unnest(array['public.ai_onboarding_bump(uuid,int)', 'public.ai_onboarding_add_cost(uuid,bigint)']) f;

-- ── 1. authenticated really is blocked ───────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select pg_temp.expect_err('authenticated cannot bump', 'select public.ai_onboarding_bump(''00000000-0000-0000-0000-00000000a101'', 15)', 'permission denied');
select pg_temp.expect_err('authenticated cannot read usage', 'select * from public.ai_onboarding_usage', 'permission denied');
reset role;

-- ── 2. service_role: counting + limit ────────────────────
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into _f_kv values ('b1', (select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a101', 3))::text);
insert into _f_kv values ('b2', (select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a101', 3))::text);
insert into _f_kv values ('b3', (select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a101', 3))::text);
insert into _f_kv values ('b4', coalesce((select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a101', 3))::text, 'null'));
insert into _f_kv values ('o1', (select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a102', 3))::text);
insert into _f_kv values ('z0', coalesce((select public.ai_onboarding_bump('00000000-0000-0000-0000-00000000a102', 0))::text, 'null'));
select public.ai_onboarding_add_cost('00000000-0000-0000-0000-00000000a101', 3000);
select public.ai_onboarding_add_cost('00000000-0000-0000-0000-00000000a101', -50);
reset role;

select pg_temp.ok('bump counts 1, 2, 3', pg_temp.kv('b1') = '1' and pg_temp.kv('b2') = '2' and pg_temp.kv('b3') = '3',
  pg_temp.kv('b1') || ',' || pg_temp.kv('b2') || ',' || pg_temp.kv('b3'));
select pg_temp.ok('4th call over the limit returns NULL', pg_temp.kv('b4') = 'null', pg_temp.kv('b4'));
select pg_temp.ok('limit did not increment past 3',
  (select calls from public.ai_onboarding_usage where user_id = '00000000-0000-0000-0000-00000000a101') = 3);
select pg_temp.ok('other user counted separately', pg_temp.kv('o1') = '1');
select pg_temp.ok('limit 0 refuses (NULL) and does not count', pg_temp.kv('z0') = 'null'
  and (select calls from public.ai_onboarding_usage where user_id = '00000000-0000-0000-0000-00000000a102') = 1);
select pg_temp.ok('cost added, negatives ignored',
  (select est_cost_micros from public.ai_onboarding_usage where user_id = '00000000-0000-0000-0000-00000000a101') = 3000);
select pg_temp.ok('day is Lisbon today',
  (select day from public.ai_onboarding_usage where user_id = '00000000-0000-0000-0000-00000000a101') = (now() at time zone 'Europe/Lisbon')::date);

select n, check_name, ok, detail from _f order by n;
rollback;
