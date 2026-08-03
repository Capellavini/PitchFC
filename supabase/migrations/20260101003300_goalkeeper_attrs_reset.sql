-- ─────────────────────────────────────────────────────────
-- Migration 33 — goalkeepers get their own FIFA attribute set (diving/
-- handling/kicking/reflexes/speed/positioning) instead of the outfield
-- one (pace/shooting/passing/dribbling/defending/physical). Existing
-- peer_ratings for goalkeepers were submitted on the OLD (outfield)
-- axes, which no longer mean anything for them — clear those so their
-- cards re-lock until teammates rate them again on the new sliders.
--
-- Exception (Vini, 2026-08-03): keep Dan's ratings in the Goodweather
-- group as-is — explicitly requested, not reset with the rest.
-- ─────────────────────────────────────────────────────────

delete from public.peer_ratings pr
using public.players p
where pr.player_id = p.id
  and p.position = 'Guarda-redes'
  and p.id <> '33d9ccbb-4df8-4692-8ec4-0072e70a7a02';
