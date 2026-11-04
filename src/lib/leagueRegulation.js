// PITCH Ligas — the league's regulation, kept as text so the Adjunto can check decisions against it.
//
// The Gestor pastes the articles that matter (champion and tie-breaks, promotion and relegation, suspensions, walkovers),
// or hands the Adjunto the PDF and confirms what it proposes to keep. It is stored in state.data.regulation, never
// published (the public projection is a whitelist) and only ever sent to the Adjunto as context. The Adjunto answers
// from it and cites the article; the decision always stays with the direction.
import { SetupError } from "./leagueSetup.js";

export const REGULATION_MAX = 9000;
const cleanText = (s) => String(s ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export const regulationOf = (state) => {
  const r = state?.data?.regulation;
  return r && typeof r.text === "string" && r.text.trim() ? r : null;
};

/** Saves (or replaces) the regulation. An empty text removes it. */
export function saveRegulation(state, { name = "", text = "", at = null } = {}) {
  const body = cleanText(text);
  if (!body) {
    const { regulation, ...data } = state.data; // eslint-disable-line no-unused-vars
    return { ...state, data };
  }
  if (body.length < 40) throw new SetupError("invalid", "regulation_short");
  return { ...state, data: { ...state.data, regulation: { name: cleanText(name).slice(0, 80) || "Regulamento", text: body.slice(0, REGULATION_MAX), updatedAt: at || new Date().toISOString() } } };
}

/** The question for the Adjunto about the champion of a competition, with the table already in the context. */
export function championQuestion(competitionName, proposedName) {
  return `Com base no regulamento guardado, quem é o campeão de «${competitionName}»? A classificação final propõe ${proposedName || "ninguém"}. Verifica desempates, penalizações, desistências e jogos em falta, e cita o artigo. Se o regulamento não cobrir o caso, diz-me.`;
}
