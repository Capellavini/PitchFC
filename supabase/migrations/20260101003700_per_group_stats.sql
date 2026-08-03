-- ─────────────────────────────────────────────────────────
-- Migration 37 — Cross-group player identity: per-group season stats
-- (Phase 2)
--
-- goals/assists/mvps/games_played/wins/clean_sheets have lived directly
-- on players — a running total that only meant "per group" because a
-- player only ever had one. Moving them onto player_group_memberships
-- so each group a player belongs to keeps its own independent
-- leaderboard. The sync trigger from migration 36 already omits these
-- columns from its upsert, so it never clobbers them; a brand-new
-- membership (a real second group) correctly starts every stat at 0.
--
-- players.goals/assists/mvps/games_played/wins/clean_sheets are left in
-- place (stop being written going forward) rather than dropped now —
-- safer; a follow-up cleanup can drop them once this is confirmed
-- working end to end.
-- ─────────────────────────────────────────────────────────

alter table public.player_group_memberships
  add column if not exists goals int not null default 0,
  add column if not exists assists int not null default 0,
  add column if not exists mvps int not null default 0,
  add column if not exists games_played int not null default 0,
  add column if not exists wins int not null default 0,
  add column if not exists clean_sheets int not null default 0;

update public.player_group_memberships m
set goals = p.goals, assists = p.assists, mvps = p.mvps,
    games_played = p.games_played, wins = p.wins, clean_sheets = p.clean_sheets
from public.players p
where p.id = m.player_id and p.group_id = m.group_id;
