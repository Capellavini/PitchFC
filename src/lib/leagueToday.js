// "Hoje" do Gestor — the league organizer's work queue across every
// competition the league runs (league table, cup, ...). Pure: derives what
// needs the organizer now from the league state; no I/O, no writes.
import { COMPETITION, COMPETITIONS, currentRound } from "./leagueDemo.js";
import { scheduleConflicts } from "./leagueOperations.js";

const OFFICIAL = new Set(["homologated", "walkover"]);
const isOfficial = (m) => OFFICIAL.has(m.state);
const compOf = (m) => m.competitionId || COMPETITION.id;

/** Urgency order: contest → homologate → live → suspended → lineup → conflict. */
const ORDER = ["contest", "homologate", "live", "suspended", "lineup", "conflict"];

/**
 * @param {{matches: object[]}} state   league demo state
 * @param {{discipline: object}} derived deriveLeague(state)
 * @param {{duration?: number, scope?: string}} opts match duration for calendar
 *   conflicts (min); scope = "all" or a competition id.
 * @returns {{sections: object[], items: object[], total: number, official: number, done: boolean}}
 *   sections: one per competition with matches → { competition, round, label,
 *   total, official, done, items }. items: the merged queue, most urgent first.
 */
export function leagueToday(state, derived, { duration = 60, scope = "all" } = {}) {
  const matches = state.matches || [];
  const banned = new Set(Object.values(derived?.discipline || {}).filter((d) => d.pending > 0).map((d) => d.playerId));
  const sections = [];

  for (const competition of COMPETITIONS) {
    if (scope !== "all" && scope !== competition.id) continue;
    const own = matches.filter((m) => compOf(m) === competition.id);
    if (!own.length) continue;
    const round = currentRound(own);
    const roundMatches = own.filter((m) => m.round === round);
    const items = [];
    const tag = { competitionId: competition.id };
    // A result that needs a decision (or a game on right now) is work whatever
    // its round: a catch-up game of round 3 played while round 2 is still open
    // must not hide in the queue.
    for (const m of own) {
      if (m.state === "in_review") items.push({ ...tag, kind: "contest", key: `contest-${m.id}`, matchId: m.id, reason: m.contest?.reason || null });
      if (m.state === "ended_provisional") items.push({ ...tag, kind: "homologate", key: `homologate-${m.id}`, matchId: m.id });
      if (m.state === "live") items.push({ ...tag, kind: "live", key: `live-${m.id}`, matchId: m.id });
    }
    // Call-ups and suspended players are about the games still to be played in the current round.
    for (const m of roundMatches) {
      if (m.state === "scheduled") {
        for (const teamId of [m.homeId, m.awayId]) {
          const lineup = m.lineups?.[teamId] || [];
          if (!lineup.length) items.push({ ...tag, kind: "lineup", key: `lineup-${m.id}-${teamId}`, matchId: m.id, teamId });
          for (const playerId of lineup.filter((id) => banned.has(id))) {
            items.push({ ...tag, kind: "suspended", key: `suspended-${m.id}-${playerId}`, matchId: m.id, teamId, playerId });
          }
        }
      }
    }
    const official = roundMatches.filter(isOfficial).length;
    sections.push({
      competition, round, roundName: roundMatches.find((m) => m.roundName)?.roundName || null,
      total: roundMatches.length, official, done: roundMatches.length > 0 && official === roundMatches.length, items,
    });
  }

  // Calendar conflicts cut across competitions: a cup tie can clash with a league game.
  const upcoming = matches.filter((m) => m.state === "scheduled" && (scope === "all" || compOf(m) === scope));
  const conflicts = [];
  for (const c of scheduleConflicts(upcoming, duration, 0)) {
    if (c.kind === "rest") continue; // rest between a team's games matters only when it overlaps in time
    conflicts.push({ kind: "conflict", key: `conflict-${c.ids.join("-")}-${c.kind}`, competitionId: compOf(upcoming.find((m) => m.id === c.ids[0])), matchIds: c.ids, text: c.text });
  }

  const items = [...sections.flatMap((s) => s.items), ...conflicts]
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const total = sections.reduce((n, s) => n + s.total, 0);
  const official = sections.reduce((n, s) => n + s.official, 0);
  return { sections, items, total, official, done: total > 0 && official === total };
}

/** WhatsApp-ready recap of a finished round: official results only. */
export function roundRecapText({ round, matches, scores, teamById, leagueName, competitionId = null, label = null }) {
  const rows = matches.filter((m) => m.round === round && isOfficial(m) && (!competitionId || compOf(m) === competitionId));
  if (!rows.length) return "";
  const line = (m) => `${teamById[m.homeId]?.name || "—"} ${scores[m.id]?.home ?? "—"}–${scores[m.id]?.away ?? "—"} ${teamById[m.awayId]?.name || "—"}`;
  return `${leagueName} · ${label || `Jornada ${round}`}\n\n${rows.map(line).join("\n")}`;
}
