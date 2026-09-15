import { AVATAR_PALETTE } from "../theme";
import { t, getLang } from "./i18n";

export const ini = (n) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const playerColor = (group, p) =>
  AVATAR_PALETTE[group.indexOf(p) % AVATAR_PALETTE.length];

// € formatting, PT style ("€5" / "€4,50")
export const fmtEUR = (n) =>
  n % 1 === 0 ? `€${n}` : `€${n.toFixed(2).replace(".", ",")}`;

/**
 * Split confirmed players into those actually playing (the first `spots`,
 * in confirmation order) and the ordered waiting line for the overflow.
 * Order is by responded_at (earliest first); players with no timestamp
 * — the core roster and organizer-added guests — count as earliest, so
 * they're always in. When someone drops out, the next in line takes the
 * freed slot automatically (this is derived, not stored).
 */
// Mensalistas (regular members) always outrank a not-yet-locked avulso
// (drop-in), regardless of who confirmed first — an avulso only holds
// their ground once the organizer has locked their spot for this game
// (priorityLocked), at which point they compete on responded_at same as
// everyone else. Local-demo player objects have neither field, so they
// fall through to tier 0 — unchanged from the old behavior.
export const splitWaitlist = (confirmed, spots) => {
  const tier = (p) => (p.playerType === "avulso" && !p.priorityLocked ? 1 : 0);
  const ts = (p) => (p.respondedAt ? new Date(p.respondedAt).getTime() : 0);
  const ordered = [...confirmed].sort((a, b) => tier(a) - tier(b) || ts(a) - ts(b)); // stable for ties
  return { playing: ordered.slice(0, spots), waitlist: ordered.slice(spots) };
};

// ── Dates ────────────────────────────────────────────────
export const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// The club plays in Portugal: every "weekday/time" the organizer sets
// (kickoff, confirmation-open moment) means Europe/Lisbon wall-clock
// time — not whatever timezone the viewer's own device happens to be in.
// Getting this wrong is exactly the bug reported 2026-09-15: a player in
// Brazil couldn't confirm because the app compared Lisbon's 17:00 against
// his own device's clock instead of Lisbon's, off by his UTC offset.
const GAME_TZ = "Europe/Lisbon";

// Europe/Lisbon's UTC offset (minutes) at a given instant — DST-correct
// (WET/WEST) via Intl, no hardcoded offset and no external library.
function tzOffsetMinutes(utcMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - utcMs) / 60000;
}

// A real instant → its Europe/Lisbon calendar date/time/weekday.
function lisbonParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GAME_TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, weekday: WD[parts.weekday] };
}

// A Europe/Lisbon wall-clock date/time (month is 1-12, day may overflow
// the month — Date.UTC normalizes it) → the real UTC instant it refers
// to, DST-correct.
function lisbonWallClockToUtcMs(year, month, day, hour, minute) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  return naiveUtc - tzOffsetMinutes(naiveUtc, GAME_TZ) * 60000;
}

/** Next occurrence of weekday (0=Sun) at HH:MM **in Portugal**, as a Date
 *  (a real instant) — correct no matter what timezone the viewer is in. */
export function nextGameDate(weekday, time = "20:00") {
  const [h, m] = (time || "20:00").split(":").map(Number);
  const now = lisbonParts();
  const day = now.day + ((weekday - now.weekday + 7) % 7);
  let ms = lisbonWallClockToUtcMs(now.year, now.month, day, h, m);
  if (ms < Date.now()) ms = lisbonWallClockToUtcMs(now.year, now.month, day + 7, h, m); // already passed today
  return new Date(ms);
}

/** Next occurrence of a weekday (0=Sunday), formatted "Sábado, 14 Jun" —
 *  the calendar date as it falls in Portugal. */
export function nextGameDateLabel(weekday) {
  const p = lisbonParts(nextGameDate(weekday));
  return `${t(WEEKDAYS_PT[weekday])}, ${p.day} ${t(MONTHS_PT[p.month - 1])}`;
}

/**
 * Recurring confirmation window: confirmations open weekly at
 * openWeekday/openTime, for the upcoming game on gameWeekday/gameTime
 * (e.g. "toda segunda às 17h abre o jogo de domingo"). Both times are
 * Europe/Lisbon wall-clock, same as the game itself (see GAME_TZ above).
 * Returns whether they're open now plus the opening moment — derived,
 * no backend needed.
 */
export function confirmationWindow(gameWeekday, gameTime, openWeekday, openTime) {
  const gameDate = nextGameDate(gameWeekday, gameTime);
  const g = lisbonParts(gameDate);
  let back = (g.weekday - openWeekday + 7) % 7;
  if (back === 0) back = 7; // same weekday as the game → a full week before
  const [h, m] = (openTime || "17:00").split(":").map(Number);
  const opensAt = new Date(lisbonWallClockToUtcMs(g.year, g.month, g.day - back, h, m));
  return { opensAt, gameDate, isOpen: Date.now() >= opensAt.getTime() };
}

/** Local-timezone ISO day (YYYY-MM-DD), offset in days from today. */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The reverse of isoDay: a Date object → local "YYYY-MM-DD", for feeding
 *  a <input type="date"> or storing alongside isoDay-shaped values. */
export function toIsoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const fromIso = (iso) => new Date(`${iso}T12:00:00`);

/** An isoDay ("YYYY-MM-DD") + "HH:MM" → real kickoff Date. The date is
 *  just a calendar day (unambiguous everywhere); the time is Europe/
 *  Lisbon wall-clock, same as everywhere else the game's schedule is
 *  interpreted (see GAME_TZ above) — used when the organizer picks an
 *  exact calendar date for the next game instead of "next occurrence of
 *  this weekday". */
