// GENERATED from src/lib/core — do not edit; run npm run sync:core
// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// League tables, round-robin fixtures, knockout brackets and play-off
// bookkeeping. A "team" is always its drawn-team id (t1, t2…).
// Live match shape: { homeId, awayId, events: [...], stage?, round?,
// isBye?, concluded?, penaltyWinnerId? }. Events: goal { teamId, scorerId,
// assistId?, ownGoal? } — teamId is the team that BENEFITS — or save
// { teamId, type: "epicSave", playerId }.
import { hashId } from "./ids.js";

export const isSave = (e) => e?.type === "epicSave";

export const goalsOf = (m, teamId) => (m.events || []).filter((e) => e.teamId === teamId && !isSave(e)).length;

export const DEFAULT_POINTS = { win: 3, draw: 1, loss: 0 };
export const DEFAULT_TIEBREAKERS = ["pts", "gd", "gf"];
export const TIEBREAKERS = ["pts", "gd", "gf", "h2h", "wins", "ga_fewest", "lots"];

function tally(teams, matches, points) {
  const rows = {};
  teams.forEach((t) => {
    const base = typeof t === "object" && t !== null ? { ...t } : { id: t };
    rows[base.id] = { ...base, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  });
  matches.forEach((m) => {
    const H = rows[m.homeId], A = rows[m.awayId];
    if (!H || !A) return;
    const hg = goalsOf(m, m.homeId), ag = goalsOf(m, m.awayId);
    H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
    if (hg > ag) { H.w++; A.l++; } else if (ag > hg) { A.w++; H.l++; } else { H.d++; A.d++; }
  });
  return Object.values(rows).map((r) => ({
    ...r, j: r.w + r.d + r.l, gd: r.gf - r.ga, pts: r.w * points.win + r.d * points.draw + r.l * points.loss,
  }));
}

// "Sorteio" tiebreak: deterministic per (seed, team) — hashId alone is
// too linear (a shared seed prefix shifts every team equally), so run it
// through the murmur3 finaliser.
function lotsKey(seed, id) {
  let h = hashId(`${seed ?? 0}:${id}`);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Each criterion maps a group of still-tied rows to a sort key per row
// (higher = better). h2h is group-relative: a mini-table of only the
// matches between the tied teams (its pts, then gd, then gf).
function keysFor(criterion, group, { matches, points, seed }) {
  switch (criterion) {
    case "pts": return group.map((r) => [r.pts]);
    case "gd": return group.map((r) => [r.gd]);
    case "gf": return group.map((r) => [r.gf]);
    case "wins": return group.map((r) => [r.w]);
    case "ga_fewest": return group.map((r) => [-r.ga]);
    case "lots": return group.map((r) => [lotsKey(seed, r.id)]);
    case "h2h": {
      const ids = new Set(group.map((r) => r.id));
      const mini = tally([...ids], matches.filter((m) => ids.has(m.homeId) && ids.has(m.awayId)), points);
      const byId = Object.fromEntries(mini.map((r) => [r.id, r]));
      return group.map((r) => [byId[r.id].pts, byId[r.id].gd, byId[r.id].gf]);
    }
    default: throw new Error(`Unknown tiebreaker: ${criterion}`);
  }
}

const cmpKeys = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};

function rank(group, criteria, ctx) {
  if (group.length < 2 || !criteria.length) return group;
  const [c, ...rest] = criteria;
  const keys = keysFor(c, group, ctx);
  const items = group.map((r, i) => ({ r, k: keys[i] }));
  items.sort((x, y) => cmpKeys(x.k, y.k)); // stable: ties keep insertion order
  const out = [];
  for (let i = 0; i < items.length;) {
    let j = i + 1;
    while (j < items.length && cmpKeys(items[i].k, items[j].k) === 0) j++;
    out.push(...rank(items.slice(i, j).map((x) => x.r), rest, ctx));
    i = j;
  }
  return out;
}

/** League table for a fixed set of teams (ids, or team objects whose
 *  fields are carried onto the rows). Rows: { id, …team, w, d, l, gf, ga,
 *  j, gd, pts }. Matches between unknown teams are ignored. Fully tied
 *  rows keep the order the teams were given in. */
export function computeTable(teams, matches, { points = DEFAULT_POINTS, tiebreakers = DEFAULT_TIEBREAKERS, seed } = {}) {
  const pts = { ...DEFAULT_POINTS, ...points };
  const rows = tally(teams, matches, pts);
  return rank(rows, tiebreakers, { matches, points: pts, seed });
}

/** Round-robin fixture list for N teams (circle method). `doubleLegged`
 *  repeats every pairing with home/away swapped (ida e volta). Odd team
 *  counts get an automatic bye per round (that team sits out, no fixture
 *  is created for it) — handled by padding with a null slot. */
export function roundRobinFixtures(teamIds, doubleLegged) {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const rounds = [];
  const rotating = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const home = rotating[i], away = rotating[n - 1 - i];
      if (home !== null && away !== null) round.push({ homeId: home, awayId: away });
    }
    rounds.push(round);
    rotating.splice(1, 0, rotating.pop());
  }
  const fixtures = rounds.flat();
  if (!doubleLegged) return fixtures;
  return [...fixtures, ...fixtures.map((f) => ({ homeId: f.awayId, awayId: f.homeId }))];
}

