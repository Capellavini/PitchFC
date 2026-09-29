// Local demo seed — realistic past matchdays for the demo group, with
// FULL ISO dates computed relative to "now" (the most recent Saturday
// before today and the ~2 months before it), so the demo never goes
// stale: Perfil's calendar, progress chart, recent form (V/E/D) and
// career records, Home's feed/last result, Competir's podium and the
// Matchday after-state all have something real to show.
//
// Deterministic (seeded PRNG): the same week always produces the same
// scores, so a reload doesn't reshuffle the demo. Only used in local
// demo mode — cloud mode never reads this. Summaries use exactly the
// shape endMatchday() writes: { teamResults, matches, lines, candidates }.
import { C, AVATAR_PALETTE } from "../theme";
import { INITIAL_GROUP } from "../data";
import { MONTHS_PT } from "./helpers";

const WEEKS = 9;                 // ~2 months of weekly games
const GAMES_PER_NIGHT = 3;
const TEAM_NAMES = ["Coletes", "Sem coletes"];
const DAY = 24 * 60 * 60 * 1000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Most recent Saturday strictly before today (local calendar). */
function lastSaturday(now) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  const back = ((d.getDay() - 6 + 7) % 7) || 7;
  d.setDate(d.getDate() - back);
  return d;
}

// Scoring weight per position (who tends to score) — "me" (Carlos,
// id 1, Médio) gets a small bump so the demo profile has a story.
const SCORE_W = { "Guarda-redes": 0.05, "Defesa": 0.8, "Médio": 2.2, "Avançado": 3.6 };
const ASSIST_W = { "Guarda-redes": 0.3, "Defesa": 1.2, "Médio": 3, "Avançado": 1.8 };
const weightOf = (p, table) => (table[p.position] ?? 1) * (p.isMe ? 1.4 : 1);

