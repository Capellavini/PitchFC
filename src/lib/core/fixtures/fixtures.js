// Shared test fixtures for src/lib/core/*.test.js. Not synced to wa-bot
// (sync-core only copies the top-level core modules).

const goal = (teamId, scorerId, extra = {}) => ({ teamId, scorerId, ...extra });
const save = (teamId, playerId) => ({ teamId, type: "epicSave", playerId });

export const TEAM_IDS_3 = ["t1", "t2", "t3"];
export const TEAM_IDS_4 = ["t1", "t2", "t3", "t4"];
export const TEAMS_3 = [
  { id: "t1", name: "Coletes", color: "#C8FF00", players: [1, 2, 3] },
  { id: "t2", name: "Sem coletes", color: "#4895FF", players: [4, 5, 6] },
  { id: "t3", name: "Equipa 3", color: "#FF9F0A", players: [7, 8, 9] },
];
export const TEAMS_4 = [...TEAMS_3, { id: "t4", name: "Equipa 4", color: "#A78BFA", players: [10, 11] }];

/** Named match sets for standings regression. */
export const MATCH_SETS = {
  empty: [],
  simple: [
    { id: 1, n: 1, homeId: "t1", awayId: "t2", events: [goal("t1", 1), goal("t1", 2), goal("t2", 4)] },
    { id: 2, n: 2, homeId: "t2", awayId: "t3", events: [goal("t3", 7)] },
    { id: 3, n: 3, homeId: "t3", awayId: "t1", events: [] },
  ],
  // saves never count as goals; own goals credit the benefiting team
  savesAndOwnGoals: [
    { id: 1, n: 1, homeId: "t1", awayId: "t2", events: [save("t1", 3), save("t2", 4), goal("t2", 1, { ownGoal: true }), goal("t1", 2)] },
    { id: 2, n: 2, homeId: "t2", awayId: "t3", events: [goal("t2", 5, { assistId: 6 }), save("t3", 9)] },
    { id: 3, n: 3, homeId: "t3", awayId: "t1", events: [goal("t3", 8), goal("t1", 1)] },
  ],
  // all level on points — gd then gf decide
  gdGfTiebreak: [
    { id: 1, n: 1, homeId: "t1", awayId: "t2", events: [goal("t1", 1), goal("t1", 1), goal("t1", 1), goal("t2", 4)] },
    { id: 2, n: 2, homeId: "t2", awayId: "t3", events: [goal("t2", 4), goal("t2", 4)] },
    { id: 3, n: 3, homeId: "t3", awayId: "t1", events: [goal("t3", 7), goal("t3", 7), goal("t3", 7), goal("t1", 2)] },
  ],
  // total deadlock — insertion order must be preserved (stable sort)
  deadlock: [
    { id: 1, n: 1, homeId: "t1", awayId: "t2", events: [goal("t1", 1), goal("t2", 4)] },
    { id: 2, n: 2, homeId: "t2", awayId: "t3", events: [goal("t2", 4), goal("t3", 7)] },
    { id: 3, n: 3, homeId: "t3", awayId: "t1", events: [goal("t3", 7), goal("t1", 1)] },
  ],
  // unknown team ids are ignored
  unknownTeam: [
    { id: 1, n: 1, homeId: "t1", awayId: "tX", events: [goal("t1", 1)] },
    { id: 2, n: 2, homeId: "t3", awayId: "t2", events: [goal("t2", 4)] },
  ],
  // personalizado: group stage + bye + playoff — matchdayLive.standings
  // must skip stage "playoff" and isBye
  withPlayoff: [
    { id: 1, n: 1, homeId: "t1", awayId: "t2", stage: "grupo", concluded: true, events: [goal("t1", 1)] },
    { id: 2, n: 2, homeId: "t3", awayId: "t4", stage: "grupo", concluded: true, events: [goal("t4", 10), goal("t4", 11)] },
    { id: 3, n: 3, homeId: "t1", awayId: "t3", stage: "grupo", concluded: true, events: [] },
    { id: 4, n: 4, homeId: "t2", awayId: "t4", stage: "grupo", concluded: true, events: [goal("t2", 4), goal("t4", 10)] },
    { id: 5, n: 5, homeId: "t4", awayId: null, stage: "playoff", round: 1, isBye: true, events: [] },
    { id: 6, n: 6, homeId: "t1", awayId: "t2", stage: "playoff", round: 1, concluded: true, events: [goal("t2", 5), goal("t2", 5), goal("t2", 5)] },
  ],
};

/** Live matchday objects for playoffState regression. */
export const MATCHDAYS = {
  none: null,
  campeonato: { mode: "campeonato", matches: MATCH_SETS.simple },
  personalizadoGroupDone: {
    mode: "personalizado", config: { faseFinal: true },
    matches: MATCH_SETS.withPlayoff.filter((m) => m.stage !== "playoff"),
  },
  personalizadoRound1: { mode: "personalizado", config: { faseFinal: true }, matches: MATCH_SETS.withPlayoff },
  personalizadoFinalTiedPens: {
    mode: "personalizado", config: { faseFinal: true },
    matches: [
      ...MATCH_SETS.withPlayoff,
      { id: 7, n: 7, homeId: "t4", awayId: "t2", stage: "playoff", round: 2, concluded: true, penaltyWinnerId: "t4", events: [goal("t4", 10), goal("t2", 4)] },
    ],
  },
  personalizadoFinalOpen: {
    mode: "personalizado", config: { faseFinal: true },
    matches: [
      ...MATCH_SETS.withPlayoff,
      { id: 7, n: 7, homeId: "t4", awayId: "t2", stage: "playoff", round: 2, events: [] },
    ],
  },
};

