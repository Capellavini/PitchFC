-- ─────────────────────────────────────────────────────────
-- Manual check for the Treinador Adjunto migrations
-- (20260101006300_adjunto_core, 006400_adjunto_rpcs, 006500_attendance_log).
--
-- Run in Supabase Dashboard → SQL Editor (paste the whole file, Run),
-- AFTER the migrations are applied. Everything runs inside a transaction
-- that ROLLS BACK: the fixture rows are never persisted, nothing real is
-- modified, no real group gets adjunto_enabled.
--
-- Same technique as rls_social_reads_check.sql: insert throwaway fixtures
-- as postgres, then `set local role authenticated` + a fake JWT to call the
-- app RPCs as a given user. Results go to a temp table; the final SELECT
-- shows one row per check — every row must be ok = true.
--
-- Fixture (fixed uuids):
--   group E "Adj Test Enabled"  (adjunto_enabled = true)
--     Olga  organizer  user …a001  phone '+351912345678'   (E.164)
--     Lia   assistant  user …a002  phone '913 333 444'     (legacy, no country code)
--     Mario member     user …a003  phone '+351915555666'
--     Bia   organizer  (no user)   phone '+5511987654321'  (BR E.164)
--     Beto  organizer, BANNED      phone '+351916666777'
--   group D "Adj Test Disabled" (adjunto_enabled = false)
--     Dora  organizer  user …a004  phone '+351914444555'
--   game G in group E (open, kickoff in 2 days)
-- ─────────────────────────────────────────────────────────

begin;

create temp table _adj_results (n serial, check_name text, ok boolean, detail text) on commit drop;
create temp table _adj_codes (n serial, code text) on commit drop;
grant all on _adj_results, _adj_codes to authenticated;
grant usage on sequence _adj_results_n_seq, _adj_codes_n_seq to authenticated;

-- ── Fixture (as postgres) ─────────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'adj-test-olga@example.test'),
  ('00000000-0000-0000-0000-00000000a002', 'adj-test-lia@example.test'),
  ('00000000-0000-0000-0000-00000000a003', 'adj-test-mario@example.test'),
  ('00000000-0000-0000-0000-00000000a004', 'adj-test-dora@example.test');

insert into public.groups (id, name, adjunto_enabled) values
  ('00000000-0000-0000-0000-0000000000e0', 'Adj Test Enabled',  true),
  ('00000000-0000-0000-0000-0000000000d0', 'Adj Test Disabled', false);

-- The membership-sync trigger (migrations 36/47) creates the
-- player_group_memberships rows (role from is_organizer/is_assistant).
insert into public.players (id, user_id, group_id, name, nick, phone, is_organizer, is_assistant) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000e0', 'Olga Teste',  'Olga',  '+351912345678',  true,  false),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000e0', 'Lia Teste',   'Lia',   '913 333 444',    false, true),
  ('00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-0000000000e0', 'Mario Teste', 'Mario', '+351915555666',  false, false),
  ('00000000-0000-0000-0000-00000000b004', '00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-0000000000d0', 'Dora Teste',  'Dora',  '+351914444555',  true,  false),
  ('00000000-0000-0000-0000-00000000b005', null,                                   '00000000-0000-0000-0000-0000000000e0', 'Bia Teste',   'Bia',   '+5511987654321', true,  false),
  ('00000000-0000-0000-0000-00000000b006', null,                                   '00000000-0000-0000-0000-0000000000e0', 'Beto Teste',  'Beto',  '+351916666777',  true,  false);
update public.player_group_memberships set banned = true
  where player_id = '00000000-0000-0000-0000-00000000b006';

insert into public.games (id, group_id, scheduled_at, status, spots, cycle_opened_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e0',
   now() + interval '2 days', 'open', 10, now() - interval '1 day');

-- ── 1. Grants (Data API) ──────────────────────────────────
insert into _adj_results (check_name, ok, detail)
select t || ': service_role has select/insert/update/delete',
       has_table_privilege('service_role', 'public.' || t, 'SELECT')
   and has_table_privilege('service_role', 'public.' || t, 'INSERT')
   and has_table_privilege('service_role', 'public.' || t, 'UPDATE')
   and has_table_privilege('service_role', 'public.' || t, 'DELETE'), null