function pickWeighted(rand, players, table, exclude) {
  const pool = players.filter((p) => p.id !== exclude);
  const total = pool.reduce((s, p) => s + weightOf(p, table), 0);
  let r = rand() * total;
  for (const p of pool) {
    r -= weightOf(p, table);
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

function buildNight(week, date, group) {
  const rand = mulberry32(Number(isoOf(date).replace(/-/g, "")));
  const gks = group.filter((p) => p.position === "Guarda-redes");
  const outfield = group.filter((p) => p.position !== "Guarda-redes");
  const me = group.find((p) => p.isMe);

  // 10 players: both keepers + 8 outfield. "Me" misses exactly one week
  // (week 4) so the calendar/form have a realistic gap.
  const meIn = week !== 4;
  const others = outfield.filter((p) => !p.isMe).map((p) => ({ p, r: rand() + (p.gamesPlayed || 0) / 30 }))
    .sort((a, b) => b.r - a.r).map((x) => x.p);
  const field = [...(meIn ? [me] : []), ...others].slice(0, 8);
  const playing = [...gks, ...field];

  // Snake draft by position, like drawTeams().
  const order = ["Guarda-redes", "Defesa", "Médio", "Avançado"].flatMap((pos) => playing.filter((p) => p.position === pos));
  const teams = [[], []];
  order.forEach((p, idx) => {
    const round = Math.floor(idx / 2), slot = idx % 2;
    teams[round % 2 === 0 ? slot : 1 - slot].push(p);
  });
  const colors = [C.accent, C.blue];

  const stats = {};
  const bump = (id, k) => {
    stats[id] = stats[id] ?? { goals: 0, assists: 0, cleanSheets: 0, wins: 0, epicSaves: 0 };
    stats[id][k] += 1;
  };
  const wins = [0, 0];
  let forceMe = week === 0 && meIn;
  const matches = [];
  const meSide = teams.findIndex((ts) => ts.includes(me));
  for (let n = 1; n <= GAMES_PER_NIGHT; n++) {
    // 0–3 goals a side per game (short 5-a-side games), ~9 a night — in
    // line with the seeded season totals in data.js.
    const goals = [0, 1].map(() => Math.floor(rand() * 3) + (rand() < 0.5 ? 1 : 0));
    // Slight edge for "me"'s team so recent form reads as a mix of V/E/D.
    if (meSide >= 0 && rand() < 0.45) goals[meSide] = Math.min(4, goals[meSide] + 1);
    const events = [];
    const matchStats = {};
    const bumpM = (id, k) => { matchStats[id] = matchStats[id] ?? { goals: 0, assists: 0 }; matchStats[id][k] += 1; };
    [0, 1].forEach((side) => {
      for (let g = 0; g < goals[side]; g++) {
        // Newest night: "me" scores the first goal his team gets, so
        // Home's last-result card and share button have a story.
        const forced = forceMe && teams[side].includes(me);
        if (forced) forceMe = false;
        const scorer = forced ? me : pickWeighted(rand, teams[side], SCORE_W);
        const assist = rand() < 0.7 ? pickWeighted(rand, teams[side], ASSIST_W, scorer.id) : null;
        bump(scorer.id, "goals"); bumpM(scorer.id, "goals");
        if (assist) { bump(assist.id, "assists"); bumpM(assist.id, "assists"); }
        events.push({ side: side === 0 ? "h" : "a", type: "goal", by: scorer.id, ...(assist ? { ast: assist.id } : {}), min: 1 + Math.floor(rand() * 11) });
      }
    });
    // A couple of big saves per night for the keepers.
    if (rand() < 0.6) {
      const side = rand() < 0.5 ? 0 : 1;
      const gk = teams[side].find((p) => p.position === "Guarda-redes");
      if (gk) { bump(gk.id, "epicSaves"); events.push({ side: side === 0 ? "h" : "a", type: "save", by: gk.id, min: 1 + Math.floor(rand() * 11) }); }
    }
    events.sort((a, b) => a.min - b.min);
    [0, 1].forEach((side) => {
      if (goals[1 - side] !== 0) return;
      teams[side].forEach((p) => { if (p.position === "Guarda-redes" || p.position === "Defesa") bump(p.id, "cleanSheets"); });
    });
    const winSide = goals[0] > goals[1] ? 0 : goals[1] > goals[0] ? 1 : null;
    if (winSide != null) { wins[winSide] += 1; teams[winSide].forEach((p) => bump(p.id, "wins")); }
    const gkOf = (side) => teams[side].find((p) => p.position === "Guarda-redes")?.id ?? null;
    matches.push({
      n, homeName: TEAM_NAMES[0], awayName: TEAM_NAMES[1], homeGoals: goals[0], awayGoals: goals[1],
      lines: Object.entries(matchStats).map(([id, s]) => ({ key: Number(id), goals: s.goals, assists: s.assists })),
      events, homeGk: gkOf(0), awayGk: gkOf(1),
    });
  }

  const lines = Object.entries(stats)
    .map(([id, s]) => {
      const p = group.find((x) => x.id === Number(id));
      return { key: p.id, nick: p.nick, name: p.name, isMe: Boolean(p.isMe), color: AVATAR_PALETTE[group.indexOf(p) % AVATAR_PALETTE.length], ...s };
    })
    .sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists));
  const candidates = playing.map((p) => ({ key: p.id, nick: p.nick, position: p.position }));
  const teamResults = teams.map((ts, i) => ({ name: TEAM_NAMES[i], color: colors[i], wins: wins[i], players: ts.map((p) => p.id) }));
  const totalGoals = matches.reduce((s, m) => s + m.homeGoals + m.awayGoals, 0);

  return {
    id: `demo-${isoOf(date)}`,
    playedOn: isoOf(date),
    ts: date.getTime() + 9 * 3600 * 1000, // 21:00 that night
    mode: "avulsa",
    nGames: GAMES_PER_NIGHT,
    totalGoals,
    // Best night by goals×2 + assists = the demo's MVP (the newest one's
    // vote is left open in PitchApp so the MVP flow can be tried).
    mvpKey: lines[0]?.key ?? null,
    summary: { teamResults, matches, lines, candidates },
  };
}

/** Newest first. `now` defaults to the page-load moment. */
export function buildDemoMatchdays(now = Date.now(), group = INITIAL_GROUP) {
  const first = lastSaturday(now);
  return Array.from({ length: WEEKS }, (_, w) => buildNight(w, new Date(first.getTime() - w * 7 * DAY), group));
}

export const DEMO_MATCHDAYS = buildDemoMatchdays();

/** History rows (Jogar → past games, Stats) derived from the same seed.
 *  `date` is the PT label (same shape as rows endMatchday writes);
 *  `playedOn` lets PitchApp re-label it in the active language. */
