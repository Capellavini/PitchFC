// Treinador Adjunto — team proposals (decision 3/4/5/6). Pure: draw,
// edit, roster diffs and the validation card text. Every number on the
// card comes from core (ovrOf / teamOvr / teamInsights), never from a model.
//
// Players are core-shaped: { id: hashId(uuid), uuid, nick, name, position,
// attrs, ratingsCount, … } — teams[].players hold the hashed ids, exactly
// like the app writes games.teams.
import { drawTeams, applySwap, separatePair, teamOvr, balanceTeams } from "../core/teamDraw.js";
import { teamInsights, displayOvr } from "../core/insights.js";
import { POSITION_ABBR, TEAM_NAMES, TEAM_PALETTE } from "../core/overall.js";
import { resolveNick } from "./commands.js";
import { T } from "./texts.js";

const COLOR_EMOJI = { "#C8FF00": "🟢", "#4895FF": "🔵", "#FF9F0A": "🟠", "#A78BFA": "🟣", "#FF6B9D": "🩷", "#2DD4BF": "🩵" };

/** Is `teams` a usable draft for exactly these players? */
export function validDraft(teams, players) {
  if (!Array.isArray(teams) || teams.length < 2) return false;
  const ids = new Set(players.map((p) => p.id));
  const used = teams.flatMap((t) => t?.players ?? []);
  return used.length === ids.size && new Set(used).size === used.length && used.every((id) => ids.has(id));
}

/** The proposal's teams: the app's own draft when it fits the playing
 *  roster (validate it, don't redraw — plan §8.3), else a fresh draw. */
export function proposeTeams({ players, numTeams = 2, appTeams = null, rng = Math.random }) {
  if (validDraft(appTeams, players)) return { teams: appTeams, fromApp: true };
  return { teams: drawTeams(players, numTeams, { rng, balance: "ovr" }), fromApp: false };
}

/** Apply a parsed team command (commands.parseTeamsCommand). Returns
 *  { teams } or { error: "unknown"|"ambiguous"|"same", ref, options }. */
export function applyTeamsCommand(teams, cmd, players, { rng = Math.random } = {}) {
  const onTeams = players.filter((p) => teams.some((t) => t.players.includes(p.id)));
  const byId = new Map(players.map((p) => [p.id, p]));
  const pick = (ref) => {
    const r = resolveNick(ref, onTeams);
    if (r.player) return { id: r.player.id };
    if (r.ambiguous) return { error: "ambiguous", ref, options: r.ambiguous };
    return { error: "unknown", ref };
  };
  if (cmd.type === "redraw") {
    const n = cmd.numTeams ? Math.max(2, Math.min(6, cmd.numTeams)) : teams.length;
    return { teams: drawTeams(onTeams, n, { rng, balance: "ovr" }) };
  }
  if (cmd.type === "swap" || cmd.type === "separate") {
    const a = pick(cmd.a); if (a.error) return a;
    const b = pick(cmd.b); if (b.error) return b;
    if (a.id === b.id) return { error: "same", ref: cmd.a };
    if (cmd.type === "swap") return { teams: applySwap(teams, a.id, b.id) };
    return { teams: separatePair(teams, a.id, b.id, byId) };
  }
  if (cmd.type === "move") {
    const a = pick(cmd.player); if (a.error) return a;
    const to = cmd.team - 1;
    if (to < 0 || to >= teams.length) return { error: "unknown", ref: String(cmd.team) };
    return { teams: teams.map((t, i) => ({ ...t, players: i === to ? [...t.players.filter((x) => x !== a.id), a.id] : t.players.filter((x) => x !== a.id) })) };
  }
  return { error: "unknown", ref: "" };
}

/** Who left / who came in, by uuid lists. */
export function rosterDiff(oldUuids = [], newUuids = []) {
  const o = new Set(oldUuids), n = new Set(newUuids);
  return { out: oldUuids.filter((u) => !n.has(u)), in: newUuids.filter((u) => !o.has(u)) };
}

