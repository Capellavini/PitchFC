-- ─────────────────────────────────────────────────────────
-- Migration 17 — make sure vinicius.capella@ziarimoveis.com.br is
-- actually flagged as organizer of their group.
--
-- Migration 16 should already have set this, but the "confirm any
-- player" button (gated on players.is_organizer) still isn't showing
-- for that account — this re-asserts it directly, in case migration 16
-- picked a different player row (e.g. more than one row existed for
-- that user_id) or something else left it false. Idempotent no-op if
-- it's already true.
-- ─────────────────────────────────────────────────────────

update public.players
set is_organizer = true
where lower(email) = 'vinicius.capella@ziarimoveis.com.br'
  and is_organizer is distinct from true;
