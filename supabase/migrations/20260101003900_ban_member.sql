-- ─────────────────────────────────────────────────────────
-- Migration 39 — Ban a group member
--
-- Stronger than the existing soft "remove" (which only clears
-- players.group_id/roles, keeping the membership row so a rejoin via a
-- fresh invite picks up their stats): a ban additionally blocks that
-- rejoin. No RLS change needed — the existing player_group_memberships
-- "for all" policy already covers writing this column for an
-- organizer/assistant; the ban action itself stays gated client-side to
-- the organizer only.
-- ─────────────────────────────────────────────────────────

alter table public.player_group_memberships add column if not exists banned boolean not null default false;