/** Standard single-elimination first round for a seed list (best →
 *  worst): pads to the next power of 2, giving the TOP seeds a bye
 *  (paired with `null`) when the count isn't already one. */
function standardBracket(seeds) {
  const n = seeds.length;
  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;
  const byes = bracketSize - n;
  const pairs = [];
  for (let i = 0; i < byes; i++) pairs.push([seeds[i], null]);
  const rest = seeds.slice(byes);
  for (let i = 0; i < rest.length / 2; i++) pairs.push([rest[i], rest[rest.length - 1 - i]]);
  return pairs;
}

/** First knockout round from a seed list (best → worst). `forceByeForTop`
 *  is "1º lugar vai direto à final": the #1 seed is pulled out with an
 *  explicit bye and the REST bracket among themselves (which may itself
 *  need its own natural bye for the next-best seed — that's expected
 *  seeded-bracket behaviour, not a bug). With only 2 seeds there's no
 *  earlier round to skip, so the flag is a no-op there. */
export function buildKnockoutRound1(seeds, forceByeForTop) {
  if (forceByeForTop && seeds.length >= 3) {
    const [first, ...rest] = seeds;
    return [[first, null], ...standardBracket(rest)];
  }
  return standardBracket(seeds); // [[teamId, teamId|null], ...] — null = bye (auto-advances)
}

/** Next round's pairings from the previous round's winners (in the same
 *  order the matches were played), standard "1 vs 2, 3 vs 4…" bracket
 *  progression. */
export function nextKnockoutRound(winners) {
  const pairs = [];
  for (let i = 0; i < winners.length; i += 2) pairs.push([winners[i], winners[i + 1] ?? null]);
  return pairs;
}

/** Winner of a single match: normal score, or the recorded penalty
 *  shootout winner if it was tied and penalties were used. Returns null
 *  if still undecided (tied, no penalty result yet). */
export function matchWinner(m, goalsHome, goalsAway) {
  if (goalsHome > goalsAway) return m.homeId;
  if (goalsAway > goalsHome) return m.awayId;
  return m.penaltyWinnerId ?? null;
}

/** Play-off bookkeeping (personalizado only): current round, whether it's
 *  decided, champion, and whether "advance" is allowed. "Concluído" (the
 *  explicit lock-in) is what gates advancing — a 0-0 on a match nobody has
 *  played yet would otherwise look decided from the score alone. */
export function playoffState(matchday) {
  const matches = matchday?.matches || [];
  const playoffMatches = matches.filter((m) => m.stage === "playoff");
  const rounds = [...new Set(playoffMatches.map((m) => m.round))].sort((a, b) => a - b);
  const currentRound = playoffMatches.length ? Math.max(...playoffMatches.map((m) => m.round)) : 0;
  const currentRoundMatches = playoffMatches.filter((m) => m.round === currentRound);
  const winnerOf = (m) => (m.isBye ? m.homeId : matchWinner(m, goalsOf(m, m.homeId), goalsOf(m, m.awayId)));
  const roundWinners = currentRoundMatches.map(winnerOf);
  const isDone = (m) => m.isBye || Boolean(m.concluded);
  const groupMatches = matches.filter((m) => m.stage !== "playoff");
  const allGroupConcluded = groupMatches.length > 0 && groupMatches.every(isDone);
  const roundDecided = roundWinners.length > 0 && roundWinners.every(Boolean) && currentRoundMatches.every(isDone);
  const champion = currentRound > 0 && currentRoundMatches.length === 1 && roundDecided ? roundWinners[0] : null;
  const isPersonalizado = matchday?.mode === "personalizado";
  const canAdvance = isPersonalizado && Boolean(matchday.config?.faseFinal) && !champion
    && (currentRound === 0 ? allGroupConcluded : roundDecided);
  const roundSize = (round) => playoffMatches.filter((pm) => pm.round === round).length;
  return { playoffMatches, rounds, currentRound, champion, canAdvance, roundSize, winnerOf };
}
