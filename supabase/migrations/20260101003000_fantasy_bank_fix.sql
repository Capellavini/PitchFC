-- ─────────────────────────────────────────────────────────
-- Migration 30 — Pitch Manager bank fix (2026-08-02, reported by Vini:
-- Goodweather's bank showed -220M after just one round).
--
-- Root cause: the "banco" figure re-evaluated a squad's cost using the
-- player's CURRENT (live, ever-rising-with-form) price every render,
-- instead of what was actually paid when each player joined the squad.
-- Since prices only go up with good performances, this guaranteed the
-- bank would drift arbitrarily negative the moment your own players did
-- well — with no real purchase ever having been made.
--
-- Fix: track a per-player cost basis (prices_paid) on the squad itself,
-- updated incrementally by saveFantasySquad/respondTradeOffer (see
-- useCloud.js) instead of recomputed wholesale from live prices. Bank is
-- now budget + budget_adjustment - sum(prices_paid.values()) — stable
-- unless you actually buy, sell or trade.
--
-- Backfill: every existing squad is reset to the league's flat base
-- price (what a fresh draft costs on day one) for each currently held
-- player — forgiving the phantom debt this bug created before the fix
-- shipped. budget_adjustment (real cash from completed trades) is left
-- untouched — it was never part of the bug.
-- ─────────────────────────────────────────────────────────

alter table public.fantasy_squads add column if not exists prices_paid jsonb not null default '{}'::jsonb;

update public.fantasy_squads fs
set prices_paid = (
  select coalesce(jsonb_object_agg(pid, coalesce((fl.scoring_weights->>'priceBase')::numeric, 20)), '{}'::jsonb)
  from unnest(fs.player_ids) as pid
)
from public.fantasy_leagues fl
where fl.id = fs.league_id and fs.player_ids is not null and array_length(fs.player_ids, 1) > 0;