export function dateTimeFromIso(iso, time = "20:00") {
  const [y, mo, da] = iso.split("-").map(Number);
  const [h, m] = (time || "20:00").split(":").map(Number);
  return new Date(lisbonWallClockToUtcMs(y, mo, da, h, m));
}

/** "Sex 13" — short chip label for a day picker. */
export const dayChipLabel = (iso) => {
  const d = fromIso(iso);
  return `${t(WEEKDAYS_PT[d.getDay()].slice(0, 3))} ${d.getDate()}`;
};

/** "13 Jun" */
export const fmtDayMonth = (iso) => {
  const d = fromIso(iso);
  return `${d.getDate()} ${t(MONTHS_PT[d.getMonth()])}`;
};

/** "Sexta, 13 Jun" */
export const fmtFullDay = (iso) => {
  const d = fromIso(iso);
  return `${t(WEEKDAYS_PT[d.getDay()])}, ${d.getDate()} ${t(MONTHS_PT[d.getMonth()])}`;
};

/** "agora" / "há 5 min" / "há 3h" / "há 2 dias" / "13 Jun" */
export function relativeTime(ts) {
  const lang = getLang();
  const then = new Date(ts).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("agora");
  if (mins < 60) {
    if (lang === "en") return `${mins} min ago`;
    if (lang === "it") return `${mins} min fa`;
    return `há ${mins} min`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    if (lang === "en") return `${hrs}h ago`;
    if (lang === "it") return `${hrs}h fa`;
    return `há ${hrs}h`;
  }
  const days = Math.floor(hrs / 24);
  if (days < 7) {
    if (lang === "en") return `${days} ${days === 1 ? "day" : "days"} ago`;
    if (lang === "it") return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
    return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  const d = new Date(ts);
  return `${d.getDate()} ${t(MONTHS_PT[d.getMonth()])}`;
}

// ── FUT card overall ─────────────────────────────────────
// Goalkeepers get their own FIFA-style attribute set (diving/handling/
// kicking/reflexes/speed/positioning) — completely different axes from
// outfield players, so they're never mixed into the same 6 keys.
const ATTR_LABELS = { rit: "RIT", rem: "REM", pas: "PAS", dri: "DRI", def: "DEF", fis: "FIS" };
const GK_ATTR_LABELS = { div: "DIV", man: "MAN", kic: "KIC", ref: "REF", spd: "SPD", pos: "POS" };
const DEFAULT_ATTRS = { rit: 70, rem: 70, pas: 70, dri: 70, def: 70, fis: 70 };
const DEFAULT_GK_ATTRS = { div: 70, man: 70, kic: 70, ref: 70, spd: 70, pos: 70 };

/** Which attribute labels/keys apply to a player — goalkeepers use their
 *  own set, everyone else uses the outfield one. Drives the FUT card,
 *  the rating sliders and default attrs consistently off one source. */
export const attrLabelsFor = (position) => (position === "Guarda-redes" ? GK_ATTR_LABELS : ATTR_LABELS);
export const defaultAttrsFor = (position) => (position === "Guarda-redes" ? DEFAULT_GK_ATTRS : DEFAULT_ATTRS);

const OVERALL_WEIGHTS = {
  "Defesa":       { def: 0.35, fis: 0.25, rit: 0.15, pas: 0.15, dri: 0.05, rem: 0.05 },
  "Médio":        { pas: 0.30, dri: 0.20, rit: 0.15, fis: 0.15, rem: 0.10, def: 0.10 },
  "Avançado":     { rem: 0.35, rit: 0.25, dri: 0.20, pas: 0.10, fis: 0.05, def: 0.05 },
};
const GK_OVERALL_WEIGHTS = { ref: 0.25, div: 0.25, pos: 0.20, man: 0.15, kic: 0.10, spd: 0.05 };

export function computeOverall(position, attrs) {
  const w = position === "Guarda-redes" ? GK_OVERALL_WEIGHTS : (OVERALL_WEIGHTS[position] ?? OVERALL_WEIGHTS["Médio"]);
  return Math.round(Object.keys(w).reduce((sum, k) => sum + (attrs?.[k] ?? 60) * w[k], 0));
}

export const POSITION_ABBR = { "Guarda-redes": "GR", "Defesa": "DEF", "Médio": "MED", "Avançado": "AVA" };

// ── Peer ratings ─────────────────────────────────────────
// URL-safe base64 payloads for the no-backend rating flow:
// request link carries the player's identity; the friend's
// answer comes back as a paste-able code. Replaced by real
// rows in Supabase later.
export const encodePayload = (obj) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(obj))));

export function decodePayload(s) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  } catch {
    return null;
  }
}

/** Average a list of attrs objects, per attribute. Goalkeepers are rated
 *  on a different attribute set than outfield players, so the key list
 *  is derived from the rated player's own position (falls back to
 *  whatever keys the first rating actually has, for old callers that
 *  don't know the position). */
export function averageAttrs(list, position) {
  if (!list.length) return null;
  const keys = position ? Object.keys(attrLabelsFor(position)) : Object.keys(list[0] || {});
  const out = {};
  keys.forEach((k) => {
    out[k] = Math.round(list.reduce((s, a) => s + (a?.[k] ?? 60), 0) / list.length);
  });
  return out;
}

// ── Image upload → small base64 (fits localStorage) ─────
export function fileToDataUrl(file, max = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}
