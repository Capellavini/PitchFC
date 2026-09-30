// Everything about "when" is anchored to Portugal, never the host clock.
const TZ = "Europe/Lisbon";

export const lisbonHour = (d = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d)) % 24;

/** Minutes since Lisbon midnight — for thresholds finer than a whole hour
 *  (e.g. 08:30), which lisbonHour alone can't express. */
export const lisbonMinutesOfDay = (d = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).map((p) => [p.type, p.value])
  );
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
};

/** "HH:MM" -> minutes since midnight, for comparing against lisbonMinutesOfDay. */
export const minutesFromHHMM = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

// A real instant -> its Europe/Lisbon calendar date/weekday (0=Sun..6=Sat).
// Same approach as the frontend's helpers.js (lisbonParts) — kept as a
// separate, minimal copy here since wa-bot is its own deployable and
// doesn't share a module graph with src/.
function lisbonParts(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: +parts.year, month: +parts.month, day: +parts.day, weekday: WD[parts.weekday] };
}

function tzOffsetMinutes(utcMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - utcMs) / 60000;
}

/** A Europe/Lisbon wall-clock date/time -> the real UTC instant, DST-correct. */
export function lisbonWallClockToUtc(year, month, day, hour, minute) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(naiveUtc - tzOffsetMinutes(naiveUtc) * 60000);
}

/** Next occurrence (today counts) of `weekday` (0=Sun) at "HH:MM" Lisbon
 *  time, as a real instant. Used to resolve "sábado às 20h" from chat. */
export function nextLisbonWeekdayAt(weekday, hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const now = lisbonParts();
  const day = now.day + ((weekday - now.weekday + 7) % 7);
  let d = lisbonWallClockToUtc(now.year, now.month, day, h, m || 0);
  if (d.getTime() < Date.now()) d = lisbonWallClockToUtc(now.year, now.month, day + 7, h, m || 0);
  return d;
}

/** "YYYY-MM-DD" + "HH:MM", both meant as Lisbon wall-clock -> a real instant. */
export function lisbonDateAt(isoDate, hhmm) {
  const [y, mo, da] = isoDate.split("-").map(Number);
  const [h, m] = String(hhmm).split(":").map(Number);
  return lisbonWallClockToUtc(y, mo, da, h, m || 0);
}

/** The Lisbon-calendar weekday (0=Sun) of a real instant. */
export const lisbonWeekday = (d = new Date()) => lisbonParts(d).weekday;

export const todayLisbon = () => {
  const p = lisbonParts();
  return { ...p, isoDate: lisbonDayKeyFromParts(p) };
};
const lisbonDayKeyFromParts = (p) => `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;

export const isQuietHour = (start, end, d = new Date()) => {
  const h = lisbonHour(d);
  return start > end ? h >= start || h < end : h >= start && h < end;
};

export const lisbonDayKey = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD

const LOCALES = { pt: "pt-PT", en: "en-GB" };

export const formatGameWhen = (iso, lang = "pt") => {
  const d = new Date(iso);
  const loc = LOCALES[lang] ?? LOCALES.pt;
  const day = new Intl.DateTimeFormat(loc, { timeZone: TZ, weekday: "long" }).format(d);
  return `${day}, ${formatGameTime(iso)}`;
};

export const formatGameTime = (iso) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