/** Adjust teams to a new roster: each newcomer takes a leaver's slot (same
 *  position preferred); remaining newcomers go to the smallest team;
 *  remaining leavers are just removed; then a light same-position
 *  rebalance. players: the NEW playing roster. */
export function adjustTeams(teams, diff, oldPlayersByUuid, players) {
  const idOf = (uuid, list) => list.find((p) => p.uuid === uuid)?.id;
  const posOf = (uuid) => oldPlayersByUuid.get(uuid)?.position ?? players.find((p) => p.uuid === uuid)?.position;
  let next = teams.map((t) => ({ ...t, players: [...t.players] }));
  const comers = [...diff.in];
  for (const leaver of diff.out) {
    const lid = oldPlayersByUuid.get(leaver)?.id;
    const ti = next.findIndex((t) => t.players.includes(lid));
    if (ti < 0) continue;
    const ci = comers.findIndex((u) => posOf(u) === posOf(leaver));
    const take = ci >= 0 ? comers.splice(ci, 1)[0] : comers.shift();
    next[ti].players = next[ti].players.flatMap((x) => (x === lid ? (take ? [idOf(take, players)] : []) : [x]));
  }
  for (const u of comers) {
    const small = next.reduce((a, t, i) => (t.players.length < next[a].players.length ? i : a), 0);
    next[small].players.push(idOf(u, players));
  }
  const byId = new Map(players.map((p) => [p.id, p]));
  next = next.map((t) => ({ ...t, players: t.players.filter((id) => byId.has(id)) }));
  return balanceTeams(next, byId);
}

const ovrLabel = (p) => { const { ovr, rated } = displayOvr(p); return `${ovr}${rated ? "" : "?"}`; };

/** The validation card (DM only — has OVRs and insights). */
export function renderTeamsCard({ teams, players, summaries = [], lang = "pt", confirmed, spots, fromApp = false }) {
  const t = T(lang).teams;
  const byId = new Map(players.map((p) => [p.id, p]));
  const lines = [fromApp ? t.appDraft : t.header(confirmed, spots)];
  teams.forEach((team, i) => {
    const ovr = teamOvr(team, byId);
    const emoji = COLOR_EMOJI[team.color] ?? COLOR_EMOJI[TEAM_PALETTE[i]] ?? "⚪";
    lines.push(`${emoji} *${team.name ?? TEAM_NAMES[i]}* — OVR ${ovr == null ? "—" : Math.round(ovr)}`);
    const ps = team.players.map((id) => byId.get(id)).filter(Boolean)
      .sort((a, b) => (b.position === "Guarda-redes") - (a.position === "Guarda-redes") || displayOvr(b).ovr - displayOvr(a).ovr);
    lines.push(ps.map((p) => `${p.nick}${p.position === "Guarda-redes" ? ` (${POSITION_ABBR["Guarda-redes"]})` : ""} ${ovrLabel(p)}`).join(" · ") || "—");
  });
  const nick = (id) => byId.get(id)?.nick ?? "?";
  const teamName = (tid) => teams.find((x) => x.id === tid)?.name ?? tid;
  for (const ins of teamInsights(teams, byId, summaries)) {
    if (ins.kind === "together") lines.push(t.together(nick(ins.a), nick(ins.b), ins.wins, ins.games));
    else if (ins.kind === "hot") lines.push(t.hot(nick(ins.id)));
    else if (ins.kind === "gk_missing") lines.push(t.gkMissing(teamName(ins.teamId)));
    else if (ins.kind === "ovr_gap" && teams.length >= 2) lines.push(t.spread(String(ins.spread).replace(".", lang === "en" ? "." : ",")));
  }
  lines.push(t.footer);
  return lines.join("\n");
}

/** Group-safe lineup: team names + nicks only (decision 5). */
export function lineup(teams, players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return teams.map((t, i) => ({ name: String(t.name ?? TEAM_NAMES[i]), nicks: t.players.map((id) => byId.get(id)?.nick).filter(Boolean).map(String) }));
}
