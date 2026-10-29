// PITCH Ligas — the guided start (Adjunto-led): pure helpers for what the
// Gestor types. The screen is components/league/LeagueOnboarding.jsx.

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const CUP = /ta[çc]a|copa|cup|supertaca|supertaça|eliminat|mata[- ]mata/i;

/** Season label for a date: from July the new season starts ("2026/27"), before it the one in progress. */
export function seasonLabel(date = new Date()) {
  const y = date.getFullYear(); const start = date.getMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** One competition per line (commas and ";" work too) → [{ name, kind }]; duplicates dropped. */
export function parseCompetitionLines(text) {
  const seen = new Set(); const out = [];
  for (const raw of String(text || "").split(/[\n;]+|,(?=\s*\D)/)) {
    const name = clean(raw.replace(/^[-•*\d.)]+\s+(?=\D)/, ""));
    if (name.length < 2 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, kind: CUP.test(name) ? "cup" : "league" });
  }
  return out.slice(0, 12);
}

/** One team per line → rows for importTeams (a header-less single column). */
export function parseTeamLines(text) {
  return String(text || "").split(/\r?\n|;/).map((l) => clean(l.replace(/^[-•*]\s*|^\d+[.)]\s+/, ""))).filter(Boolean).map((name) => [name]);
}

/** Human line for an import problem. */
export const IMPORT_REASON = Object.freeze({
  bad_date: "data inválida",
  bad_time: "hora inválida",
  unknown_team: "equipa desconhecida",
  two_different_teams: "casa e fora iguais",
  duplicate: "jogo repetido",
  name_required: "nome em falta",
  duplicate_number: "número repetido no plantel",
  columns_missing: "faltam colunas (precisa de Data, Casa e Fora)",
  invalid: "linha inválida",
  team_has_matches: "a equipa já tem jogos",
  has_matches: "já tem jogos",
});