/** A realistic season roster in the app's player shape (local demo ids). */
export const ROSTER = [
  { id: 1, name: "Carlos", position: "Médio", attrs: { rit: 78, rem: 74, pas: 84, dri: 79, def: 66, fis: 75 }, goals: 18, assists: 12, mvps: 3, gamesPlayed: 15, wins: 9, cleanSheets: 0, ratingsCount: 4 },
  { id: 2, name: "João", position: "Avançado", attrs: { rit: 89, rem: 94, pas: 78, dri: 88, def: 45, fis: 85 }, goals: 21, assists: 5, mvps: 5, gamesPlayed: 15, wins: 10, ratingsCount: 5 },
  { id: 3, name: "Miguel", position: "Defesa", attrs: { rit: 72, rem: 55, pas: 74, dri: 64, def: 84, fis: 82 }, goals: 3, assists: 11, mvps: 2, gamesPlayed: 11, wins: 6, cleanSheets: 3, ratingsCount: 3 },
  { id: 4, name: "Rui", position: "Guarda-redes", attrs: { div: 82, man: 78, kic: 70, ref: 85, spd: 60, pos: 80 }, goals: 0, assists: 2, mvps: 4, gamesPlayed: 14, wins: 8, cleanSheets: 6, epicSaves: 9 },
  { id: 5, name: "Diogo", position: "Médio", attrs: { rit: 70, rem: 68, pas: 75, dri: 72, def: 60, fis: 70 }, goals: 6, assists: 7, mvps: 1, gamesPlayed: 12, wins: 5, ratingsCount: 1 },
  { id: 6, name: "Tiago", position: "Defesa", attrs: { rit: 65, rem: 50, pas: 66, dri: 58, def: 78, fis: 80 }, goals: 1, assists: 2, mvps: 0, gamesPlayed: 10, wins: 4, cleanSheets: 2, ratingsCount: 3 },
  { id: 7, name: "André", position: "Avançado", attrs: { rit: 80, rem: 79, pas: 65, dri: 77, def: 40, fis: 70 }, goals: 12, assists: 3, mvps: 1, gamesPlayed: 13, wins: 7, ratingsCount: 6 },
  { id: 8, name: "Pedro", position: "Médio", attrs: { rit: 74, rem: 70, pas: 72, dri: 74, def: 62, fis: 68 }, goals: 4, assists: 9, mvps: 0, gamesPlayed: 9, wins: 3, ratingsCount: 0 },
  { id: 9, name: "Bruno", position: "Guarda-redes", attrs: { div: 70, man: 72, kic: 66, ref: 74, spd: 62, pos: 70 }, goals: 1, assists: 0, mvps: 0, gamesPlayed: 6, wins: 2, cleanSheets: 2, epicSaves: 3 },
  { id: 10, name: "Hugo", position: "Defesa", attrs: { rit: 68, rem: 52, pas: 70, dri: 60, def: 80, fis: 76 }, goals: 2, assists: 4, mvps: 0, gamesPlayed: 14, wins: 7, cleanSheets: 1 },
  { id: 11, name: "Sem dados", position: "Médio" },
];

/** matchdaySummaries, newest-first, in the app's shape. */
export const SUMMARIES = [
  { date: "2026-09-27", summary: {
    lines: [{ key: 2, goals: 3, assists: 1, wins: 2 }, { key: 1, goals: 1, assists: 2, wins: 2 }, { key: 4, goals: 0, assists: 0, wins: 2, cleanSheets: 1 }, { key: 7, goals: 0, assists: 0, wins: 0 }],
    matches: [
      { n: 1, homeName: "Coletes", awayName: "Sem coletes", homeGoals: 3, awayGoals: 1 },
      { n: 2, homeName: "Sem coletes", awayName: "Coletes", homeGoals: 0, awayGoals: 2 },
    ],
    teamResults: [
      { name: "Coletes", color: "#C8FF00", wins: 2, players: [1, 2, 4] },
      { name: "Sem coletes", color: "#4895FF", wins: 0, players: [3, 7, 9] },
    ],
  } },
  { date: "2026-09-20", summary: {
    lines: [{ key: 7, goals: 2, assists: 0, wins: 1 }, { key: 3, goals: 1, assists: 1, wins: 1, cleanSheets: 1 }, { key: 1, goals: 0, assists: 1, wins: 0 }],
    matches: [
      { n: 1, homeName: "Coletes", awayName: "Sem coletes", homeGoals: 1, awayGoals: 3 },
      { n: 2, homeName: "—", awayName: "Coletes", homeGoals: 0, awayGoals: 0 },
    ],
    teamResults: [
      { name: "Coletes", color: "#C8FF00", wins: 0, players: [1, 2] },
      { name: "Sem coletes", color: "#4895FF", wins: 1, players: [3, 7] },
    ],
  } },
  { date: "2026-09-13", summary: { lines: [{ key: 2, goals: 1, assists: 0, wins: 1 }], matches: [], teamResults: [] } },
  { date: "2026-09-06", summary: { lines: [] } },
  { date: "2026-08-30", summary: {} },
  { date: "2026-08-23", summary: { lines: [{ key: 2, goals: 5, assists: 0, wins: 3 }] } },
];
