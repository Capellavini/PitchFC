-- ─────────────────────────────────────────────────────────
-- Migration 66 — fix groups_game_format_check (from 006300)
--
-- The 006300 check used `jsonb_typeof(game_format -> 'type') = 'string'`.
-- When "type" is missing, `-> 'type'` is NULL, the comparison is NULL, and
-- a CHECK treats NULL as passing — so {"v":1} was accepted (caught by
-- supabase/tests/adjunto_migrations_check.sql #43). coalesce() makes the
-- missing-key case false. Every row is still NULL (nothing writes
-- game_format yet), so re-adding the constraint can't fail.
-- ─────────────────────────────────────────────────────────

alter table public.groups drop constraint if exists groups_game_format_check;
alter table public.groups add constraint groups_game_format_check
  check (game_format is null
         or (jsonb_typeof(game_format) = 'object'
             and coalesce(jsonb_typeof(game_format -> 'type') = 'string', false)));
