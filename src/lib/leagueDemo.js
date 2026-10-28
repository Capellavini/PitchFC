// PITCH Ligas — the league the app is looking at. The state of a league
// (identity, competitions, teams, athletes, matches, event logs, modules)
// lives in `state`; the exports below are a registry that mirrors the data of
// the state last passed to `installLeagueData` / `normalizeLeagueState`, so
// screens can keep reading `TEAMS`, `teamById`, `COMPETITION`... as live
// bindings. Nothing here is invented: a new league is EMPTY. The invented
// example league lives in leagueExample.js (tests and presentation mode).
import { matchScore, standings, playerStats, discipline, DEMO_RULES } from "./core/league.js";
import { computeOverall } from "./core/overall.js";
import { presentationMode } from "./presentation.js";
import { buildExampleState } from "./leagueExample.js";
import { defaultModules, normalizeModules, moduleOn } from "./leagueModules.js";

export const LEAGUE_DEMO_VERSION = 5;
export const LEAGUE_DEMO_KEY = "leagueDemo"; // usePersistentState prefix → pitch.v2.leagueDemo

export const POSITION_FULL = Object.freeze({ GR: "Guarda-redes", DEF: "Defesa", MED: "Médio", AVA: "Avançado" });
export const LEAGUE_NAME_FALLBACK = "A tua liga";

const placeholderCompetition = (kind) => Object.freeze({
  id: `__no_${kind}__`, name: "", short: "", season: "", category: "", format: "", kind, rounds: 0, teamIds: [],
  points: DEMO_RULES.points, tiebreakers: DEMO_RULES.tiebreakers, placeholder: true,
});
const NO_COMPETITION = placeholderCompetition("league");
const NO_CUP = placeholderCompetition("cup");

// ── The registry (live bindings, replaced by installLeagueData) ──
export let LEAGUE = Object.freeze({ id: "", name: LEAGUE_NAME_FALLBACK, named: false, city: "", timeZone: "Europe/Lisbon" });
export let COMPETITIONS = Object.freeze([]);
export let COMPETITION = NO_COMPETITION; // the first league (table) competition
export let CUP = NO_CUP; // the first cup competition
export let TEAMS = Object.freeze([]);
export let PLAYERS = Object.freeze([]);
export let competitionById = Object.freeze({});
export let teamById = Object.freeze({});
export let playerById = Object.freeze({});
const BASE_ACCOUNTS = {
  fan: { accountId: "acc-adepto", playerId: null, teamId: null, label: "Adepto" },
  manager: { accountId: "acc-gestor", playerId: null, teamId: null, label: "Gestor" },
};
export let ROLE_ACCOUNTS = Object.freeze({ ...BASE_ACCOUNTS });

/** The league's optional modules (see leagueModules.js), mirrored like the data. */
let MODS = defaultModules();
export const modOn = (id) => moduleOn(MODS, id);

const firstTeamPlayers = (teams, players) => players.filter((p) => p.teamId === teams[0]?.id);

/** Replace the registry with a league's data. Idempotent. */
export function installLeagueData(data = {}, modules = null) {
  MODS = normalizeModules(modules);
  const league = data.league || {};
  LEAGUE = Object.freeze({ timeZone: "Europe/Lisbon", city: "", ...league, name: league.name || LEAGUE_NAME_FALLBACK, named: Boolean(league.name) });
  TEAMS = Object.freeze([...(data.teams || [])]);
  PLAYERS = Object.freeze([...(data.players || [])]);
  COMPETITIONS = Object.freeze((data.competitions || []).map((c) => Object.freeze({
    points: DEMO_RULES.points, tiebreakers: DEMO_RULES.tiebreakers, teamIds: [], ...c,
  })));
  COMPETITION = COMPETITIONS.find((c) => c.kind !== "cup") || NO_COMPETITION;
  CUP = COMPETITIONS.find((c) => c.kind === "cup") || NO_CUP;
  competitionById = Object.freeze(Object.fromEntries(COMPETITIONS.map((c) => [c.id, c])));
  teamById = Object.freeze(Object.fromEntries(TEAMS.map((t) => [t.id, t])));
  playerById = Object.freeze(Object.fromEntries(PLAYERS.map((p) => [p.id, p])));
  // "Ver como": the accounts a Gestor can look through, taken from the first
  // team. A role without anyone to look through is left out.
  const squad = firstTeamPlayers(TEAMS, PLAYERS);
  const captain = squad.find((p) => p.captain) || squad[0] || null;
  const athlete = squad.find((p) => p.id !== captain?.id) || captain;
  ROLE_ACCOUNTS = Object.freeze({
    ...BASE_ACCOUNTS,
    ...(athlete ? { athlete: { accountId: `acc-${athlete.id}`, playerId: athlete.id, teamId: athlete.teamId, label: "Atleta" } } : {}),
    ...(captain ? { captain: { accountId: `acc-${captain.id}`, playerId: captain.id, teamId: captain.teamId, label: "Capitão" } } : {}),
  });
}

/** Competition title as shown to people: with the sponsors module on, the title
 *  sponsor leads ("Liga X · 1.ª Divisão"). */
export const competitionTitle = (c) => (c && c.sponsor && modOn("sponsors") ? `${c.sponsor} · ${c.name}` : (c?.name || ""));

/** Squad captain of a team: the flagged player, else the first. */
export const captainOf = (teamId) => {
  const squad = PLAYERS.filter((p) => p.teamId === teamId);
  return (squad.find((p) => p.captain) || squad[0] || {}).id || null;
};

/** Player in the shape FutCard / ComparePlayers expect (full position
 *  name, club = league team). */
