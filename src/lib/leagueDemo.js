// PITCH Ligas — Fase 1 DEMO seed + local adapters. Everything here is
// DEMONSTRATION data: invented league, teams and athletes, stored only in
// this browser (localStorage key pitch.v2.leagueDemo). No network, no
// Supabase, no writes anywhere else. Deterministic: same seed every load,
// and "Repor exemplos" restores exactly this.
import {
  appendEvent, matchScore, standings, playerStats, discipline, transition, setOfficialMvp,
  DEMO_RULES,
} from "./core/league.js";
import { roundRobinFixtures } from "./core/standings.js";
import { computeOverall } from "./core/overall.js";

export const LEAGUE_DEMO_VERSION = 4;
export const LEAGUE_DEMO_KEY = "leagueDemo"; // usePersistentState prefix → pitch.v2.leagueDemo

export const LEAGUE = Object.freeze({
  id: "lg-demo", name: "Liga Amadora de Matosinhos", city: "Matosinhos", demo: true,
  timeZone: "Europe/Lisbon",
});

export const COMPETITION = Object.freeze({
  id: "cp-demo-2627", leagueId: LEAGUE.id,
  name: "Campeonato 2026/27", season: "2026/27", category: "Futebol 7", format: "Pontos corridos",
  kind: "league", short: "Campeonato",
  points: DEMO_RULES.points, tiebreakers: DEMO_RULES.tiebreakers,
  rounds: 5,
});

/** A league runs several competitions at once (league table + cup, ...). The
 *  Gestor sees them all; followers see the primary one (COMPETITION). */
export const CUP = Object.freeze({
  id: "cp-demo-taca", leagueId: LEAGUE.id,
  name: "Taça da Liga 2026/27", season: "2026/27", category: "Futebol 7", format: "Eliminatória",
  kind: "cup", short: "Taça", rounds: 2,
});
export const COMPETITIONS = Object.freeze([COMPETITION, CUP]);
export const competitionById = Object.fromEntries(COMPETITIONS.map((c) => [c.id, c]));

// Team kit colours are DATA (like teams.color in Rivals) — values from
// theme TEAM_COLORS.
export const TEAMS = Object.freeze([
  { id: "t1", name: "Marés FC", short: "MAR", color: "#4895FF", founded: 2019, venue: "Campo da Senhora da Hora" },
  { id: "t2", name: "Unidos de Leça", short: "ULE", color: "#C8FF00", founded: 2021, venue: "Sintético de Leça" },
  { id: "t3", name: "Perafita Rovers", short: "PER", color: "#FF9F0A", founded: 2018, venue: "Campo de Perafita" },
  { id: "t4", name: "Atlético da Marginal", short: "ATM", color: "#FF3B5C", founded: 2020, venue: "Campo da Marginal" },
  { id: "t5", name: "Real Senhora da Hora", short: "RSH", color: "#A78BFA", founded: 2017, venue: "Campo da Senhora da Hora" },
  { id: "t6", name: "Velha Guarda 1990", short: "VGU", color: "#00D08A", founded: 2016, venue: "Campo de Custóias" },
]);

const FIRST = ["Rui", "Tiago", "André", "Nuno", "Diogo", "Pedro", "Hugo", "Bruno", "Rafael", "João", "Miguel", "Tomás",
  "Gonçalo", "Ricardo", "Luís", "Fábio", "Vasco", "Filipe", "Duarte", "Sérgio", "Marco", "Paulo", "Carlos", "Henrique"];
const LAST = ["Silva", "Moreira", "Pinto", "Ferreira", "Lopes", "Carvalho", "Teixeira", "Sousa", "Ramos", "Barbosa",
  "Neves", "Coelho", "Cunha", "Faria", "Macedo", "Azevedo", "Matos", "Leite", "Correia", "Brandão", "Freitas", "Lima", "Couto"];
const SLOTS = [
  { position: "GR", number: 1, base: 4 }, { position: "DEF", number: 4, base: 4 }, { position: "DEF", number: 5, base: 5 },
  { position: "MED", number: 6, base: 5 }, { position: "MED", number: 8, base: 6 }, { position: "MED", number: 10, base: 7 },
  { position: "AVA", number: 9, base: 8 }, { position: "AVA", number: 11, base: 7 },
];

