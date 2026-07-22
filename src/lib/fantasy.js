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

/** A player's fantasy price, derived from their season averages — no
 *  stored/fluctuating market, just a deterministic read of stats that
 *  already live on the player row (players.goals/assists/clean_sheets/
 *  mvps/games_played, exposed on the app's player shape in camelCase).
 *  Players with no games yet cost the base price. */
export function fantasyPrice(player, weights = DEFAULT_FANTASY_WEIGHTS) {
  const played = player.gamesPlayed || 0;
  if (!played) return weights.priceBase;
  const avgPts =
    (weights.golo * (player.goals || 0) +
      weights.assistencia * (player.assists || 0) +
      weights.cleanSheet * (player.cleanSheets || 0) +
      weights.mvp * (player.mvps || 0) +
      weights.participou * played) / played;
  return Math.round(weights.priceBase + avgPts * weights.priceScale);
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
