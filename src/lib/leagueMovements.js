// PITCH Ligas — promotion and relegation between divisions at the end of a season.
//
// Divisions are the league-type competitions, in the order they were created: the first is the top tier. The app
// PROPOSES the movements from the final tables (the bottom `down` of each division go down, the top `down` of the one
// below come up, so sizes stay level), the Gestor confirms, removes or adds moves (every move that does not come
// straight from a table carries its reason: a withdrawal, a disqualification…), and the confirmed list is frozen in the
// season archive. "Nova época" then puts each team in its new division. Pure functions, no I/O.
import { SetupError } from "./leagueSetup.js";
import { leagueTable } from "./leagueSeason.js";

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** The divisions still open, top tier first. */
export const leagueTiers = (state) => (state.data.competitions || []).filter((c) => c.kind !== "cup" && !c.closedSeasonId);

/** Moves between each pair of adjacent divisions. `down` = how many go down (and come up), overall or per upper division id.
 *  Returns { pairs: [{upperId, lowerId, down}], moves: [{teamId, name, from, to, kind, pos, decidedBy: "table"}] }.
 *  A pair with no played games in either table proposes nothing. */
export function proposeMovements(state, { down = 2, perPair = {} } = {}) {
  const tiers = leagueTiers(state);
  const name = Object.fromEntries((state.data.teams || []).map((t) => [t.id, t.name]));
  const pairs = []; const moves = [];
  for (let i = 0; i < tiers.length - 1; i += 1) {
    const upper = tiers[i]; const lower = tiers[i + 1];
    const up = leagueTable(state, upper); const lo = leagueTable(state, lower);
    const asked = Number.isInteger(perPair[upper.id]) ? perPair[upper.id] : down;
    const n = Math.max(0, Math.min(asked, up.length - 1, lo.length - 1));
    pairs.push({ upperId: upper.id, lowerId: lower.id, down: n });
    if (!n || !up.some((r) => r.j > 0) || !lo.some((r) => r.j > 0)) continue;
    up.slice(-n).forEach((r, k) => moves.push({ teamId: r.id, name: name[r.id] || "—", from: upper.id, to: lower.id, kind: "relegated", pos: up.length - n + k + 1, decidedBy: "table" }));
    lo.slice(0, n).forEach((r, k) => moves.push({ teamId: r.id, name: name[r.id] || "—", from: lower.id, to: upper.id, kind: "promoted", pos: k + 1, decidedBy: "table" }));
  }
  return { pairs, moves };
}

/** Checks the Gestor's final list and returns it clean. Throws SetupError for an unknown team or division, a team moved
 *  twice, a team that is not in the division it leaves, or a move that did not come from a table and has no reason. */
export function normalizeMovements(state, moves = []) {
  const tiers = new Map(leagueTiers(state).map((c, i) => [c.id, { c, i }]));
  const teams = new Map((state.data.teams || []).map((t) => [t.id, t]));
  const seen = new Set(); const out = [];
  for (const m of moves) {
    const team = teams.get(m.teamId);
    if (!team) throw new SetupError("not_found", String(m.teamId));
    const from = tiers.get(m.from); const to = tiers.get(m.to);
    if (!from || !to || m.from === m.to) throw new SetupError("invalid", "movement");
    const inFrom = (from.c.teamIds || []).includes(team.id);
    if (!inFrom) throw new SetupError("invalid", "movement_team");
    if (seen.has(team.id)) throw new SetupError("invalid", "movement_twice");
    seen.add(team.id);
    const decidedBy = m.decidedBy === "table" ? "table" : "manual";
    const note = clean(m.note).slice(0, 300);
    if (decidedBy === "manual" && note.length < 5) throw new SetupError("note_required");
    out.push({ teamId: team.id, name: team.name, from: m.from, to: m.to, fromName: from.c.name, toName: to.c.name, kind: to.i < from.i ? "promoted" : "relegated", decidedBy, ...(note ? { note } : {}) });
  }
  return out;
}

/** The text the Gestor can send to the Adjunto to check the proposal against the regulation. */
export function movementsQuestion(state, moves) {
  const line = (m) => `${m.name}: ${m.kind === "promoted" ? "sobe" : "desce"} (${state.data.competitions.find((c) => c.id === m.from)?.name} → ${state.data.competitions.find((c) => c.id === m.to)?.name})`;
  return `Com base no regulamento guardado, estas subidas e descidas estão corretas? ${moves.map(line).join("; ")}. Diz-me se o regulamento prevê outro critério (playoff, desempate, desistências) e cita o artigo.`;
}
