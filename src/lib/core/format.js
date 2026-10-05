// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// The group's game format — groups.game_format (plan docs/ADJUNTO-PLAN.md
// §5, as amended by the decisions block: "campeonato" is the NIGHT table
// only and restarts every week; there is NO season player league, so the
// schema has no `season` key).
//
// Shape (v1):
//   { v: 1, type: "avulso" | "campeonato" | "custom",
//     night: { teams, playersPerTeam, schedule, legs, fixedGames,
//              winnerStays: { maxConsecutive, onDraw }, gameMinutes, goalCap },
//     points: { win, draw, loss },
//     tiebreakers: ["pts", …],
//     playoffs: { enabled, qualifiers, byeTop, thirdPlace, penalties } }
import { DEFAULT_POINTS, TIEBREAKERS } from "./standings.js";

export const FORMAT_VERSION = 1;
export const FORMAT_TYPES = ["avulso", "campeonato", "custom"];
export const SCHEDULES = ["manual", "round_robin", "winner_stays", "fixed"];
export const WINNER_STAYS_ON_DRAW = ["both_off", "challenger_stays", "longest_on_off"];
export const DEFAULT_FORMAT_TIEBREAKERS = ["pts", "gd", "gf", "h2h"];

const baseNight = () => ({
  teams: 2, playersPerTeam: 5, schedule: "manual", legs: 1, fixedGames: null,
  winnerStays: { maxConsecutive: 2, onDraw: "both_off" }, gameMinutes: 10, goalCap: null,
});
const basePlayoffs = () => ({ enabled: false, qualifiers: 2, byeTop: false, thirdPlace: false, penalties: true });

/** A complete, valid format of the given type with every default filled in. */
export function defaultFormat(type = "avulso") {
  const t = FORMAT_TYPES.includes(type) ? type : "avulso";
  return {
    v: FORMAT_VERSION, type: t, night: baseNight(), points: { ...DEFAULT_POINTS },
    tiebreakers: [...DEFAULT_FORMAT_TIEBREAKERS], playoffs: basePlayoffs(),
  };
}

const isInt = (n) => Number.isInteger(n);
const inRange = (n, lo, hi) => isInt(n) && n >= lo && n <= hi;
const isObj = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

/** Validate + normalise. Missing fields take defaults for the given type;
 *  present-but-wrong fields are errors (never silently fixed). Returns
 *  { ok, errors: [code…], format } — `format` is the normalised object
 *  (only meaningful when ok). */
export function validateFormat(input) {
  const errors = [];
  if (!isObj(input)) return { ok: false, errors: ["not_object"], format: null };
  if (!FORMAT_TYPES.includes(input.type)) return { ok: false, errors: ["bad_type"], format: null };
  if (input.v != null && input.v !== FORMAT_VERSION) errors.push("bad_version");

  const d = defaultFormat(input.type);
  const night = { ...d.night, ...(isObj(input.night) ? input.night : {}) };
  night.winnerStays = { ...d.night.winnerStays, ...(isObj(input.night?.winnerStays) ? input.night.winnerStays : {}) };
  const points = { ...d.points, ...(isObj(input.points) ? input.points : {}) };
  const playoffs = { ...d.playoffs, ...(isObj(input.playoffs) ? input.playoffs : {}) };
  const tiebreakers = input.tiebreakers ?? d.tiebreakers;

  if (!inRange(night.teams, 2, 6)) errors.push("night.teams");
  if (!inRange(night.playersPerTeam, 1, 11)) errors.push("night.playersPerTeam");
  if (!SCHEDULES.includes(night.schedule)) errors.push("night.schedule");
  if (![1, 2].includes(night.legs)) errors.push("night.legs");
  if (night.fixedGames !== null && !inRange(night.fixedGames, 1, 40)) errors.push("night.fixedGames");
  if (night.schedule === "fixed" && night.fixedGames === null) errors.push("night.fixedGames");
  if (!inRange(night.winnerStays.maxConsecutive, 1, 10)) errors.push("night.winnerStays.maxConsecutive");
  if (!WINNER_STAYS_ON_DRAW.includes(night.winnerStays.onDraw)) errors.push("night.winnerStays.onDraw");
  if (!inRange(night.gameMinutes, 1, 120)) errors.push("night.gameMinutes");
  if (night.goalCap !== null && !inRange(night.goalCap, 1, 20)) errors.push("night.goalCap");

  for (const k of ["win", "draw", "loss"]) if (!inRange(points[k], -5, 10)) errors.push(`points.${k}`);
  if (isInt(points.win) && isInt(points.draw) && points.draw > points.win) errors.push("points.order");

  if (!Array.isArray(tiebreakers) || !tiebreakers.length
    || tiebreakers.some((t) => !TIEBREAKERS.includes(t))
    || new Set(tiebreakers).size !== tiebreakers.length) errors.push("tiebreakers");

  if (typeof playoffs.enabled !== "boolean") errors.push("playoffs.enabled");
  if (!inRange(playoffs.qualifiers, 2, 8)) errors.push("playoffs.qualifiers");
  for (const k of ["byeTop", "thirdPlace", "penalties"]) if (typeof playoffs[k] !== "boolean") errors.push(`playoffs.${k}`);
  if (playoffs.enabled && isInt(playoffs.qualifiers) && isInt(night.teams) && playoffs.qualifiers > night.teams) errors.push("playoffs.qualifiers");

  const format = { v: FORMAT_VERSION, type: input.type, night, points, tiebreakers: Array.isArray(tiebreakers) ? [...tiebreakers] : tiebreakers, playoffs };
  return { ok: errors.length === 0, errors, format };
}