export const DEMO_HISTORY = DEMO_MATCHDAYS.map((md, i) => ({
  id: md.id, playedOn: md.playedOn,
  date: `${Number(md.playedOn.slice(8))} ${MONTHS_PT[Number(md.playedOn.slice(5, 7)) - 1]}`,
  confirmed: md.summary.candidates.length,
  result: `${md.totalGoals}⚽`, allPaid: i > 0, mvpId: i === 0 ? null : md.mvpKey, games: md.nGames,
}));

// ── Demo social posts (Home feed + Golo da Semana) ─────────────
// Video posts need a playable file; this is a small CC0 sample clip from
// MDN, shown with the brand field artwork as poster.
const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const HOUR = 3600 * 1000;
const author = (id) => {
  const p = INITIAL_GROUP.find((x) => x.id === id);
  return { id: p.id, nick: p.nick, name: p.name, photo: p.photo ?? null, groupId: "local" };
};

export function buildDemoPosts(now = Date.now()) {
  const at = (hoursAgo) => Math.round(now - hoursAgo * HOUR);
  return [
    { id: at(20), createdAt: new Date(at(20)).toISOString(), author: author(6), mine: false, type: "video",
      text: "Chapéu ao Ruizão no Jogo 2 😅 Isto vai a Golo da Semana!", media: SAMPLE_VIDEO, poster: "/brand/field.jpg",
      likes: [2, 3, 5, 8, 12], liked: false, comments: [{ id: 1, nick: "Ruizão", text: "Estava encandeado pelo holofote 🙄" }, { id: 2, nick: "Joãozão", text: "Golaço!!" }] },
    { id: at(26), createdAt: new Date(at(26)).toISOString(), author: author(2), mine: false, type: "video",
      text: "Remate de primeira, ângulo impossível ⚽", media: SAMPLE_VIDEO, poster: "/brand/field.jpg",
      likes: [6, 7, 11], liked: false, comments: [] },
    { id: at(30), createdAt: new Date(at(30)).toISOString(), author: author(3), mine: false, type: "text",
      text: "Grande jogo ontem malta. Para a semana há revanche — Sem coletes não perde duas seguidas 💪",
      likes: [1, 4, 7], liked: false, comments: [{ id: 3, nick: "Pedão", text: "Contem comigo!" }] },
    { id: at(52), createdAt: new Date(at(52)).toISOString(), author: author(4), mine: false, type: "photo",
      text: "O nosso campo antes do apito inicial 🏟️", media: "/brand/field.jpg",
      likes: [1, 2, 9, 10], liked: false, comments: [] },
    { id: at(24 * 8), createdAt: new Date(at(24 * 8)).toISOString(), author: author(8), mine: false, type: "text",
      text: "Quem traz a bomba de ar no sábado? A bola está murcha 😂", likes: [5], liked: false, comments: [] },
  ];
}

export const DEMO_POSTS = buildDemoPosts();

/** Three teammate ratings for "me" (same shape RatePlayer's code
 *  decodes to), so the demo FUT card / OVR badge is unlocked (3+). */
export const DEMO_PEER_RATINGS = [
  { from: "Joãozão", a: { rit: 80, rem: 76, pas: 86, dri: 81, def: 64, fis: 74 }, at: 0 },
  { from: "Ruizão",  a: { rit: 76, rem: 72, pas: 83, dri: 78, def: 68, fis: 77 }, at: 0 },
  { from: "Tiago",   a: { rit: 78, rem: 75, pas: 85, dri: 80, def: 65, fis: 75 }, at: 0 },
];

/** Pitch Manager (Fantasy) demo league: me + 5 rivals, each with a fixed
 *  6-player squad bought at the base price when the league started
 *  (~5 weeks ago). Scores per round are computed by the caller from the
 *  same matchday lines, so the leaderboard matches the pitch. */
export const DEMO_FANTASY = {
  startsWeeksAgo: 5,
  budget: 120,
  squadSize: 6,
  mySquad: { player_ids: [2, 6, 5, 3, 7, 4], captain_id: 2, reserve_ids: [] },
  rivals: [
    { participant: 2, player_ids: [6, 12, 8, 10, 3, 13], captain_id: 6 },
    { participant: 6, player_ids: [2, 9, 1, 11, 7, 4], captain_id: 9 },
    { participant: 3, player_ids: [12, 5, 8, 14, 10, 13], captain_id: 12 },
    { participant: 5, player_ids: [9, 6, 11, 1, 14, 4], captain_id: 1 },
    { participant: 8, player_ids: [2, 12, 15, 3, 7, 13], captain_id: 2 },
  ],
};
