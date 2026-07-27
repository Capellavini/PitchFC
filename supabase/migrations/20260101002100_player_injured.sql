-- ─────────────────────────────────────────────────────────
-- Migration 21 — self-reported "injured" status
--
-- A player marks themselves injured on their own profile (FUT card gets
-- a red medical-cross badge); anyone in the group can see it. Self-only
-- write — the existing "players update" policy (user_id = auth.uid() OR
-- group_id = my_group_id() OR admin) already covers this, no new policy
-- needed.
-- ─────────────────────────────────────────────────────────

alter table public.players add column if not exists injured boolean not null default false;
