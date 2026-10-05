// GENERATED from src/lib/core — do not edit; run npm run sync:core
// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// Player overall (OVR) formula, positions and drawn-team identity.

export const POSITIONS = ["Guarda-redes", "Defesa", "Médio", "Avançado"];
export const POSITION_ABBR = { "Guarda-redes": "GR", "Defesa": "DEF", "Médio": "MED", "Avançado": "AVA" };

export const OVERALL_WEIGHTS = {
  "Defesa":       { def: 0.35, fis: 0.25, rit: 0.15, pas: 0.15, dri: 0.05, rem: 0.05 },
  "Médio":        { pas: 0.30, dri: 0.20, rit: 0.15, fis: 0.15, rem: 0.10, def: 0.10 },
  "Avançado":     { rem: 0.35, rit: 0.25, dri: 0.20, pas: 0.10, fis: 0.05, def: 0.05 },
};
export const GK_OVERALL_WEIGHTS = { ref: 0.25, div: 0.25, pos: 0.20, man: 0.15, kic: 0.10, spd: 0.05 };

export function computeOverall(position, attrs) {
  const w = position === "Guarda-redes" ? GK_OVERALL_WEIGHTS : (OVERALL_WEIGHTS[position] ?? OVERALL_WEIGHTS["Médio"]);
  return Math.round(Object.keys(w).reduce((sum, k) => sum + (attrs?.[k] ?? 60) * w[k], 0));
}

/** OVR of a player object ({ position, attrs }). */
export const ovrOf = (p) => computeOverall(p?.position, p?.attrs);

// Team draw supports 2–6 teams; each gets a colour and an editable name.
// Literal hex on purpose (no theme import) — the bot can't load theme.js.
export const TEAM_PALETTE = ["#C8FF00", "#4895FF", "#FF9F0A", "#A78BFA", "#FF6B9D", "#2DD4BF"];
export const TEAM_NAMES = ["Coletes", "Sem coletes", "Equipa 3", "Equipa 4", "Equipa 5", "Equipa 6"];
