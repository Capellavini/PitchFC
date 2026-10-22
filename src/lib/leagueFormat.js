// ─────────────────────────────────────────────────────────
// PITCH Ligas — format profile of a competition (modality × format).
// Pure, no React: imported by node --test (leagueFormat.test.js).
//
// The backend models only `competitions.modality` ('futebol' | 'society'
// | 'futsal') and `competitions.format` ('5v5' … '11v11') plus
// `match_duration_min` (draft 02). Everything here is DISPLAY guidance
// derived from those columns: players on the pitch (incl. GR), how many
// players a call-up may hold, the TacticsBoard outfield count, and the
// suggested default duration when a manager creates the competition.
// It never invents a rule the regulation does not hold: futsal team
// fouls, time-outs or rolling-sub limits are NOT modelled server-side, so
// they are not enforced or surfaced as rules here (only "substituições
// livres", which is simply the absence of a sub cap in the event log).
// ─────────────────────────────────────────────────────────

const FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "11v11"];

/** Onfield players (GR included) for a server format string. */
export const onFieldOf = (format) => {
  const m = /^(\d+)v\1$/.exec(String(format || ""));
  return m ? Number(m[1]) : 7;
};

/** Presets offered in "Nova competição" (the server allow-list is wider). */
export const FORMAT_PRESETS = Object.freeze([
  { id: "futsal", modality: "futsal", format: "5v5", durationMin: 40, label: "Futsal", labelEn: "Futsal" },
  { id: "f5", modality: "futebol", format: "5v5", durationMin: 50, label: "Futebol 5", labelEn: "5-a-side" },
  { id: "f7", modality: "futebol", format: "7v7", durationMin: 50, label: "Futebol 7", labelEn: "7-a-side" },
  { id: "f11", modality: "futebol", format: "11v11", durationMin: 90, label: "Futebol 11", labelEn: "11-a-side" },
]);

/**
 * { onField, outfield, starters, callupMax, tacticsSupported, rollingSubs,
 *   label, halves } for a competition.
 *   - callupMax: Rivals set_match_lineup accepts ≤ 22 player ids.
 *   - tacticsSupported: TacticsBoard renders GR + 4…10 outfield.
 *   - rollingSubs: futsal (and 5-a-side) use free, rolling substitutions —
 *     the event log has no sub cap, so the UI simply never counts subs.
 *   - halves: suggested split of match_duration_min (display only).
 */
export function formatProfile(format, modality = "futebol", durationMin = null) {
  const f = FORMATS.includes(format) ? format : "7v7";
  const onField = onFieldOf(f);
  const futsal = modality === "futsal";
  const preset = FORMAT_PRESETS.find((p) => p.format === f && (futsal ? p.modality === "futsal" : p.modality !== "futsal"));
  const minutes = Number(durationMin) > 0 ? Number(durationMin) : preset?.durationMin ?? null;
  return {
    format: f, modality: futsal ? "futsal" : modality || "futebol", onField, outfield: onField - 1, starters: onField,
    callupMax: Math.min(22, onField * 3),
    tacticsSupported: onField - 1 >= 4 && onField - 1 <= 10,
    rollingSubs: futsal || onField <= 5,
    label: futsal ? "Futsal" : `Futebol ${onField}`,
    halves: minutes ? { count: 2, minutes: Math.round(minutes / 2) } : null,
  };
}

/** "Futsal · 2×20 min" / "Futebol 7 · 2×25 min" (PT-PT source; caller t()s the label). */
export const formatSummary = (p) => (p.halves ? `${p.label} · 2×${p.halves.minutes} min` : p.label);
