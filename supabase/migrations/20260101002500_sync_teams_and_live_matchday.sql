-- ─────────────────────────────────────────────────────────
-- Migration 26 — sync the team draw and live matchday scoring across
-- devices. Both used to be purely local (usePersistentState/localStorage)
-- even in cloud mode: the organizer's draw or live scores on their own
-- phone never reached anyone else's screen. Both now live as jsonb on
-- the group's current game row, which every group member already reads
-- (and now also subscribes to via realtime — see useCloud.js).
--
-- Covered by the existing "games update" policy (group_id = my_group_id()
-- or admin), same as every other column on this table — no RLS change
-- needed. The UI is what keeps this read-only for non-organizers
-- (canManageTeams gates the controls in Matchday.jsx/MatchdayTab.jsx).
-- ─────────────────────────────────────────────────────────

alter table public.games add column if not exists teams jsonb;
alter table public.games add column if not exists live_matchday jsonb;
