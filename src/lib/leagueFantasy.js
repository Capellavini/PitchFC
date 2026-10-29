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
 *  `competitionId` limits it to one competition (the league table's).
 *  `official` = every non-cancelled match of the round is official (and at
 *  least one was played); only those become scored rounds. */
export function leagueRounds({ matches, logs, players, teams, competitionId = null }) {
  const pos = Object.fromEntries(players.map((p) => [p.id, p.position]));
  const teamName = (id) => teams.find((t) => t.id === id)?.name ?? id;
  const byRound = new Map();
  for (const m of matches || []) {
    // Pitch Manager follows ONE league competition (the table), never the cup's rounds.
    if (competitionId != null && (m.competitionId ?? competitionId) !== competitionId) continue;
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

/** Pitch Manager in the league: the SAME engine as the group app (core/fantasyRules.js), 5 starters + bench.
 *  Managers are accounts, not athletes. The seed below (a squad, five invented rivals, one frozen Conexão)
 *  only exists for the invented EXAMPLE league (/demo, tests) — a real league starts with no squads. */
const NO_SQUAD = Object.freeze({ player_ids: [], reserve_ids: [], captain_id: null, vice_captain_id: null, locked_player_ids: [], free_transfers: 1 });
export const LEAGUE_FANTASY = Object.freeze({
  budget: 120, squadSize: 5, startsWeeksAgo: 52,
  // the squad locked for the scored rounds, and the seed of a fresh draft
  mySquad: { player_ids: ["t4p1", "t1p4", "t1p7", "t1p8", "t5p8", "t2p5"], reserve_ids: ["t2p5"], captain_id: "t1p7", vice_captain_id: "t1p8",
    locked_player_ids: ["t4p1", "t1p4", "t1p7", "t1p8", "t5p8", "t2p5"], free_transfers: 1 },
  managers: [
    { uuid: "mgr-1", name: "Os Imparáveis", nick: "Os Imparáveis", player_ids: ["t5p8", "t4p7", "t2p7", "t6p7", "t1p5", "t3p8"], captain_id: "t5p8" },
    { uuid: "mgr-2", name: "Tropa do Gol", nick: "Tropa do Gol", player_ids: ["t1p7", "t2p8", "t4p8", "t5p7", "t3p7", "t6p6"], captain_id: "t1p7" },
    { uuid: "mgr-3", name: "Bola Murcha FC", nick: "Bola Murcha FC", player_ids: ["t4p1", "t1p1", "t2p5", "t6p3", "t3p3", "t5p6"], captain_id: "t2p5" },
    { uuid: "mgr-4", name: "Sem Rede", nick: "Sem Rede", player_ids: ["t1p8", "t5p8", "t2p7", "t4p7", "t6p7", "t3p6"], captain_id: "t1p8" },
    { uuid: "mgr-5", name: "Capitães da Marginal", nick: "Capitães da Marginal", player_ids: ["t1p7", "t6p7", "t4p7", "t5p7", "t2p8", "t3p8"], captain_id: "t6p7" },
  ],
  // Conexão da Rodada: froze Marés' 9 → 11 for round 1 (the corrected 38' goal)
  connection: { fromDayId: "round-1", locked: { "round-1": { creator: "t1p7", finisher: "t1p8" } } },
});

/** LEAGUE_FANTASY when every seeded athlete exists in this league (the example league), otherwise the same
 *  rules with an empty draft, no rivals and no frozen Conexão. */
export function leagueFantasySeed(players) {
  const have = new Set((players || []).map((p) => p.id));
  const ids = [LEAGUE_FANTASY.mySquad.player_ids, ...LEAGUE_FANTASY.managers.map((m) => m.player_ids)].flat();
  return ids.every((id) => have.has(id)) ? LEAGUE_FANTASY : { ...LEAGUE_FANTASY, mySquad: NO_SQUAD, managers: [], connection: null };
}
