// Builds a JSON-serialisable snapshot of every standings/tournament/
// rankings function's output on the shared fixtures. golden.json was
// captured from the PRE-refactor modules (src/lib/tournament.js,
// matchdayLive.js, rankings.js as of dd1245f); the regression tests rebuild
// the snapshot from the new core modules and require deep equality.
import { TEAM_IDS_3, TEAM_IDS_4, TEAMS_3, TEAMS_4, MATCH_SETS, MATCHDAYS, ROSTER, SUMMARIES } from "./fixtures.js";

export function standingsSnapshot({ tournament, live }) {
  const out = { computeStandings: {}, standings: {}, playoffState: {}, goalsOf: {}, fixtures: {}, knockout: {}, next: {}, winner: [] };
  for (const [name, set] of Object.entries(MATCH_SETS)) {
    out.computeStandings[name] = {
      three: tournament.computeStandings(TEAM_IDS_3, set),
      four: tournament.computeStandings(TEAM_IDS_4, set),
    };
    out.standings[name] = { three: live.standings(TEAMS_3, set), four: live.standings(TEAMS_4, set) };
    out.goalsOf[name] = set.map((m) => [live.goalsOf(m, m.homeId), live.goalsOf(m, m.awayId)]);
  }
  for (const [name, md] of Object.entries(MATCHDAYS)) {
    const s = live.playoffState(md);
    out.playoffState[name] = {
      playoffMatches: s.playoffMatches.map((m) => m.id),
      rounds: s.rounds, currentRound: s.currentRound, champion: s.champion, canAdvance: s.canAdvance,
      roundSize: [1, 2, 3].map(s.roundSize),
      winners: s.playoffMatches.map(s.winnerOf),
    };
  }
  for (let n = 2; n <= 7; n++) {
    const ids = Array.from({ length: n }, (_, i) => `t${i + 1}`);
    out.fixtures[n] = { single: tournament.roundRobinFixtures(ids, false), double: tournament.roundRobinFixtures(ids, true) };
    out.knockout[n] = { plain: tournament.buildKnockoutRound1(ids, false), top: tournament.buildKnockoutRound1(ids, true) };
    out.next[n] = tournament.nextKnockoutRound(ids);
  }
  for (const [h, a, pen] of [[2, 1, null], [1, 2, null], [1, 1, null], [1, 1, "t2"], [0, 0, "t1"]]) {
    out.winner.push(tournament.matchWinner({ homeId: "t1", awayId: "t2", penaltyWinnerId: pen ?? undefined }, h, a));
  }
  return JSON.parse(JSON.stringify(out));
}

export function rankingsSnapshot(r) {
  const recent = r.recentDaysOf(SUMMARIES);
  const gap = r.performanceGapFn(ROSTER);
  const out = {
    GOAL_WEIGHT: r.GOAL_WEIGHT,
    recentLen: recent.length,
    recentDefault: r.recentDaysOf().length,
    rated: r.ratedPlayers(ROSTER).map((p) => p.id),
    players: ROSTER.map((p) => ({
      key: r.playerKey(p),
      impacto: r.impactoOf(p), gk: r.gkScoreOf(p),
      rel15: r.reliabilityOf(p, 15), rel0: r.reliabilityOf(p, 0), rel10: r.reliabilityOf(p, 10),
      forma: r.formaOf(p, recent), hot: r.isHot(p, recent), gap: gap(p),
    })),
    uuidKey: r.playerKey({ id: 5, uuid: "abc" }),
    podium: SUMMARIES.map((md) => r.podiumTop3(md.summary?.lines)),
    podiumNull: r.podiumTop3(null),
    together: [[1, 2], [3, 7], [1, 3], [2], [4, 1, 2]].map((keys) => r.togetherStats(keys, SUMMARIES)),
    togetherDefault: r.togetherStats([1]),
    dayTeamRows: r.dayTeamRows(SUMMARIES),
    dayTeamRowsDefault: r.dayTeamRows(),
  };
  return JSON.parse(JSON.stringify(out));
}
