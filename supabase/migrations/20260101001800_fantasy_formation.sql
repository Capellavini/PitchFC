-- ─────────────────────────────────────────────────────────
-- Migration 18 — Fantasy squad formation order
--
-- Lets each participant drag their picks into a layout on the pitch
-- view (src/components/FantasyPitch.jsx). Nullable: falls back to
-- fantasy_squads.player_ids order when not set (existing squads keep
-- working unchanged).
-- ─────────────────────────────────────────────────────────

alter table public.fantasy_squads add column if not exists formation_order uuid[];