/** groups.game_format → what MatchdayFormatCard / startMatchday store in
 *  live_matchday ({ mode, config }), keeping today's shape. */
export function toMatchdayStart(format) {
  const { ok, format: f } = validateFormat(format);
  if (!ok) return { mode: "avulsa" };
  if (f.type === "avulso") return { mode: "avulsa" };
  if (f.type === "campeonato") return { mode: "campeonato", config: { points: f.points, tiebreakers: f.tiebreakers } };
  return {
    mode: "personalizado",
    config: {
      confrontos: f.night.legs === 2 ? "idaEVolta" : "unico",
      faseFinal: f.playoffs.enabled, finalistas: f.playoffs.qualifiers,
      byePrimeiro: f.playoffs.byeTop, penaltis: f.playoffs.penalties,
      points: f.points, tiebreakers: f.tiebreakers, schedule: f.night.schedule,
      thirdPlace: f.playoffs.thirdPlace, winnerStays: f.night.winnerStays,
      gameMinutes: f.night.gameMinutes, goalCap: f.night.goalCap,
    },
  };
}

const L = {
  pt: {
    type: { avulso: "Avulso", campeonato: "Campeonato", custom: "Personalizado" },
    loose: "jogos soltos, sem tabela", nightTable: "tabela da noite (recomeça todas as semanas)",
    teams: (n, p) => `${n} equipas de ${p}`, minutes: (m) => `jogos de ${m} min`,
    schedule: {
      manual: "vamos marcando os jogos", round_robin: (legs) => `todos contra todos (${legs === 2 ? "ida e volta" : "1 volta"})`,
      winner_stays: (w) => `quem ganha fica (máx. ${w.maxConsecutive} seguidos)`, fixed: (n) => `${n} jogos fixos`,
    },
    goalCap: (n) => `primeiro a ${n} golos`, tiebreak: "desempate",
    tb: { pts: "pontos", gd: "DG", gf: "GM", h2h: "confronto direto", wins: "vitórias", ga_fewest: "menos golos sofridos", lots: "sorteio" },
    playoffs: (p) => p.qualifiers === 2 ? "final entre os 2 primeiros"
      : p.byeTop ? `play-off entre os ${p.qualifiers} (1.º direto à final)`
        : p.qualifiers === 4 ? "meias-finais entre os 4" : `play-off entre os ${p.qualifiers}`,
    third: "3.º lugar", pens: "penáltis em caso de empate", noPlayoffs: "sem play-off",
  },
  ptbr: {
    type: { avulso: "Avulso", campeonato: "Campeonato", custom: "Personalizado" },
    loose: "jogos soltos, sem tabela", nightTable: "tabela da noite (recomeça toda semana)",
    teams: (n, p) => `${n} times de ${p}`, minutes: (m) => `jogos de ${m} min`,
    schedule: {
      manual: "vamos marcando os jogos", round_robin: (legs) => `todos contra todos (${legs === 2 ? "ida e volta" : "turno único"})`,
      winner_stays: (w) => `quem ganha fica (máx. ${w.maxConsecutive} seguidos)`, fixed: (n) => `${n} jogos fixos`,
    },
    goalCap: (n) => `quem fizer ${n} gols primeiro`, tiebreak: "desempate",
    tb: { pts: "pontos", gd: "SG", gf: "GP", h2h: "confronto direto", wins: "vitórias", ga_fewest: "menos gols sofridos", lots: "sorteio" },
    playoffs: (p) => p.qualifiers === 2 ? "final entre os 2 primeiros"
      : p.byeTop ? `mata-mata entre os ${p.qualifiers} (1º direto na final)`
        : p.qualifiers === 4 ? "semifinais entre os 4" : `mata-mata entre os ${p.qualifiers}`,
    third: "disputa de 3º lugar", pens: "pênaltis em caso de empate", noPlayoffs: "sem mata-mata",
  },
  en: {
    type: { avulso: "Casual", campeonato: "League night", custom: "Custom" },
    loose: "standalone games, no table", nightTable: "night table (resets every week)",
    teams: (n, p) => `${n} teams of ${p}`, minutes: (m) => `${m}-min games`,
    schedule: {
      manual: "games added as we go", round_robin: (legs) => `round robin (${legs === 2 ? "home and away" : "single"})`,
      winner_stays: (w) => `winner stays on (max ${w.maxConsecutive} in a row)`, fixed: (n) => `${n} fixed games`,
    },
    goalCap: (n) => `first to ${n} goals`, tiebreak: "tiebreakers",
    tb: { pts: "points", gd: "GD", gf: "GF", h2h: "head-to-head", wins: "wins", ga_fewest: "fewest conceded", lots: "lots" },
    playoffs: (p) => p.qualifiers === 2 ? "final between the top 2"
      : p.byeTop ? `play-off for the top ${p.qualifiers} (1st straight to the final)`
        : p.qualifiers === 4 ? "semi-finals for the top 4" : `play-off for the top ${p.qualifiers}`,
    third: "3rd-place match", pens: "penalties if tied", noPlayoffs: "no play-off",
  },
};

