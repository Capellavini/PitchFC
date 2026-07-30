-- ─────────────────────────────────────────────────────────
-- Migration 28 — explicit "confirm teams" step. The organizer can now
-- draw/rename/move players into a draft that's saved but NOT shown to
-- players yet; only once they tap "Confirmar equipas" does the draw
-- become visible on players' Matchday tab.
-- ─────────────────────────────────────────────────────────

alter table public.games add column if not exists teams_confirmed boolean not null default false;
