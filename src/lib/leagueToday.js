// "Hoje" do Gestor — the league organizer's work queue. Pure: derives what
// needs the organizer now from the league state; no I/O, no writes.
import { currentRound } from "./leagueDemo.js";
import { scheduleConflicts } from "./leagueOperations.js";

const OFFICIAL = new Set(["homologated", "walkover"]);
const isOfficial = (m) => OFFICIAL.has(m.state);

/** Urgency order: contest → homologate → live → suspended → lineup → conflict. */
const ORDER = ["contest", "homologate", "live", "suspended", "lineup", "conflict"];

/**
 * @param {{matches: object[]}} state   league demo state
 * @param {{discipline: object}} derived deriveLeague(state)
 * @param {{duration?: number}} opts     match duration for calendar conflicts (min)
 * @returns {{round:number,total:number,official:number,done:boolean,items:object[]}}
 */
export function leagueToday(state, derived, { duration = 60 } = {}) {
  const matches = state.matches || [];
  if (!matches.length) return { round: 0, total: 0, official: 0, done: false, items: [] };
  const round = currentRound(matches);
  const roundMatches = matches.filter((m) => m.round === round);
  const official = roundMatches.filter(isOfficial).length;
  const banned = new Set(Object.values(derived?.discipline || {}).filter((d) => d.pending > 0).map((d) => d.playerId));
  const items = [];

  for (const m of roundMatches) {
    if (m.state === "in_review") items.push({ kind: "contest", key: `contest-${m.id}`, matchId: m.id, reason: m.contest?.reason || null });
    if (m.state === "ended_provisional") items.push({ kind: "homologate", key: `homologate-${m.id}`, matchId: m.id });
    if (m.state === "live") items.push({ kind: "live", key: `live-${m.id}`, matchId: m.id });
    if (m.state === "scheduled") {
      for (const teamId of [m.homeId, m.awayId]) {
        const lineup = m.lineups?.[teamId] || [];
        if (!lineup.length) items.push({ kind: "lineup", key: `lineup-${m.id}-${teamId}`, matchId: m.id, teamId });
        for (const playerId of lineup.filter((id) => banned.has(id))) {
          items.push({ kind: "suspended", key: `suspended-${m.id}-${playerId}`, matchId: m.id, teamId, playerId });
        }
      }
    }
  }

  const upcoming = matches.filter((m) => m.state === "scheduled");
  for (const c of scheduleConflicts(upcoming, duration, 0)) {
    // rest between a team's games is the calendar's concern only when it overlaps in time
    if (c.kind === "rest") continue;
    items.push({ kind: "conflict", key: `conflict-${c.ids.join("-")}-${c.kind}`, matchIds: c.ids, text: c.text });
  }

  items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return { round, total: roundMatches.length, official, done: roundMatches.length > 0 && official === roundMatches.length, items };
}

/** WhatsApp-ready recap of a finished round: official results only. */
export function roundRecapText({ round, matches, scores, teamById, leagueName }) {
  const rows = matches.filter((m) => m.round === round && isOfficial(m));
  if (!rows.length) return "";
  const line = (m) => `${teamById[m.homeId]?.name || "—"} ${scores[m.id]?.home ?? "—"}–${scores[m.id]?.away ?? "—"} ${teamById[m.awayId]?.name || "—"}`;
  return `${leagueName} · Jornada ${round}\n\n${rows.map(line).join("\n")}`;
}
