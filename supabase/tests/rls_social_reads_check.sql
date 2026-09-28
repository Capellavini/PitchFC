-- ─────────────────────────────────────────────────────────
-- Manual check for migration 57 (rls_social_reads).
--
-- Run in Supabase Dashboard → SQL Editor (paste the whole file, Run),
-- AFTER applying the migration. Everything runs inside a transaction that
-- ROLLS BACK: the fixture rows below are never persisted and nothing real
-- is modified.
--
-- How it works: the SQL editor runs as `postgres` (bypasses RLS). Inside
-- the transaction we insert throwaway groups/players/posts, then
-- `set local role authenticated` + fake a JWT for each user and count
-- what they can see. Each count is written to a temp results table
-- together with the expected value; the final SELECT shows one row per
-- check with ok = true/false. Every row must be ok = true.
-- (The editor only displays the last result set, hence the table.)
--
-- Fixture (fixed uuids so the expectations are deterministic):
--   group A : Ana   (user …a001, player …a111) — post f1
--   group B : Bruno (user …b001, player …b111) — post f2 (+1 like, +1 comment by Beto)
--   group B : Beto  (user …c001, player …c111) — post f3, accepted friend of Ana
--   Ana → Bruno friend request is only PENDING (so not a friend)
--   Bruno ↔ Beto accepted
--
-- The fake auth.users rows are needed because players.user_id has an FK
-- to auth.users. They're rolled back with everything else.
-- ─────────────────────────────────────────────────────────

begin;

create temp table _rls_results (n serial, check_name text, got bigint, expected bigint) on commit drop;
grant all on _rls_results to authenticated;
grant usage on sequence _rls_results_n_seq to authenticated;

-- ── Fixture (as postgres, RLS bypassed) ───────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'rls-test-ana@example.test'),
  ('00000000-0000-0000-0000-00000000b001', 'rls-test-bruno@example.test'),
  ('00000000-0000-0000-0000-00000000c001', 'rls-test-beto@example.test');

insert into public.groups (id, name) values
  ('00000000-0000-0000-0000-0000000000a0', 'RLS Test A'),
  ('00000000-0000-0000-0000-0000000000b0', 'RLS Test B');