// PITCH identity per athlete (same shape the group app's FUT card uses):
// full position name, foot, nationality, age, 6 attributes, optional photo.
export const POSITION_FULL = Object.freeze({ GR: "Guarda-redes", DEF: "Defesa", MED: "Médio", AVA: "Avançado" });
const FEET = ["Direito", "Direito", "Esquerdo", "Direito", "Ambos", "Direito", "Esquerdo"];
const NATIONS = ["🇵🇹 Portugal", "🇵🇹 Portugal", "🇵🇹 Portugal", "🇧🇷 Brasil", "🇵🇹 Portugal", "🇨🇻 Cabo Verde", "🇵🇹 Portugal", "🇦🇴 Angola", "🇪🇸 Espanha"];
const OUT_KEYS = ["rit", "rem", "pas", "dri", "def", "fis"];
const GK_KEYS = ["div", "man", "kic", "ref", "spd", "pos"];
// Per-position emphasis (added to the target OVR) so cards look like their role.
const EMPHASIS = {
  GR: { div: 2, man: 1, kic: -3, ref: 3, spd: -4, pos: 1 },
  DEF: { rit: -1, rem: -8, pas: -2, dri: -5, def: 5, fis: 4 },
  MED: { rit: 0, rem: -2, pas: 4, dri: 2, def: -3, fis: -1 },
  AVA: { rit: 3, rem: 5, pas: -2, dri: 2, def: -12, fis: -2 },
};
/** Photos only for a couple of athletes; everyone else = initials (and
 *  youth athletes would ALWAYS be initials-only — owner, Fase 2). */
const PHOTOS = { t1p8: "/brand/demo-player.jpg", t4p7: "/brand/demo-player.jpg" };

function attrsFor(position, target, seed) {
  const keys = position === "GR" ? GK_KEYS : OUT_KEYS;
  return Object.fromEntries(keys.map((k, ki) => {
    const wobble = ((seed * 7 + ki * 5) % 7) - 3;
    return [k, Math.max(40, Math.min(97, target + (EMPHASIS[position][k] || 0) + wobble))];
  }));
}

export const PLAYERS = Object.freeze(TEAMS.flatMap((team, ti) => SLOTS.map((slot, si) => {
  const i = ti * SLOTS.length + si;
  const first = FIRST[(i * 5 + ti) % FIRST.length];
  const last = LAST[(i * 7 + 3) % LAST.length];
  // target OVR 63..88, deterministic; strikers/10s of a few teams reach LENDA
  const target = 63 + ((i * 11 + si * 3) % 24) + (slot.number === 10 || slot.number === 9 ? 2 : 0);
  return {
    id: `${team.id}p${si + 1}`, teamId: team.id,
    name: `${first} ${last}`,
    nick: si % 3 === 0 ? `${first} ${last[0]}.` : last,
    position: slot.position, number: slot.number, price: slot.base + ((ti + si) % 2),
    foot: FEET[i % FEET.length], nationality: NATIONS[(i * 3) % NATIONS.length], age: 19 + ((i * 7) % 20),
    attrs: attrsFor(slot.position, target, i), photo: PHOTOS[`${team.id}p${si + 1}`] || null,
  };
})));

/** Player in the shape FutCard / ComparePlayers expect (full position
 *  name, club = league team). */
export const futPlayer = (p) => ({ ...p, position: POSITION_FULL[p.position] || p.position, club: TEAMS.find((t) => t.id === p.teamId)?.name || "" });
export const ovrOfPlayer = (p) => computeOverall(POSITION_FULL[p.position], p.attrs);
export const tierOf = (ovr) => (ovr >= 86 ? "LENDA" : ovr >= 80 ? "OURO" : ovr >= 70 ? "PRATA" : "BRONZE");

/** Other contexts where a demo athlete also plays — shown SEPARATELY on
 *  the athlete page, never summed with this competition (brief §10). */
export const OTHER_CONTEXTS = Object.freeze({
  t1p8: [
    { kind: "group", label: "Grupo semanal · FC Amigos", season: "2026/27", games: 9, goals: 7, assists: 3 },
    { kind: "friendly", label: "Amigáveis da equipa · Marés FC", season: "2026/27", games: 2, goals: 1, assists: 0 },
  ],
  t1p5: [{ kind: "group", label: "Grupo semanal · Futebol de quinta", season: "2026/27", games: 6, goals: 2, assists: 4 }],
  t1p7: [{ kind: "group", label: "Grupo semanal · FC Amigos", season: "2026/27", games: 8, goals: 9, assists: 1 }],
});

