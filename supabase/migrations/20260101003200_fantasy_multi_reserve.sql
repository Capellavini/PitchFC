-- ─────────────────────────────────────────────────────────
-- Migration 32 — Pitch Manager: buy more than the starting squad size.
-- Managers can now hold more players than league.squad_size; the extras
-- sit as non-scoring reserves (depth for future trades), not just the
-- single bench slot from before. reserve_id (singular, one bench spot)
-- is superseded by reserve_ids (plural) on both fantasy_squads and
-- fantasy_scores (which snapshots it at round-lock time).
-- ─────────────────────────────────────────────────────────

alter table public.fantasy_squads add column if not exists reserve_ids uuid[] not null default '{}';
alter table public.fantasy_scores add column if not exists reserve_ids uuid[] not null default '{}';

update public.fantasy_squads set reserve_ids = array[reserve_id]
  where reserve_id is not null and coalesce(array_length(reserve_ids, 1), 0) = 0;
update public.fantasy_scores set reserve_ids = array[reserve_id]
  where reserve_id is not null and coalesce(array_length(reserve_ids, 1), 0) = 0;
