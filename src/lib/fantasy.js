// ── Fantasy League scoring/pricing ──────────────────────────
// Pure functions only — no Supabase calls here (those live in useCloud.js).
// A "round" is one real matchday; per-player performance for that round
// comes from matchdays.summary.lines ({ key: playerUuid, goals, assists,
// cleanSheets }), built in PitchApp.jsx when the organizer ends the day.

export const DEFAULT_FANTASY_WEIGHTS = {
  participou: 2, golo: 8, assistencia: 5, cleanSheet: 5,
  mvp: 10, mvp2: 6, mvp3: 3,
  capitaoMultiplier: 2, priceBase: 20, priceScale: 1.5,
  // $ credited to the bank per fantasy point scored that round — the
  // bank's only source of "new money" round to round (besides trades),
  // so a good week actually buys you room to strengthen the squad.
  bankPerPoint: 1,
};

/** Money display for Pitch Manager — everything in millions, FPL-style
 *  ("$120.0M"). Purely cosmetic: the underlying numbers (budget 120,
 *  priceBase 20, …) don't change, they just render with the M suffix. */
export const fmtM = (n) => `$${(Number(n) || 0).toFixed(1)}M`;

/** A real player can be picked by at most this many Pitch Manager
 *  participants at once — past that, the only way in is trading with
 *  one of the current owners. */
export const OWNERSHIP_CAP = 6;

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

/** A squad's bank must never re-price players it already owns at
 *  today's (ever-rising) market value — that guaranteed a negative bank
 *  the moment your own picks did well, with no purchase ever made. This
 *  computes the next per-player cost basis for a squad transitioning to
 *  `newPlayerIds`: kept players retain what they were actually charged;
 *  anyone newly added is charged today's price (a real transaction).
 *  Dropped players simply don't appear — that basis is freed. */
export function nextPricesPaid(prevPricesPaid, newPlayerIds, priceOf) {
  const next = {};
  (newPlayerIds || []).forEach((id) => {
    next[id] = prevPricesPaid?.[id] ?? priceOf(id);
  });
  return next;
}

/** Sum of a squad's per-player cost basis — what's actually committed,
 *  as opposed to the squad's live market value. */
export const squadCostBasis = (pricesPaid) =>
  Object.values(pricesPaid || {}).reduce((s, v) => s + (Number(v) || 0), 0);

/** Fantasy points a squad earns for one round, from that round's
 *  matchday.summary.lines. Excludes the MVP bonus — the MVP isn't known
 *  until the 24h vote closes, after the round already locked (see
 *  useCloud.js closeMvp, which adds it separately once decided).
 *  Players who didn't play that round (absent from summaryLines)
 *  contribute 0. The captain's total is doubled (capitaoMultiplier).
 *  The reserve (bench) never scores, regardless of how they played. */
export function computeRoundPoints(playerIds, captainId, summaryLines, weights = DEFAULT_FANTASY_WEIGHTS, reserveId = null) {
  const lines = summaryLines || [];
  return (playerIds || []).reduce((total, id) => {
    if (id === reserveId) return total;
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
 *  in this squad, or if the only podium finisher in the squad is benched. */
export function mvpBonus(playerIds, captainId, podium, weights = DEFAULT_FANTASY_WEIGHTS, reserveId = null) {
  const { mvpId, runnerUpId, thirdId } = podium || {};
  const ids = (playerIds || []).filter((id) => id !== reserveId);
  const placementWeight = mvpId && ids.includes(mvpId) ? weights.mvp
    : runnerUpId && ids.includes(runnerUpId) ? weights.mvp2
    : thirdId && ids.includes(thirdId) ? weights.mvp3
    : 0;
  if (!placementWeight) return 0;
  const winnerId = mvpId && ids.includes(mvpId) ? mvpId : runnerUpId && ids.includes(runnerUpId) ? runnerUpId : thirdId;
  return winnerId === captainId ? placementWeight * weights.capitaoMultiplier : placementWeight;
}