/** Owner answers for Fase 2 (2026-10-16) — recorded here so the demo copy
 *  and the next phase stay aligned. No behaviour depends on them yet. */
export const PHASE2_DECISIONS = Object.freeze([
  "Cada liga terá a sua página em /league/<slug>.",
  "Na página da equipa, amigáveis e competições aparecem em separado.",
  "Homologação: pelo dono da liga e pelo gestor.",
  "Atletas menores: só iniciais (sem foto); consentimento recolhido pela liga junto dos pais.",
  "Suspensões: o PITCH sugere a partir dos cartões, o gestor confirma.",
  "Uma liga por pedido de piloto aprovado.",
]);

/** Squad captain = slot 5 (nº 8). */
export const captainOf = (teamId) => `${teamId}p5`;

/** Demo accounts per role (switching role only switches which demo
 *  account you're looking through — it never grants anything real). */
export const ROLE_ACCOUNTS = Object.freeze({
  fan: { accountId: "acc-adepto", playerId: null, teamId: null, label: "Adepto" },
  athlete: { accountId: "acc-t1p8", playerId: "t1p8", teamId: "t1", label: "Atleta" },
  captain: { accountId: "acc-t1p5", playerId: "t1p5", teamId: "t1", label: "Capitão" },
  manager: { accountId: "acc-gestor", playerId: null, teamId: null, label: "Gestor" },
});

const ROUND_DATES = ["2026-10-03", "2026-10-10", "2026-10-17"];
const KICKOFF_TIMES = ["18:00", "19:15", "20:30"];
const SEED_AT = (date, time) => `${date}T${time}:00+01:00`;

function seedMatches() {
  const all = roundRobinFixtures(TEAMS.map((t) => t.id), false);
  // 3 fixtures per round; keep the first 3 rounds for the demo
  const base = (id, competitionId, round, homeId, awayId, kickoff, referee) => ({
    id, competitionId, round, homeId, awayId, kickoff, venue: TEAMS.find((t) => t.id === homeId).venue, referee,
    state: "scheduled", history: [], lineups: {}, officialMvp: null, fanVoteClosed: false, contest: null, var: { enabled: false },
  });
  const league = all.slice(0, 9).map((f, i) => {
    const round = Math.floor(i / 3) + 1;
    return base(`m${i + 1}`, COMPETITION.id, round, f.homeId, f.awayId, SEED_AT(ROUND_DATES[round - 1], KICKOFF_TIMES[i % 3]),
      ["Árbitro: J. Correia", "Árbitro: M. Faria", "Árbitro: P. Leite"][i % 3]);
  });
  // Taça da Liga, meias-finais (round 1 = phase); the final is created once both ties are official.
  const cup = [
    { ...base("c1", CUP.id, 1, "t3", "t6", SEED_AT("2026-10-11", "11:00"), "Árbitro: M. Faria"), roundName: "Meias-finais" },
    { ...base("c2", CUP.id, 1, "t2", "t5", SEED_AT("2026-10-18", "11:00"), "Árbitro: J. Correia"), roundName: "Meias-finais" },
  ];
  return [...league, ...cup];
}

const fullSquad = (teamId) => PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id);