/** Deterministic one-line description (no model involved). lang: pt|ptbr|en. */
export function describeFormat(format, lang = "pt") {
  const T = L[lang] ?? L.pt;
  const { ok, format: f } = validateFormat(format);
  if (!ok) return "—";
  const n = f.night;
  const pts = `${f.points.win}/${f.points.draw}/${f.points.loss}`;
  const tbs = f.tiebreakers.filter((t) => t !== "pts").map((t) => T.tb[t]).join(", ");
  const parts = [`📐 ${T.type[f.type]}`];
  if (f.type === "avulso") {
    parts.push(T.loose, T.teams(n.teams, n.playersPerTeam), T.minutes(n.gameMinutes));
  } else if (f.type === "campeonato") {
    parts.push(T.nightTable, pts);
    if (tbs) parts.push(`${T.tiebreak}: ${tbs}`);
  } else {
    parts.push(T.teams(n.teams, n.playersPerTeam));
    const s = T.schedule[n.schedule];
    parts.push(n.schedule === "round_robin" ? s(n.legs) : n.schedule === "winner_stays" ? s(n.winnerStays) : n.schedule === "fixed" ? s(n.fixedGames) : s);
    parts.push(T.minutes(n.gameMinutes));
    if (n.goalCap) parts.push(T.goalCap(n.goalCap));
    parts.push(pts);
    if (tbs) parts.push(`${T.tiebreak}: ${tbs}`);
    if (f.playoffs.enabled) {
      parts.push(T.playoffs(f.playoffs) + (f.playoffs.thirdPlace ? ` + ${T.third}` : ""));
      if (f.playoffs.penalties) parts.push(T.pens);
    } else parts.push(T.noPlayoffs);
  }
  return parts.join(" · ");
}
