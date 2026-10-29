// "Equipa" do capitão e do atleta — what a team's own people need to do or
// know right now, across every competition the team plays. Pure: derives it
// from the league state; no I/O, no writes.
import { COMPETITION, matchesOfTeam, tableOfTeam, modOn } from "./leagueDemo.js";
import { fanVoteOpen } from "./core/league.js";

const PLAYED = new Set(["ended_provisional", "in_review", "homologated", "walkover"]);
const compOf = (m) => m.competitionId || COMPETITION.id;
const byKickoff = (a, b) => (a.kickoff || "").localeCompare(b.kickoff || "");

/** Urgency order of what a team's people have to deal with. */
const ORDER = ["self_suspended", "lineup", "banned_in_lineup", "contest", "vote"];

/**
 * @param {{matches: object[], fanVotes?: object}} state
 * @param {{discipline: object, table: object[], scores: object}} derived
 * @param {{teamId: string, playerId?: string|null, accountId?: string|null, role: "captain"|"athlete"}} who
 * @returns {{queue: object[], next: object|null, upcoming: object[], recent: object[], position: number, row: object|null, banned: Set<string>}}
 *   queue: what needs doing, most urgent first. The captain gets the team's
 *   duties (call-up, banned players in it, reviewing a provisional result);
 *   everyone in the team gets their own suspension and the fan vote.
 */
export function teamHome(state, derived, { teamId, playerId = null, accountId = null, role }) {
  const matches = state.matches || [];
  const mine = matchesOfTeam(matches, teamId);
  const banned = new Set(Object.values(derived?.discipline || {}).filter((d) => d.pending > 0).map((d) => d.playerId));
  const upcoming = mine.filter((m) => ["scheduled", "live", "postponed"].includes(m.state)).sort(byKickoff);
  const recent = mine.filter((m) => PLAYED.has(m.state)).sort((a, b) => byKickoff(b, a)).slice(0, 3);
  const next = upcoming[0] || null;

  const queue = [];
  if (next && playerId && banned.has(playerId)) {
    queue.push({ kind: "self_suspended", key: `self-${next.id}`, matchId: next.id, competitionId: compOf(next), playerId });
  }
  if (role === "captain") {
    for (const m of upcoming.filter((x) => x.state === "scheduled").slice(0, 2)) {
      const lineup = m.lineups?.[teamId] || [];
      if (!lineup.length) queue.push({ kind: "lineup", key: `lineup-${m.id}`, matchId: m.id, competitionId: compOf(m) });
      for (const id of lineup.filter((x) => banned.has(x))) {
        queue.push({ kind: "banned_in_lineup", key: `banned-${m.id}-${id}`, matchId: m.id, competitionId: compOf(m), playerId: id });
      }
    }
    for (const m of mine.filter((x) => x.state === "ended_provisional")) {
      queue.push({ kind: "contest", key: `contest-${m.id}`, matchId: m.id, competitionId: compOf(m) });
    }
  }
  for (const m of (modOn("fan_vote") ? mine.filter(fanVoteOpen) : []).sort((a, b) => byKickoff(b, a)).slice(0, 1)) {
    if (!(accountId && state.fanVotes?.[m.id]?.[accountId])) queue.push({ kind: "vote", key: `vote-${m.id}`, matchId: m.id, competitionId: compOf(m) });
  }
  queue.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  const { position, row, competitionId } = tableOfTeam(derived || {}, teamId);
  return { queue, next, upcoming, recent, position, row, competitionId, banned };
}

/** On a read-only copy (a real captain or athlete, until their own writes exist) only what informs is
 *  shown: tasks that need a write (call-up, contest, votes) would lead nowhere. */
export const readOnlyQueue = (queue = []) => queue.filter((it) => it.kind === "self_suspended" || it.kind === "banned_in_lineup");
