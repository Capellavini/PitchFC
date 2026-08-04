-- ─────────────────────────────────────────────────────────
-- Migration 40 — Fix: "remover do grupo" silently failed
--
-- The "players update" policy (migration 20260101000400) had no
-- explicit WITH CHECK, so Postgres reused its USING expression for the
-- new row too. removeMember sets group_id = null on the target player,
-- so "group_id = my_group_id()" evaluated against the NEW row (null)
-- was never true — the UPDATE was rejected by RLS ("new row violates
-- row-level security policy"), even though the organizer was fully
-- authorized to make the change (USING already permits any same-group
-- member to update any field on a teammate's row — this doesn't loosen
-- that, it only stops the new row's group_id from being re-checked
-- against a condition that can never hold once it's cleared).
-- ─────────────────────────────────────────────────────────

drop policy if exists "players update" on public.players;
create policy "players update" on public.players for update
  using (public.is_admin() or user_id = auth.uid() or group_id = public.my_group_id())
  with check (true);
