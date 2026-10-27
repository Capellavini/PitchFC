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
