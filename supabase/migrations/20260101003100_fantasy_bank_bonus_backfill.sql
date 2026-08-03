-- ─────────────────────────────────────────────────────────
-- Migration 31 — retroactively credit the bank-per-point bonus
-- (fantasy_bank_fix, migration 30) for rounds that were already locked
-- BEFORE that fix deployed. Those rounds ran under the old code, which
-- never credited any bank bonus — only rounds committed after the fix
-- (via commitMatchday/closeMvp in useCloud.js) get it live. Without this,
-- anyone whose first round happened before today would be stuck at a
-- freshly-reset $0 bank instead of the bonus their round actually earned.
--
-- Cutoff is the fantasy_bank_fix deploy time (2026-08-03 ~14:36 UTC, per
-- its CI run) so this can never double-credit a round the running app
-- already handled itself.
-- ─────────────────────────────────────────────────────────

with pre_fix_bonus as (
  select
    fsc.league_id, fsc.participant_id,
    sum(fsc.points) * coalesce((fl.scoring_weights->>'bankPerPoint')::numeric, 1) as bonus
  from public.fantasy_scores fsc
  join public.matchdays md on md.id = fsc.matchday_id
  join public.fantasy_leagues fl on fl.id = fsc.league_id
  where md.created_at < '2026-08-03 14:36:00+00'
  group by fsc.league_id, fsc.participant_id
)
update public.fantasy_squads fs
set budget_adjustment = fs.budget_adjustment + pre_fix_bonus.bonus
from pre_fix_bonus
where pre_fix_bonus.league_id = fs.league_id
  and pre_fix_bonus.participant_id = fs.participant_id;
