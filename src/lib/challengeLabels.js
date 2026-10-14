// Display helpers for challenge terms (translated labels + values). Kept
// apart from rivalsChallenges.js, which stays free of i18n so it runs
// under node --test without the dictionary.
import { t, getLang } from "./i18n.js";
import { CC, RC, tf } from "./rivalsCopy.js";
import { formatKickoff } from "./rivals.js";
import { formatCost } from "./rivalsChallenges.js";

export const uiLocale = () => ({ pt: "pt-PT", "pt-br": "pt-BR", en: "en-GB" }[getLang()] || "pt-PT");
export const kickoffLabel = (iso, tz = "Europe/Lisbon") => formatKickoff(iso, { timezone: tz, locale: uiLocale() });
/** "Lisbon" / "Sao Paulo" — the city part of an IANA zone. */
export const tzCity = (tz = "") => String(tz).split("/").pop().replace(/_/g, " ");

const SPLIT = { split: CC.splitHalf, challenger: CC.splitChallenger, challenged: CC.splitChallenged, loser: CC.splitLoser, none: CC.splitNone };
export const splitLabel = (id) => t(SPLIT[id] || CC.splitHalf);

/** Rows shown for a set of terms, in order. */
export const TERM_ROWS = ["kickoffAt", "venueName", "venueAddress", "format", "durationMin", "fieldResponsible", "costCents", "costSplit", "note"];

export function termLabel(key, terms) {
  switch (key) {
    case "kickoffAt": return t(CC.when);
    case "venueName": return t(CC.venue);
    case "venueAddress": return t(CC.address);
    case "format": return t(RC.format);
    case "durationMin": return t(CC.duration);
    case "fieldResponsible": return t(CC.fieldResponsible);
    case "costCents": return tf(CC.cost, { cur: terms?.currency || "EUR" });
    case "costSplit": return t(CC.costSplit);
    case "note": return t(CC.note);
    default: return key;
  }
}

/** One term as text. `teams` = { challenger, challenged } (names for the
 *  field-responsible row). Empty values render as "—" (or "a combinar"). */
export function termValue(key, terms, teams = {}) {
  if (!terms) return "—";
  const v = terms[key];
  switch (key) {
    case "kickoffAt": return v ? kickoffLabel(v, terms.timezone) : "—";
    case "venueName": return v || t(CC.venueTbd);
    case "durationMin": return v ? tf(CC.minutes, { n: v }) : "—";
    case "fieldResponsible": {
      const tm = v === "challenged" ? teams.challenged : teams.challenger;
      return tm?.name || (v === "challenged" ? t(CC.anyTeam) : "—");
    }
    case "costCents": return v == null ? "—" : formatCost(v, terms.currency, uiLocale());
    case "costSplit": return splitLabel(v);
    default: return v == null || v === "" ? "—" : String(v);
  }
}

/** Google Maps search link for a venue (no API key; opens the app/site). */
export const mapsUrl = (terms) => {
  const q = [terms?.venueName, terms?.venueAddress].filter(Boolean).join(", ");
  return terms?.venueUrl || (q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null);
};