from unnest(array['adjunto_link_codes','adjunto_links','adjunto_threads','adjunto_messages',
                  'adjunto_proposals','adjunto_usage','adjunto_dm_replies','attendance_log']) t;

insert into _adj_results (check_name, ok, detail)
select t || ': anon + authenticated have NO table privilege',
       not has_table_privilege('anon',          'public.' || t, 'SELECT,INSERT,UPDATE,DELETE')
   and not has_table_privilege('authenticated', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'), null
from unnest(array['adjunto_link_codes','adjunto_links','adjunto_threads','adjunto_messages',
                  'adjunto_proposals','adjunto_usage','adjunto_dm_replies','attendance_log']) t;

insert into _adj_results (check_name, ok, detail)
select t || ': RLS enabled, no policies',
       c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t), null
from unnest(array['adjunto_link_codes','adjunto_links','adjunto_threads','adjunto_messages',
                  'adjunto_proposals','adjunto_usage','adjunto_dm_replies','attendance_log']) t
join pg_class c on c.oid = ('public.' || t)::regclass;

-- Function EXECUTE: (signature, role, expected)
insert into _adj_results (check_name, ok, detail)
select 'execute ' || f || ' as ' || r || ' = ' || e,
       has_function_privilege(r, f, 'EXECUTE') = e, null
from (values
  ('public.adjunto_create_link_code(uuid)', 'anon',          false),
  ('public.adjunto_create_link_code(uuid)', 'authenticated', true),
  ('public.adjunto_status(uuid)',           'anon',          false),
  ('public.adjunto_status(uuid)',           'authenticated', true),
  ('public.adjunto_unlink()',               'anon',          false),
  ('public.adjunto_unlink()',               'authenticated', true),
  ('public.adjunto_apply_teams(uuid,jsonb,text,uuid,boolean)', 'authenticated', false),
  ('public.adjunto_apply_teams(uuid,jsonb,text,uuid,boolean)', 'anon',          false),
  ('public.adjunto_apply_teams(uuid,jsonb,text,uuid,boolean)', 'service_role',  true),
  ('public.adjunto_teams_md5(uuid)',        'authenticated', false),
  ('public.adjunto_teams_md5(uuid)',        'service_role',  true),
  ('public.adjunto_find_organizer_by_phone(text)', 'authenticated', false),
  ('public.adjunto_find_organizer_by_phone(text)', 'anon',          false),
  ('public.adjunto_find_organizer_by_phone(text)', 'service_role',  true),
  ('public.adjunto_gen_code()',             'authenticated', false),
  ('public.purge_old_adjunto_data()',       'authenticated', false),
  ('public.purge_old_attendance_log()',     'authenticated', false)
) v(f, r, e);

-- ── 2. Schema guards ──────────────────────────────────────
do $$ begin
  update public.groups set game_format = '[]'::jsonb where id = '00000000-0000-0000-0000-0000000000e0';
  insert into _adj_results (check_name, ok, detail) values ('game_format rejects a non-object', false, 'update succeeded');
exception when check_violation then
  insert into _adj_results (check_name, ok, detail) values ('game_format rejects a non-object', true, null);
end $$;
do $$ begin
  update public.groups set game_format = '{"v":1}'::jsonb where id = '00000000-0000-0000-0000-0000000000e0';
  insert into _adj_results (check_name, ok, detail) values ('game_format rejects an object without "type"', false, 'update succeeded');
exception when check_violation then
  insert into _adj_results (check_name, ok, detail) values ('game_format rejects an object without "type"', true, null);
end $$;
update public.groups set game_format = '{"v":1,"type":"avulso"}'::jsonb where id = '00000000-0000-0000-0000-0000000000e0';
insert into _adj_results (check_name, ok, detail)
select 'game_format accepts {v,type}', game_format ->> 'type' = 'avulso', null
from public.groups where id = '00000000-0000-0000-0000-0000000000e0';

do $$ begin
  insert into public.bot_message_log (kind, answer) values ('adjunto_out', 'x');
  insert into _adj_results (check_name, ok, detail) values ('bot_message_log accepts adjunto_out', true, null);
  insert into public.bot_message_log (kind, answer) values ('answer', 'x');
  insert into _adj_results (check_name, ok, detail) values ('bot_message_log still accepts answer', true, null);
exception when check_violation then
  insert into _adj_results (check_name, ok, detail) values ('bot_message_log kinds', false, sqlerrm);
end $$;

