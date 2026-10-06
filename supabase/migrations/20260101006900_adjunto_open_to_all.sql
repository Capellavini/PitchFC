-- ─────────────────────────────────────────────────────────
-- Migration 69 — Treinador Adjunto open to every group (Vini, 2026-10-06)
--
-- The per-group gate (groups.adjunto_enabled, 006300) was meant for a
-- one-group pilot. Vini decided any organizer/assistant who messages the
-- bot can activate it, so: enable it on every existing group and make it
-- the default for new ones. Nothing is sent proactively until an
-- organizer links themselves (phrase or code), so flipping the flag alone
-- sends no message to anyone. Rollback: set it back to false (per group,
-- or globally with ADJUNTO_ENABLED=false on the bot).
-- ─────────────────────────────────────────────────────────

alter table public.groups alter column adjunto_enabled set default true;
update public.groups set adjunto_enabled = true where adjunto_enabled is distinct from true;