-- The membership-sync trigger (migration 36) creates the
-- player_group_memberships rows from players.group_id automatically.
insert into public.players (id, user_id, group_id, name, nick) values
  ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a0', 'Ana Teste',   'Ana'),
  ('00000000-0000-0000-0000-00000000b111', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000b0', 'Bruno Teste', 'Bruno'),
  ('00000000-0000-0000-0000-00000000c111', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000b0', 'Beto Teste',  'Beto');

insert into public.posts (id, author_id, body) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000a111', 'post da Ana (grupo A)'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000b111', 'post do Bruno (grupo B)'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000c111', 'post do Beto (grupo B, amigo da Ana)');

insert into public.post_likes (post_id, player_id) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c111');
insert into public.post_comments (post_id, author_id, body) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000c111', 'comentário no post do Bruno');

insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000c111', 'accepted'),  -- Ana ↔ Beto
  ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-00000000b111', 'pending'),   -- Ana → Bruno
  ('00000000-0000-0000-0000-00000000b111', '00000000-0000-0000-0000-00000000c111', 'accepted');  -- Bruno ↔ Beto

-- ── 1. As Ana (group A only) ──────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"rls-test-ana@example.test"}';

insert into _rls_results (check_name, got, expected)
select 'ana: sees own post f1', count(*), 1 from public.posts where id = '00000000-0000-0000-0000-0000000000f1';
insert into _rls_results (check_name, got, expected)
select 'ana: CANNOT see group-B post f2 (Bruno, only pending request)', count(*), 0 from public.posts where id = '00000000-0000-0000-0000-0000000000f2';
insert into _rls_results (check_name, got, expected)
select 'ana: sees friend Beto''s post f3 (other group)', count(*), 1 from public.posts where id = '00000000-0000-0000-0000-0000000000f3';
insert into _rls_results (check_name, got, expected)
select 'ana: CANNOT see likes on f2', count(*), 0 from public.post_likes where post_id = '00000000-0000-0000-0000-0000000000f2';
insert into _rls_results (check_name, got, expected)
select 'ana: CANNOT see comments on f2', count(*), 0 from public.post_comments where post_id = '00000000-0000-0000-0000-0000000000f2';
insert into _rls_results (check_name, got, expected)
select 'ana: sees only her 2 friendships (not Bruno<->Beto)', count(*), 2 from public.friendships
 where '00000000-0000-0000-0000-00000000b111' in (requester_id, addressee_id)
    or '00000000-0000-0000-0000-00000000a111' in (requester_id, addressee_id);
insert into _rls_results (check_name, got, expected)
select 'ana: players still readable (unchanged)', count(*), 3 from public.players
 where id in ('00000000-0000-0000-0000-00000000a111','00000000-0000-0000-0000-00000000b111','00000000-0000-0000-0000-00000000c111');

-- ── 2. As Bruno (group B) ─────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated","email":"rls-test-bruno@example.test"}';

insert into _rls_results (check_name, got, expected)
select 'bruno: CANNOT see group-A post f1', count(*), 0 from public.posts where id = '00000000-0000-0000-0000-0000000000f1';
insert into _rls_results (check_name, got, expected)
select 'bruno: sees f2 + f3 (own + same group)', count(*), 2 from public.posts
 where id in ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3');
insert into _rls_results (check_name, got, expected)
select 'bruno: sees like on own post', count(*), 1 from public.post_likes where post_id = '00000000-0000-0000-0000-0000000000f2';
insert into _rls_results (check_name, got, expected)
select 'bruno: sees comment on own post', count(*), 1 from public.post_comments where post_id = '00000000-0000-0000-0000-0000000000f2';
insert into _rls_results (check_name, got, expected)
select 'bruno: sees pending request from Ana + Bruno<->Beto (not Ana<->Beto)', count(*), 2 from public.friendships
 where '00000000-0000-0000-0000-00000000b111' in (requester_id, addressee_id)
    or '00000000-0000-0000-0000-00000000a111' in (requester_id, addressee_id);

-- ── 3. Multi-group: Ana also becomes a member of group B ──
reset role;
insert into public.player_group_memberships (player_id, group_id, role)
values ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-0000000000b0', 'member');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"rls-test-ana@example.test"}';

insert into _rls_results (check_name, got, expected)
select 'ana (A+B): sees all 3 posts', count(*), 3 from public.posts
 where id in ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3');
insert into _rls_results (check_name, got, expected)
select 'ana (A+B): sees like on f2', count(*), 1 from public.post_likes where post_id = '00000000-0000-0000-0000-0000000000f2';

-- ── 4. A banned membership doesn't count ──────────────────
reset role;
update public.player_group_memberships set banned = true
 where player_id = '00000000-0000-0000-0000-00000000a111' and group_id = '00000000-0000-0000-0000-0000000000b0';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated","email":"rls-test-ana@example.test"}';

insert into _rls_results (check_name, got, expected)
select 'ana (banned from B): CANNOT see f2 again', count(*), 0 from public.posts where id = '00000000-0000-0000-0000-0000000000f2';

-- ── 5. Anonymous (no JWT) sees nothing ────────────────────
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into _rls_results (check_name, got, expected)
select 'anon: sees no test posts', count(*), 0 from public.posts
 where id in ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3');

-- ── Results ───────────────────────────────────────────────
reset role;
select n, check_name, got, expected, (got = expected) as ok from _rls_results order by n;

rollback;

-- ─────────────────────────────────────────────────────────
-- Optional real-data spot check (read-only, also rolled back).
-- Replace <real-user-uuid> with an auth.users id of someone in group A
-- and <group-b-uuid> with an unrelated group. Expect 0, unless that user
-- has an accepted friend in group B or also belongs to a group with
-- some B member (then only those authors' posts).
--
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<real-user-uuid>","role":"authenticated"}';
-- select count(*) from public.posts p
--   join public.player_group_memberships m on m.player_id = p.author_id
--  where m.group_id = '<group-b-uuid>';
-- rollback;
-- ─────────────────────────────────────────────────────────
