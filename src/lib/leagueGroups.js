import { COMPETITION, COMPETITIONS } from "./leagueDemo.js";

/** Matches grouped as competition → round (phase), for the calendar views.
 *  `scope` is "all" or a competition id. Pure. */
export function competitionRounds(matches, scope = "all") {
  return COMPETITIONS
    .filter((c) => scope === "all" || scope === c.id)
    .map((competition) => {
      const own = matches.filter((m) => (m.competitionId || COMPETITION.id) === competition.id);
      const rounds = [...new Set(own.map((m) => m.round))].sort((a, b) => a - b)
        .map((round) => {
          const ms = own.filter((m) => m.round === round).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
          return { round, name: ms.find((m) => m.roundName)?.roundName || null, matches: ms };
        });
      return { competition, rounds };
    })
    .filter((g) => g.rounds.length);
}

const SETTLED = new Set(["homologated", "walkover"]);
/** Rounds drawn open by default in a long Calendário. Up to `all` rounds everything is open; beyond
 *  that only the first round that still has something to settle (or the last one, when the season
 *  is done) is. Returns the set of round numbers. */
export function openRounds(rounds, all = 6) {
  if (rounds.length <= all) return new Set(rounds.map((r) => r.round));
  const next = rounds.find((r) => r.matches.some((m) => !SETTLED.has(m.state))) || rounds[rounds.length - 1];
  return new Set([next.round]);
}
