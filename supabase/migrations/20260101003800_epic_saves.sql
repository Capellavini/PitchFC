-- ─────────────────────────────────────────────────────────
-- Migration 38 — Epic save stat for goalkeepers
--
-- Requested by Marco (testing): a way to log a standout save during live
-- matchday scoring, counting toward season stats and Fantasy points —
-- same per-group model as migration 37's other season stats.
-- ─────────────────────────────────────────────────────────

alter table public.player_group_memberships add column if not exists epic_saves int not null default 0;
