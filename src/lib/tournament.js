// ── "Personalizado" matchday format — fixtures + knockout bracket ──
// The logic lives in the shared core (src/lib/core/standings.js, also
// used by the WhatsApp bot); this module keeps the app's import path.
// A "team" is always referred to by its drawn-team id (t1, t2…).
import { computeTable } from "./core/standings.js";

export { roundRobinFixtures, buildKnockoutRound1, nextKnockoutRound, matchWinner } from "./core/standings.js";

/** Points table (V=3, E=1, tiebreak pts → gd → gf) from a set of matches
 *  for a fixed set of team ids — shared by Matchday.jsx's "Campeonato"
 *  table and the "Personalizado" group stage (which uses it to seed the
 *  play-off). */
export function computeStandings(teamIds, matches) {
  return computeTable(teamIds, matches);
}
