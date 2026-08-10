-- ─────────────────────────────────────────────────────────
-- Migration 46 — Fix Fantasy scoring_weights missing epicSave/bankPerPoint
--
-- Migration 38 (epic_saves) added the epicSave stat and migration 30/31
-- added bankPerPoint, but neither ever touched fantasy_leagues.scoring_
-- weights' default value or backfilled leagues created before them. Every
-- league's stored scoring_weights JSON is therefore missing those two
-- keys, so `weights.epicSave` reads as `undefined` in JS — and
-- `0 * undefined` is NaN, not 0, so ANY player with a stat line that
-- round (not just ones who made a save) got NaN fantasy points. Fixed
-- client-side too (src/lib/fantasy.js now merges with JS defaults
-- regardless), but the DB default and already-created leagues need the
-- same fix so commitMatchday's stored points/budget stay correct.
-- ─────────────────────────────────────────────────────────

alter table public.fantasy_leagues
  alter column scoring_weights set default '{
    "participou": 2, "golo": 8, "assistencia": 5, "cleanSheet": 5, "epicSave": 4,
    "mvp": 10, "mvp2": 6, "mvp3": 3,
    "capitaoMultiplier": 2, "priceBase": 20, "priceScale": 1.5, "bankPerPoint": 1
  }'::jsonb;

-- Backfill: fill in only the keys missing from each league's existing
-- JSON — the jsonb `||` operator keeps the right-hand side's value on
-- conflict, so any weight the organizer may already have customized
-- stays untouched.
update public.fantasy_leagues
set scoring_weights = '{"epicSave": 4, "bankPerPoint": 1}'::jsonb || scoring_weights
where not (scoring_weights ? 'epicSave') or not (scoring_weights ? 'bankPerPoint');
