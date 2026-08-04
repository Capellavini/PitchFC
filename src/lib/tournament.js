// ── "Personalizado" matchday format — fixtures + knockout bracket ──
// Pure functions only (no React/Supabase here). A "team" is always
// referred to by its drawn-team id (t1, t2…), matching Matchday.jsx.

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

/** Points table (V=3, E=1) from a set of matches for a fixed set of
 *  team ids — shared by Matchday.jsx's "Campeonato" table and the
 *  "Personalizado" group stage (which uses it to seed the play-off). */
export function computeStandings(teamIds, matches) {
  const tally = {};
  teamIds.forEach((id) => { tally[id] = { id, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; });
  matches.forEach((m) => {
    const H = tally[m.homeId], A = tally[m.awayId];
    if (!H || !A) return;
    const hg = m.events.filter((e) => e.teamId === m.homeId && e.type !== "epicSave").length;
    const ag = m.events.filter((e) => e.teamId === m.awayId && e.type !== "epicSave").length;
    H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
    if (hg > ag) { H.w++; A.l++; } else if (ag > hg) { A.w++; H.l++; } else { H.d++; A.d++; }
  });
  return Object.values(tally)
    .map((t) => ({ ...t, j: t.w + t.d + t.l, gd: t.gf - t.ga, pts: t.w * 3 + t.d }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}