-- ── 3. adjunto_create_link_code / status / unlink as users ──
-- 3a. Mario (member, not organizer) → not_group_manager
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated","email":"adj-test-mario@example.test"}';
do $$ begin
  perform public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000e0');
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: member is refused', false, 'returned a code');
exception when others then
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: member is refused', sqlerrm = 'not_group_manager', sqlerrm);
end $$;

-- 3b. Dora (organizer of a group WITHOUT the flag) → adjunto_not_enabled
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a004","role":"authenticated","email":"adj-test-dora@example.test"}';
do $$ begin
  perform public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000d0');
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: organizer of non-enabled group is refused', false, 'returned a code');
exception when others then
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: organizer of non-enabled group is refused', sqlerrm = 'adjunto_not_enabled', sqlerrm);
end $$;
-- …and Dora can't create one for group E either (not her group)
do $$ begin
  perform public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000e0');
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: organizer of ANOTHER group is refused', false, 'returned a code');
exception when others then
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: organizer of ANOTHER group is refused', sqlerrm = 'not_group_manager', sqlerrm);
end $$;

-- 3c. Olga (organizer of enabled group): 5 codes OK, the 6th is rate-limited
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"adj-test-olga@example.test"}';
do $$
declare c text; i int;
begin
  for i in 1..5 loop
    c := public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000e0');
    insert into _adj_codes (code) values (c);
  end loop;
  insert into _adj_results (check_name, ok, detail)
  values ('create_link_code: organizer gets ADJ-XXXXXX codes',
          (select bool_and(code ~ '^ADJ-[A-HJ-NP-Z2-9]{6}$') and count(distinct code) = 5 from _adj_codes),
          (select string_agg(code, ',') from _adj_codes));
  begin
    perform public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000e0');
    insert into _adj_results (check_name, ok, detail) values ('create_link_code: 6th code in 1h is rate-limited', false, 'returned a code');
  exception when others then
    insert into _adj_results (check_name, ok, detail) values ('create_link_code: 6th code in 1h is rate-limited', sqlerrm = 'rate_limited', sqlerrm);
  end;
end $$;

-- 3d. Lia (assistant, legacy phone) can also create a code
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated","email":"adj-test-lia@example.test"}';
do $$ begin
  perform public.adjunto_create_link_code('00000000-0000-0000-0000-0000000000e0');
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: assistant is allowed', true, null);
exception when others then
  insert into _adj_results (check_name, ok, detail) values ('create_link_code: assistant is allowed', false, sqlerrm);
end $$;

-- 3e. status before link (as Olga)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"adj-test-olga@example.test"}';
insert into _adj_results (check_name, ok, detail)
select 'status: not linked yet, enabled, format_set',
       (s ->> 'linked')::boolean = false and (s ->> 'enabled')::boolean and (s ->> 'format_set')::boolean, s::text
from (select public.adjunto_status('00000000-0000-0000-0000-0000000000e0') s) x;

-- Olga's older codes were expired by each newer one (checked as postgres)
reset role;
insert into _adj_results (check_name, ok, detail)
select 'create_link_code: older unused codes are expired, newest still valid',
       count(*) filter (where c.expires_at > now()) = 1
   and (select k.expires_at > now() from public.adjunto_link_codes k
        where k.code = (select code from _adj_codes order by n desc limit 1)),
       count(*) || ' codes'
from public.adjunto_link_codes c
where c.player_id = '00000000-0000-0000-0000-00000000b001';
-- NOTE: inside one transaction now() is constant, so "expired" = expires_at <= now().

-- link Olga by hand (what the bot does on activation), then status + unlink as Olga
insert into public.adjunto_links (player_id, wa_jid, wa_pn, active_group_id)
values ('00000000-0000-0000-0000-00000000b001', '351912345678@s.whatsapp.net', '351912345678',
        '00000000-0000-0000-0000-0000000000e0');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"adj-test-olga@example.test"}';
insert into _adj_results (check_name, ok, detail)
select 'status: linked, active_here, masked phone ends in 678',
       (s ->> 'linked')::boolean and (s ->> 'active_here')::boolean and (s ->> 'wa_pn_masked') like '%678'
       and (s ->> 'wa_pn_masked') not like '%912%', s::text
from (select public.adjunto_status('00000000-0000-0000-0000-0000000000e0') s) x;