/** The deterministic seed. */
export function buildLeagueDemoSeed() {
  let matches = seedMatches();
  const logs = {};
  const at = (m, minute) => new Date(new Date(m.kickoff).getTime() + (minute ?? 0) * 60000).toISOString();
  const byId = (id) => matches.find((m) => m.id === id);
  let n = 0;
  const ev = (matchId, type, teamId, playerId = null, assistId = null, minute = null, extra = {}) => {
    const m = byId(matchId);
    logs[matchId] = appendEvent(logs[matchId] || [], {
      id: `seed-${matchId}-${++n}`, matchId, type, teamId, playerId, assistId, minute,
      recordedBy: "Mesa (demo)", recordedAt: at(m, minute), ...extra,
    });
    return logs[matchId][logs[matchId].length - 1].id;
  };
  const set = (id, fn) => { matches = matches.map((m) => (m.id === id ? fn(m) : m)); };
  const manager = { role: "manager", by: "Gestor (demo)" };
  const play = (id, end = "ended_provisional") => set(id, (m) => {
    let x = { ...m, lineups: { [m.homeId]: fullSquad(m.homeId), [m.awayId]: fullSquad(m.awayId) } };
    x = transition(x, "live", { ...manager, at: at(m, 0) });
    x = transition(x, "ended_provisional", { ...manager, at: at(m, 50) });
    if (end === "homologated") x = transition(x, "homologated", { ...manager, at: at(m, 60 * 26) });
    return x;
  });

  // Fixture ids come from roundRobinFixtures(t1..t6):
  // R1 m1 t1–t6 · m2 t2–t5 · m3 t3–t4 · R2 m4 t1–t5 · m5 t6–t4 · m6 t2–t3 · R3 m7 t1–t4 · m8 t5–t3 · m9 t6–t2
  // ── Round 1 — all homologated ──
  ev("m1", "goal", "t1", "t1p7", "t1p4", 12);
  const wrong = ev("m1", "goal", "t1", "t1p6", null, 38);
  ev("m1", "card_yellow", "t6", "t6p3", null, 44);
  ev("m1", "own_goal", "t1", "t6p2", null, 55); // own goal by a Velha Guarda defender → counts for Marés
  ev("m1", "goal", "t6", "t6p7", "t6p6", 60);
  // correction already in history: the 38' scorer was t1p8, not t1p6
  ev("m1", "goal", "t1", "t1p8", "t1p7", 38, {
    supersedes: wrong, voidReason: "Autor do golo corrigido após revisão da ficha de jogo com os capitães",
    recordedBy: "Gestor (demo)", recordedAt: "2026-10-04T10:12:00.000Z",
  });
  play("m1", "homologated");
  set("m1", (m) => ({ ...setOfficialMvp(m, "t1p7", { ...manager, at: "2026-10-04T10:15:00.000Z" }), fanVoteClosed: true }));
  // Marés published its Futebol 7 board for m1 (captain); nº 11 on the bench
  set("m1", (m) => ({ ...m, tactics: { t1: {
    formation: "2-3-1", by: "Marco Ramos (Capitão)", at: "2026-10-03T16:30:00.000Z",
    slots: { "gk-0": "t1p1", "def-0": "t1p2", "def-1": "t1p3", "mid-0": "t1p4", "mid-1": "t1p5", "mid-2": "t1p6", "fwd-0": "t1p7" },
  } } }));

  ev("m2", "goal", "t2", "t2p7", "t2p5", 8);
  ev("m2", "goal", "t5", null, null, 21); // scorer unknown — recorded without inventing one
  ev("m2", "card_yellow", "t2", "t2p2", null, 33);
  ev("m2", "goal", "t5", "t5p8", "t5p6", 40);
  ev("m2", "goal", "t2", "t2p8", null, 47);
  play("m2", "homologated");
  set("m2", (m) => ({ ...setOfficialMvp(m, "t5p8", manager), fanVoteClosed: true }));

  ev("m3", "goal", "t4", "t4p7", "t4p6", 17);
  ev("m3", "card_yellow", "t3", "t3p3", null, 29);
  ev("m3", "card_red", "t3", "t3p2", null, 41);
  play("m3", "homologated");
  set("m3", (m) => ({ ...setOfficialMvp(m, "t4p1", manager), fanVoteClosed: true }));

  // ── Round 2 — mixed ──
  // m4: provisional (ended, awaiting homologation; fans' vote open)
  ev("m4", "goal", "t1", "t1p7", "t1p6", 9);
  ev("m4", "card_yellow", "t1", "t1p2", null, 22);
  ev("m4", "goal", "t1", "t1p7", null, 35);
  ev("m4", "goal", "t5", "t5p7", "t5p5", 44);
  play("m4");
  // m5: homologated
  ev("m5", "goal", "t6", "t6p7", null, 14);
  ev("m5", "goal", "t4", "t4p8", "t4p7", 31);
  ev("m5", "card_yellow", "t4", "t4p3", null, 38);
  play("m5", "homologated");
  set("m5", (m) => ({ ...setOfficialMvp(m, "t4p8", manager), fanVoteClosed: true }));
  // m6: in review (contested by Perafita's captain)
  ev("m6", "goal", "t2", "t2p7", "t2p6", 11);
  ev("m6", "goal", "t3", "t3p8", "t3p7", 26);
  ev("m6", "goal", "t2", "t2p8", "t2p7", 46);
  play("m6");
  // t3p2 was sent off in m3 → left out of Perafita's m6 call-up
  set("m6", (m) => ({ ...m, lineups: { ...m.lineups, t3: m.lineups.t3.filter((id) => id !== "t3p2") } }));
  set("m6", (m) => transition(m, "in_review", {
    role: "captain", teamId: "t3", by: PLAYERS.find((p) => p.id === captainOf("t3")).name,
    at: "2026-10-10T22:40:00.000Z", reason: "O segundo golo do Unidos foi em fora de jogo — pedimos revisão",
  }));

  // ── Round 3 — scheduled; m7 has VAR switched on (state only) ──
  set("m7", (m) => ({ ...m, var: { enabled: true } }));

  // ── Taça da Liga: semi-final 1 ended (provisional, awaiting homologation), semi-final 2 scheduled ──
  ev("c1", "goal", "t3", "t3p7", "t3p6", 13);
  ev("c1", "card_yellow", "t6", "t6p4", null, 27);
  ev("c1", "goal", "t6", "t6p8", null, 34);
  ev("c1", "goal", "t3", "t3p8", "t3p7", 48);
  play("c1");

  const fanVotes = {
    m1: { "acc-x1": "t1p7", "acc-x2": "t1p8", "acc-x3": "t1p7", "acc-x4": "t6p7" },
    m4: { "acc-x1": "t1p7", "acc-x2": "t1p7", "acc-x3": "t5p7", "acc-x5": "t1p6" },
  };

  return {
    version: LEAGUE_DEMO_VERSION, matches, logs, fanVotes,
    fantasy: {}, // { [accountId]: [playerId × 5] }
    viewer: null, // { role, entered } — set by the entry screen (fan / athlete / captain / manager)
    prefs: { supportTeamId: "t1", followTeamIds: ["t1"], followPlayerIds: [], notifyResults: true, notifyCalendar: true },
    announcements: [
      { id: "a1", at: "2026-10-12T09:00:00.000Z", title: "Jornada 3 confirmada", body: "Todos os jogos da jornada 3 mantêm-se no sábado. Chegada 20 min antes para a verificação de cartões de atleta." },
      { id: "a2", at: "2026-10-05T09:00:00.000Z", title: "Jornada 1 homologada", body: "Resultados da jornada 1 homologados. Uma correção de autoria de golo registada na ficha de jogo Marés FC – Velha Guarda 1990." },
    ],
  };
}

