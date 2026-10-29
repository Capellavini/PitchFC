// "Início" do adepto — what a fan of the league sees first: their team, a game
// happening now, the vote, the round and the highlights. Pure: derives it from
// the league state; no I/O, no writes.
import { COMPETITION, PLAYERS, currentRound, matchesOfTeam, tableOfTeam, modOn } from "./leagueDemo.js";
import { fanVoteOpen, ranking, fantasyTeamPoints } from "./core/league.js";

const PLAYED = new Set(["ended_provisional", "in_review", "homologated", "walkover"]);
const compOf = (m) => m.competitionId || COMPETITION.id;
const byKickoff = (a, b) => (a.kickoff || "").localeCompare(b.kickoff || "");

/**
 * @param {{matches: object[], prefs: object, fanVotes?: object, fantasy?: object, logs?: object}} state
 * @param {{table: object[], stats: object}} derived
 * @param {{accountId: string}} who
 */
export function fanHome(state, derived, { accountId }) {
  const matches = state.matches || [];
  const supportId = state.prefs?.supportTeamId || null;
  // The competition the fan follows is the one their team plays (its table), else the primary.
  const { competitionId: focusId, position, row } = tableOfTeam(derived, supportId);
  const league = matches.filter((m) => compOf(m) === (focusId || COMPETITION.id));
  const followIds = [...new Set([supportId, ...(state.prefs?.followTeamIds || [])].filter(Boolean))];

  const mine = supportId ? matchesOfTeam(matches, supportId) : [];
  const next = mine.filter((m) => ["scheduled", "live", "postponed"].includes(m.state)).sort(byKickoff)[0] || null;
  const form = mine.filter((m) => m.state === "homologated").sort((a, b) => byKickoff(b, a)).slice(0, 5).map((m) => {
    const s = derived.scores[m.id]; const own = m.homeId === supportId ? s.home : s.away; const their = m.homeId === supportId ? s.away : s.home;
    return own > their ? "W" : own < their ? "L" : "D";
  });

  const live = matches.filter((m) => m.state === "live").sort(byKickoff);
  const voteMatch = (modOn("fan_vote") ? matches.filter(fanVoteOpen) : []).sort((a, b) => byKickoff(b, a))[0] || null;
  const myVote = voteMatch ? state.fanVotes?.[voteMatch.id]?.[accountId] || null : null;
  const round = currentRound(league);
  const topScorer = ranking(derived.stats, PLAYERS, "goals", 1)[0] || null;
  const lastMvpMatch = league.filter((m) => m.officialMvp && m.state === "homologated").sort((a, b) => byKickoff(b, a))[0] || null;
  const picks = state.fantasy?.[accountId] || [];
  const fantasy = { picked: picks.length > 0, points: picks.length ? fantasyTeamPoints(picks, PLAYERS, state.matches, state.logs).total : 0 };

  return {
    supportId, followIds, next, position, row, competitionId: focusId, form,
    live, voteMatch, myVote, round, roundMatches: league.filter((m) => m.round === round),
    topScorer, lastMvpMatch, fantasy,
    recent: league.filter((m) => PLAYED.has(m.state)).sort((a, b) => byKickoff(b, a)).slice(0, 3),
  };
}
