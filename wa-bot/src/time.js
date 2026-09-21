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

export const formatGameWhen = (iso) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "long" }).format(d);
  const time = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day}, ${time}`;
};
