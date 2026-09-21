// Everything about "when" is anchored to Portugal, never the host clock.
const TZ = "Europe/Lisbon";

export const lisbonHour = (d = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d)) % 24;

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