/** Loads persisted demo state, falling back to the seed on anything odd. */
export function normalizeLeagueState(raw) {
  if (!raw || raw.version !== LEAGUE_DEMO_VERSION || !Array.isArray(raw.matches) || !raw.logs) return buildLeagueDemoSeed();
  return raw;
}

// ── Derived projections (everything recomputed from the log) ──
export const teamById = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
export const playerById = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

export function deriveLeague(state) {
  const scores = Object.fromEntries(state.matches.map((m) => [m.id, matchScore(state.logs[m.id] || [], m)]));
  const comp = { ...COMPETITION, teams: TEAMS };
  // The league table only counts the league competition; the cup has no table.
  const leagueMatches = state.matches.filter((m) => !m.competitionId || m.competitionId === COMPETITION.id);
  return {
    scores,
    table: standings(comp, leagueMatches, state.logs),
    tableProvisional: standings(comp, leagueMatches, state.logs, { includeProvisional: true }),
    stats: playerStats(state.matches, state.logs),
    statsProvisional: playerStats(state.matches, state.logs, { includeProvisional: true }),
    discipline: discipline(state.matches, state.logs, PLAYERS),
  };
}

export const matchesOfTeam = (matches, teamId) => matches.filter((m) => m.homeId === teamId || m.awayId === teamId);

/** Current round: lowest round with a match not yet official. */
export function currentRound(matches) {
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

/** Kickoff label in the competition's time zone and the UI language. */
export function fmtKickoff(iso, lang = "pt", opts = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) {
  const locale = lang === "en" ? "en-GB" : lang === "pt-br" ? "pt-BR" : "pt-PT";
  try { return new Intl.DateTimeFormat(locale, { timeZone: LEAGUE.timeZone, ...opts }).format(new Date(iso)); } catch { return iso; }
}
export const fmtDateTime = (iso, lang) => fmtKickoff(iso, lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