-- Mario can't read Olga's status for group E (not a manager)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated","email":"adj-test-mario@example.test"}';
do $$ begin
  perform public.adjunto_status('00000000-0000-0000-0000-0000000000e0');
  insert into _adj_results (check_name, ok, detail) values ('status: member is refused', false, 'returned');
exception when others then
  insert into _adj_results (check_name, ok, detail) values ('status: member is refused', sqlerrm = 'not_group_manager', sqlerrm);
end $$;
-- …and Mario can't read the table directly
do $$ begin
  perform 1 from public.adjunto_links;
  insert into _adj_results (check_name, ok, detail) values ('authenticated cannot select adjunto_links', false, 'select worked');
exception when insufficient_privilege then
  insert into _adj_results (check_name, ok, detail) values ('authenticated cannot select adjunto_links', true, null);
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"adj-test-olga@example.test"}';
select public.adjunto_unlink();
reset role;
insert into _adj_results (check_name, ok, detail)
select 'unlink: Olga''s link is gone', count(*) = 0, null
from public.adjunto_links where player_id = '00000000-0000-0000-0000-00000000b001';

-- ── 4. attendance_log trigger ─────────────────────────────
insert into public.attendances (game_id, player_id, status, responded_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000b003', 'confirmed', now()),  -- logged
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000b002', 'pending',   null);   -- placeholder: NOT logged
insert into _adj_results (check_name, ok, detail)
select 'attendance_log: confirm insert logged (with group, cycle, kickoff); pending placeholder not',
       count(*) = 1
   and bool_and(status = 'confirmed' and player_id = '00000000-0000-0000-0000-00000000b003'
                and group_id = '00000000-0000-0000-0000-0000000000e0'
                and cycle_opened_at is not null and kickoff is not null and prev_status is null),
       count(*) || ' rows'
from public.attendance_log where game_id = '00000000-0000-0000-0000-0000000000c1';

update public.attendances set status = 'declined', responded_at = now()
  where game_id = '00000000-0000-0000-0000-0000000000c1' and player_id = '00000000-0000-0000-0000-00000000b003';
update public.attendances set paid = true   -- non-status update: NOT logged
  where game_id = '00000000-0000-0000-0000-0000000000c1' and player_id = '00000000-0000-0000-0000-00000000b003';
insert into _adj_results (check_name, ok, detail)
select 'attendance_log: status change logged with prev_status; paid-only update not',
       count(*) = 2 and bool_or(status = 'declined' and prev_status = 'confirmed'),
       count(*) || ' rows'
from public.attendance_log where game_id = '00000000-0000-0000-0000-0000000000c1';

-- the weekly reset's exact write (reset_recurring_confirmations)
update public.attendances set status = 'pending', paid = false, paid_at = null, responded_at = null
  where game_id = '00000000-0000-0000-0000-0000000000c1';
insert into _adj_results (check_name, ok, detail)
select 'attendance_log: weekly reset is NOT logged', count(*) = 2, count(*) || ' rows'
from public.attendance_log where game_id = '00000000-0000-0000-0000-0000000000c1';

-- ── 5. adjunto_apply_teams compare-and-set (as postgres = service path) ──
do $$
declare
  g  uuid := '00000000-0000-0000-0000-0000000000c1';
  m0 text := public.adjunto_teams_md5('00000000-0000-0000-0000-0000000000c1');
  t1 jsonb := '[{"id":1,"name":"Coletes","players":[11,12]},{"id":2,"name":"Sem coletes","players":[13,14]}]';
  t2 jsonb := '[{"id":1,"name":"Coletes","players":[11,13]},{"id":2,"name":"Sem coletes","players":[12,14]}]';
  r  jsonb; m1 text;
begin
  insert into _adj_results (check_name, ok, detail)
  values ('teams_md5 of NULL teams = md5(''null'')', m0 = md5('null'), m0);

  r := public.adjunto_apply_teams(g, t1, m0, '00000000-0000-0000-0000-00000000b001', false);
  m1 := r ->> 'md5';
  insert into _adj_results (check_name, ok, detail)
  values ('apply_teams: CAS with current md5 → ok=true (draft)',
          (r ->> 'ok')::boolean and m1 = public.adjunto_teams_md5(g)
          and (select teams = t1 and not teams_confirmed and teams_set_by = '00000000-0000-0000-0000-00000000b001'
                 from public.games where id = g), r::text);

  r := public.adjunto_apply_teams(g, t2, m0, '00000000-0000-0000-0000-00000000b001', false);
  insert into _adj_results (check_name, ok, detail)
  values ('apply_teams: CAS with stale md5 → ok=false teams_changed, game untouched',
          not (r ->> 'ok')::boolean and r ->> 'reason' = 'teams_changed'
          and (select teams = t1 from public.games where id = g), r::text);

  r := public.adjunto_apply_teams(g, t1, m1, '00000000-0000-0000-0000-00000000b003', true);
  insert into _adj_results (check_name, ok, detail)
  values ('apply_teams: non-manager actor → ok=false actor_not_manager',
          not (r ->> 'ok')::boolean and r ->> 'reason' = 'actor_not_manager', r::text);

  -- Lia (assistant) approves Olga's unchanged draft: confirmed_by = Lia, set_by stays Olga
  r := public.adjunto_apply_teams(g, t1, m1, '00000000-0000-0000-0000-00000000b002', true);
  insert into _adj_results (check_name, ok, detail)
  values ('apply_teams: assistant approves → confirmed, confirmed_by=assistant, set_by kept',
          (r ->> 'ok')::boolean
          and (select teams_confirmed and teams_confirmed_by = '00000000-0000-0000-0000-00000000b002'
                      and teams_set_by = '00000000-0000-0000-0000-00000000b001'
                 from public.games where id = g), r::text);

  update public.games set live_matchday = '{"matches":[]}'::jsonb where id = g;
  r := public.adjunto_apply_teams(g, t2, public.adjunto_teams_md5(g), '00000000-0000-0000-0000-00000000b001', false);
  insert into _adj_results (check_name, ok, detail)
  values ('apply_teams: refuses while live_matchday is set (game_locked)',
          not (r ->> 'ok')::boolean and r ->> 'reason' = 'game_locked', r::text);
  update public.games set live_matchday = null where id = g;
end $$;

-- ── 6. adjunto_find_organizer_by_phone (decision 11) ──────
insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: E.164 organizer (Olga) → 1 row, group E, organizer',
       count(*) = 1 and bool_and(player_id = '00000000-0000-0000-0000-00000000b001' and role = 'organizer'
                                 and group_name = 'Adj Test Enabled'), count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('351912345678');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: leading + accepted', count(*) = 1, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('+351912345678');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: legacy 9-digit stored phone (Lia, assistant) → 1 row',
       count(*) = 1 and bool_and(player_id = '00000000-0000-0000-0000-00000000b002' and role = 'assistant'),
       count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('351913333444');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: BR E.164 exact (Bia) → 1 row', count(*) = 1, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('5511987654321');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: BR same last-9, different DDD → 0 rows (no tail match between two E.164)', count(*) = 0, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('5521987654321');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: plain member (Mario) → 0 rows', count(*) = 0, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('351915555666');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: organizer of non-enabled group (Dora) → 0 rows', count(*) = 0, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('351914444555');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: banned organizer (Beto) → 0 rows', count(*) = 0, count(*) || ' rows'
from public.adjunto_find_organizer_by_phone('351916666777');

insert into _adj_results (check_name, ok, detail)
select 'find_by_phone: junk / empty input → 0 rows', count(*) = 0, count(*) || ' rows'
from (select * from public.adjunto_find_organizer_by_phone('')
      union all select * from public.adjunto_find_organizer_by_phone(null)
      union all select * from public.adjunto_find_organizer_by_phone('12345')) x;

-- phonesMatch parity spot-checks (same cases as wa-bot roster tests' spirit)
insert into _adj_results (check_name, ok, detail)
select 'phones_match: ' || a || ' vs ' || coalesce(b, 'null') || ' = ' || e,
       public.adjunto_phones_match(a, b) = e, null
from (values
  ('+351912345678', '+351 912 345 678', true),
  ('+351912345678', '912345678',        true),
  ('00351912345678','351912345678',     true),
  ('+5511987654321','+5521987654321',   false),
  ('+5511987654321','11987654321',      true),
  ('+447911123456', '07911123456',      true),
  ('+351912345678', '1234567',          false),
  ('+351912345678', null,               false)
) v(a, b, e);

-- ── Results ───────────────────────────────────────────────
select n, check_name, ok, detail from _adj_results order by n;

rollback;
