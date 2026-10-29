// Pitch Manager in the Ligas app: the SAME engine as the group's Pitch Manager
// (src/lib/core/fantasyRules.js — scoreLineup, prices by form, ownership cap,
// transfers, Conexão), fed with league data. This file is only the adapter:
// league matches + append-only event logs + athletes → the "night summary"
// the engine already understands ({ teamResults, matches[].events, lines }).
//
// What maps, what doesn't (rules stay Pitch Manager's, not the old preview's):
//  - one league ROUND = one Pitch Manager round; it only SCORES when every
//    match of the round is official (homologated/walkover) — a provisional or
//    in-review match keeps the round open, like standings do;
//  - events come from activeEvents() (corrections/voids already applied) and
//    keep their stable league ids, so the Conexão is auditable out of the box;
//  - goal → goal (+assist), own_goal → og (credited to the benefiting side),
//    shootout_goal / cards / subs are not Pitch Manager events and are left out;
//  - walkovers have no game to score; unknown scorers (`playerId` null) stay an
//    event without author — never invented;
//  - the league's fans' vote never scores and the per-match "craque oficial"
//    isn't a round podium, so no MVP points yet (documented gap).
import { activeEvents, matchScore, OFFICIAL_STATES } from "./core/league.js";
import { POSITION_FULL } from "./leagueDemo.js";

const kickoffOrder = (a, b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")) || String(a.id).localeCompare(String(b.id));

/** League rounds as engine rounds, ascending.
 *  → [{ round, id, kickoffAt, playedOn, official, matchIds, summary }]
 *  `official` = every non-cancelled match of the round is official (and at
 *  least one was played); only those become scored rounds. */
export function leagueRounds({ matches, logs, players, teams }) {
  const pos = Object.fromEntries(players.map((p) => [p.id, p.position]));
  const teamName = (id) => teams.find((t) => t.id === id)?.name ?? id;
  const byRound = new Map();
  for (const m of matches || []) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round).push(m);
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, all]) => {
    const ordered = [...all].sort(kickoffOrder);
    const live = ordered.filter((m) => m.state !== "cancelled");
    const played = live.filter((m) => OFFICIAL_STATES.has(m.state) && m.state !== "walkover");
    const official = live.length > 0 && live.every((m) => OFFICIAL_STATES.has(m.state)) && played.length > 0;
    const lines = {};
    const line = (id) => (lines[id] ||= { key: id, goals: 0, assists: 0 });
    const gameList = played.map((m, i) => {
      const log = logs?.[m.id] || [];
      const score = matchScore(log, m);
      const gk = (teamId) => (m.lineups?.[teamId] || []).find((id) => pos[id] === "GR") ?? null;
      const events = [];
      for (const e of activeEvents(log)) {
        const side = e.teamId === m.homeId ? "h" : e.teamId === m.awayId ? "a" : null;
        if (!side) continue;
        if (e.type === "goal") {
          events.push({ id: e.id, side, type: "goal", by: e.playerId ?? null, ...(e.assistId ? { ast: e.assistId } : {}), min: e.minute ?? null });
          if (e.playerId) line(e.playerId).goals++;
          if (e.assistId) line(e.assistId).assists++;
        } else if (e.type === "own_goal" && e.playerId) {
          events.push({ id: e.id, side, type: "og", by: e.playerId, min: e.minute ?? null });
        }
      }
      return {
        n: i + 1, homeName: teamName(m.homeId), awayName: teamName(m.awayId), homeGoals: score.home, awayGoals: score.away,
        homeGk: gk(m.homeId), awayGk: gk(m.awayId), events,
      };
    });
    const teamResults = played.flatMap((m) => [m.homeId, m.awayId].map((id) => ({ name: teamName(id), players: m.lineups?.[id] || [] })));
    const first = ordered[0];
    return {
      round, id: `round-${round}`, kickoffAt: new Date(first?.kickoff ?? 0).toISOString(), playedOn: String(first?.kickoff || "").slice(0, 10),
      official, matchIds: played.map((m) => m.id),
      summary: { teamResults, matches: gameList, lines: Object.values(lines), candidates: [] },
    };
  });
}

/** Athletes in the shape the Pitch Manager UI reads (full position name,
 *  `uuid`, the league team as club), plus the league's own totals. */
export function fantasyAthletes(players, teams, stats = {}) {
  const team = Object.fromEntries(teams.map((t) => [t.id, t]));
  return players.map((p) => ({
    ...p, uuid: p.id, position: POSITION_FULL[p.position] || p.position, club: team[p.teamId]?.name || "", teamShort: team[p.teamId]?.short || "",
    goals: stats[p.id]?.goals || 0, assists: stats[p.id]?.assists || 0, mvps: stats[p.id]?.mvps || 0, gamesPlayed: stats[p.id]?.games || 0,
  }));
}
