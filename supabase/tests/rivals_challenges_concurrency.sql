-- ─────────────────────────────────────────────────────────
-- MANUAL concurrency check for migration 007100 (PITCH Rivals): two
-- leaders accept / claim the same challenge at the same time → exactly
-- ONE match, the second caller gets the same match (already_agreed) or
-- rivals:challenge_claimed.
--
-- Needs TWO SQL sessions (e.g. two psql windows against the project, or
-- two Supabase SQL Editor tabs — the editor auto-commits each Run, so use
-- psql for steps 2–4). Fixtures are COMMITTED (rv3-*@example.test) and
-- removed by step 5. Run on a staging project if you have one.
-- ─────────────────────────────────────────────────────────

-- ── Step 1 (session A, as postgres): fixtures ────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f301', 'rv3-ana@example.test'),
  ('00000000-0000-0000-0000-00000000f302', 'rv3-vasco@example.test'),
  ('00000000-0000-0000-0000-00000000f303', 'rv3-bruno@example.test'),
  ('00000000-0000-0000-0000-00000000f304', 'rv3-paulo@example.test');
insert into public.players (id, user_id, name, nick, magic_token) values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-00000000f301', 'Ana Conc',   'Ana',   'rv3conc000000000000000000000e301'),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-00000000f302', 'Vasco Conc', 'Vasco', 'rv3conc000000000000000000000e302'),
  ('00000000-0000-0000-0000-00000000e303', '00000000-0000-0000-0000-00000000f303', 'Bruno Conc', 'Bruno', 'rv3conc000000000000000000000e303'),
  ('00000000-0000-0000-0000-00000000e304', '00000000-0000-0000-0000-00000000f304', 'Paulo Conc', 'Paulo', 'rv3conc000000000000000000000e304');
-- Teams: A (Ana captain, Vasco vice), B (Bruno), C (Paulo). Built directly
-- as postgres (no RPC needed for fixtures).
insert into public.teams (id, name, slug, captain_id, created_by) values
  ('00000000-0000-0000-0000-0000000003a1', 'Conc A', 'conc-a-rv3', '00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-00000000e301'),
  ('00000000-0000-0000-0000-0000000003b1', 'Conc B', 'conc-b-rv3', '00000000-0000-0000-0000-00000000e303', '00000000-0000-0000-0000-00000000e303'),
  ('00000000-0000-0000-0000-0000000003c1', 'Conc C', 'conc-c-rv3', '00000000-0000-0000-0000-00000000e304', '00000000-0000-0000-0000-00000000e304');
insert into public.team_members (team_id, player_id, role, status) values
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-00000000e301', 'captain', 'active'),
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-00000000e302', 'vice',    'active'),
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-00000000e303', 'captain', 'active'),
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000e304', 'captain', 'active');
-- Bruno (B) challenges A directed; Ana and Vasco (both A leaders) will
-- accept concurrently. Plus a claimable from A that B and C race for.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f303","role":"authenticated"}';
select public.create_challenge('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-0000000003a1',
  jsonb_build_object('kickoff_at', now() + interval '3 days', 'venue_name', 'Conc Arena'), 'concurrency-directed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f301","role":"authenticated"}';
select public.create_challenge('00000000-0000-0000-0000-0000000003a1', null,
  jsonb_build_object('kickoff_at', now() + interval '4 days', 'venue_name', 'Conc Arena'), 'concurrency-claimable');
commit;
select id, mode, invite_token from public.team_challenges
 where client_ref in ('concurrency-directed', 'concurrency-claimable');
-- Note the two ids and the claimable's token; replace <DIRECTED_ID>,
-- <CLAIMABLE_ID> and <TOKEN> below.

-- ── Step 2: double accept ────────────────────────────────
-- Session A:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f301","role":"authenticated"}';
--   select public.respond_challenge('<DIRECTED_ID>', 1, 'accept');      -- returns, holds the row lock
-- Session B (Vasco, same team) — this call BLOCKS on the row lock:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f302","role":"authenticated"}';
--   select public.respond_challenge('<DIRECTED_ID>', 1, 'accept');
-- Session A: commit;
-- Session B now returns already_agreed = true and the SAME match_id. commit;
-- Expected: select count(*) from public.team_matches where challenge_id = '<DIRECTED_ID>';  → 1

-- ── Step 3: claim race ───────────────────────────────────
-- Session A (Bruno for B):
--   begin; set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f303","role":"authenticated"}';
--   select public.respond_challenge('<CLAIMABLE_ID>', 1, 'accept', '00000000-0000-0000-0000-0000000003b1', '<TOKEN>');
-- Session B (Paulo for C) — BLOCKS:
--   begin; set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f304","role":"authenticated"}';
--   select public.respond_challenge('<CLAIMABLE_ID>', 1, 'accept', '00000000-0000-0000-0000-0000000003c1', '<TOKEN>');
-- Session A: commit;
-- Session B fails with rivals:challenge_claimed. rollback;
-- Expected: challenged_team_id = B, exactly one team_matches row.

-- ── Step 4: verify ───────────────────────────────────────
select c.client_ref, c.status, c.challenged_team_id, (select count(*) from public.team_matches m where m.challenge_id = c.id) as matches
  from public.team_challenges c where c.client_ref in ('concurrency-directed', 'concurrency-claimable');

-- ── Step 5: cleanup (as postgres) ────────────────────────
delete from public.rivals_audit_log where team_id in ('00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003b1','00000000-0000-0000-0000-0000000003c1')
   or challenge_id in (select id from public.team_challenges where client_ref like 'concurrency-%');
delete from public.team_challenges where client_ref like 'concurrency-%';
delete from public.teams where id in ('00000000-0000-0000-0000-0000000003a1','00000000-0000-0000-0000-0000000003b1','00000000-0000-0000-0000-0000000003c1');
delete from public.players where id in ('00000000-0000-0000-0000-00000000e301','00000000-0000-0000-0000-00000000e302','00000000-0000-0000-0000-00000000e303','00000000-0000-0000-0000-00000000e304');
delete from auth.users where email like 'rv3-%@example.test';