export const futPlayer = (p) => ({ ...p, position: POSITION_FULL[p.position] || p.position, club: teamById[p.teamId]?.name || "" });
export const ovrOfPlayer = (p) => computeOverall(POSITION_FULL[p.position], p.attrs);
export const tierOf = (ovr) => (ovr >= 86 ? "LENDA" : ovr >= 80 ? "OURO" : ovr >= 70 ? "PRATA" : "BRONZE");

/** Owner answers for Fase 2 (2026-10-16) — recorded here so the copy and the
 *  next phase stay aligned. No behaviour depends on them yet. */
export const PHASE2_DECISIONS = Object.freeze([
  "Cada liga terá a sua página em /league/<slug>.",
  "Na página da equipa, amigáveis e competições aparecem em separado.",
  "Homologação: pelo dono da liga e pelo gestor.",
  "Atletas menores: só iniciais (sem foto); consentimento recolhido pela liga junto dos pais.",
  "Suspensões: o PITCH sugere a partir dos cartões, o gestor confirma.",
  "Uma liga por pedido de piloto aprovado.",
]);

// ── State ──
/** A brand-new league: nothing in it, the organizer is the only viewer. */
export function emptyLeagueState() {
  return {
    version: LEAGUE_DEMO_VERSION,
    data: { league: { id: "lg-local", name: "", city: "", timeZone: "Europe/Lisbon" }, competitions: [], teams: [], players: [] },
    modules: defaultModules(),
    matches: [], logs: {}, fanVotes: {}, fantasy: {},
    viewer: { role: "manager", entered: true },
    prefs: { supportTeamId: null, followTeamIds: [], followPlayerIds: [], notifyResults: true, notifyCalendar: true },
    announcements: [],
  };
}

/** The invented example league (tests and /demo only). Installs it. */
export function loadExample() {
  const state = buildExampleState();
  installLeagueData(state.data, state.modules);
  return state;
}

/** Loads persisted state and mirrors its data into the registry. Anything
 *  odd falls back to an EMPTY league — or, in presentation mode only, the
 *  example. */
export function normalizeLeagueState(raw) {
  const ok = raw && raw.version === LEAGUE_DEMO_VERSION && Array.isArray(raw.matches) && raw.logs && raw.data;
  const state = ok ? { ...raw, modules: normalizeModules(raw.modules) } : (presentationMode ? buildExampleState() : emptyLeagueState());
  installLeagueData(state.data, state.modules);
  return state;
}

// ── Derived projections (everything recomputed from the log) ──
/** `tables[competitionId]` for every league-kind competition; `table` is the
 *  first one (the primary competition) for screens that show a single table. */
export function deriveLeague(state) {
  const d = state.data || {};
  const competitions = d.competitions || [];
  const teams = d.teams || [];
  const players = d.players || [];
  const byTeam = Object.fromEntries(teams.map((t) => [t.id, t]));
  const primary = competitions.find((c) => c.kind !== "cup");
  const scores = Object.fromEntries(state.matches.map((m) => [m.id, matchScore(state.logs[m.id] || [], m)]));
  const tables = {}; const tablesProvisional = {};
  for (const c of competitions) {
    if (c.kind === "cup") continue; // a cup has no table: its "classificação" is the bracket
    const own = state.matches.filter((m) => (m.competitionId || primary?.id) === c.id);
    const ids = c.teamIds?.length ? c.teamIds : teams.map((t) => t.id);
    const comp = { points: DEMO_RULES.points, tiebreakers: DEMO_RULES.tiebreakers, ...c, teams: ids.map((id) => byTeam[id]).filter(Boolean) };
    tables[c.id] = standings(comp, own, state.logs);
    tablesProvisional[c.id] = standings(comp, own, state.logs, { includeProvisional: true });
  }
  return {
    scores,
    tables, tablesProvisional,
    table: (primary && tables[primary.id]) || [],
    tableProvisional: (primary && tablesProvisional[primary.id]) || [],
    stats: playerStats(state.matches, state.logs),
    statsProvisional: playerStats(state.matches, state.logs, { includeProvisional: true }),
    discipline: discipline(state.matches, state.logs, players),
  };
}

/** The table (rows) that holds a team, with its provisional twin. */
export function tableOfTeam(derived, teamId, { provisional = false } = {}) {
  const source = provisional ? derived.tablesProvisional : derived.tables;
  for (const [competitionId, rows] of Object.entries(source || {})) {
    const position = rows.findIndex((r) => r.id === teamId);
    if (position >= 0) return { competitionId, rows, position, row: rows[position] };
  }
  return { competitionId: null, rows: [], position: -1, row: null };
}

export const matchesOfTeam = (matches, teamId) => matches.filter((m) => m.homeId === teamId || m.awayId === teamId);

/** Current round: lowest round with a match not yet official (0 = no matches). */
export function currentRound(matches) {
  if (!matches.length) return 0;
  const open = matches.filter((m) => !["homologated", "walkover", "cancelled"].includes(m.state));
  return open.length ? Math.min(...open.map((m) => m.round)) : Math.max(...matches.map((m) => m.round));
}

let idCounter = 0;
/** Event id minted when the composer OPENS, so a double submit / resend
 *  of the same form reuses it and the log stays idempotent. */
export function newEventId(matchId) {
  idCounter += 1;
  const rnd = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `${Date.now().toString(36)}${idCounter}`;
  return `ev-${matchId}-${rnd}`;
}

/** Kickoff label in the league's time zone and the UI language. */
export function fmtKickoff(iso, lang = "pt", opts = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) {
  const locale = lang === "en" ? "en-GB" : lang === "pt-br" ? "pt-BR" : "pt-PT";
  try { return new Intl.DateTimeFormat(locale, { timeZone: LEAGUE.timeZone, ...opts }).format(new Date(iso)); } catch { return iso; }
}
export const fmtDateTime = (iso, lang) => fmtKickoff(iso, lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
