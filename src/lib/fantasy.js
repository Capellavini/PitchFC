// ── Fantasy League scoring/pricing ──────────────────────────
// Pure functions only — no Supabase calls here (those live in useCloud.js).
// A "round" is one real matchday; per-player performance for that round
// comes from matchdays.summary.lines ({ key: playerUuid, goals, assists,
// cleanSheets }), built in PitchApp.jsx when the organizer ends the day.

export const DEFAULT_FANTASY_WEIGHTS = {
  participou: 2, golo: 8, assistencia: 5, cleanSheet: 5,
  mvp: 10, mvp2: 6, mvp3: 3,
  capitaoMultiplier: 2, priceBase: 20, priceScale: 1.5,
};

/** A player's fantasy price — every player starts at the flat base price
 *  (weights.priceBase) when a league begins, then drifts with their
 *  average fantasy points *since that league started* (not lifetime
 *  season stats — a league always opens with everyone at the same
 *  price). `roundsSinceStart` is the group's matchdays already filtered
 *  to `created_at >= league.starts_at` (see FantasyTab). No stored/
 *  fluctuating market — deterministic from those rounds' summary.lines. */
export function fantasyPrice(playerUuid, roundsSinceStart, weights = DEFAULT_FANTASY_WEIGHTS) {
  const rounds = (roundsSinceStart || []).filter((md) => (md.summary?.lines || []).some((l) => l.key === playerUuid));
  if (!rounds.length) return weights.priceBase;
  const total = rounds.reduce((sum, md) => sum + computeRoundPoints([playerUuid], null, md.summary.lines, weights), 0);
  return Math.round(weights.priceBase + (total / rounds.length) * weights.priceScale);
}

/** Fantasy points a squad earns for one round, from that round's
 *  matchday.summary.lines. Excludes the MVP bonus — the MVP isn't known
 *  until the 24h vote closes, after the round already locked (see
 *  useCloud.js closeMvp, which adds it separately once decided).
 *  Players who didn't play that round (absent from summaryLines)
 *  contribute 0. The captain's total is doubled (capitaoMultiplier). */
export function computeRoundPoints(playerIds, captainId, summaryLines, weights = DEFAULT_FANTASY_WEIGHTS) {
  const lines = summaryLines || [];
  return (playerIds || []).reduce((total, id) => {
    const line = lines.find((l) => l.key === id);
    if (!line) return total;
    let pts = weights.participou
      + (line.goals || 0) * weights.golo
      + (line.assists || 0) * weights.assistencia
      + (line.cleanSheets > 0 ? weights.cleanSheet : 0);
    if (id === captainId) pts *= weights.capitaoMultiplier;
    return total + pts;
  }, 0);
}

/** Podium bonus for a single locked round, added once the 24h vote closes
 *  (1st/2nd/3rd — see matchdays.mvp_id/runner_up_id/third_id). A squad
 *  only ever collects one of the three (a player can't finish 1st AND
 *  2nd), so the first match wins. Returns 0 if none of the podium is
 *  in this squad. */
export function mvpBonus(playerIds, captainId, podium, weights = DEFAULT_FANTASY_WEIGHTS) {
  const { mvpId, runnerUpId, thirdId } = podium || {};
  const ids = playerIds || [];
  const placementWeight = mvpId && ids.includes(mvpId) ? weights.mvp
    : runnerUpId && ids.includes(runnerUpId) ? weights.mvp2
    : thirdId && ids.includes(thirdId) ? weights.mvp3
    : 0;
  if (!placementWeight) return 0;
  const winnerId = mvpId && ids.includes(mvpId) ? mvpId : runnerUpId && ids.includes(runnerUpId) ? runnerUpId : thirdId;
  return winnerId === captainId ? placementWeight * weights.capitaoMultiplier : placementWeight;
}
