// Copy for the PITCH Rivals PR9 features: rematch, share cards, milestones.
// Same convention as rivalsCopy.js / rivalsMatchCopy.js (PT-PT string = key =
// source; L(pt, en, ptBr?) registers EN and — when it differs — PT-BR). PT-BR
// says "time" / "gols" / "horário"; "PITCH Rivals" is a product name and is
// never translated. Honesty rule: milestones and cards use CONFIRMED results
// only, and the streak ones say they describe the current run.

import { registerStrings, t } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};
const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export const SC = {
  // ── Rematch ──
  rematchAction: L("Pedir revanche", "Ask for a rematch", "Pedir revanche"),
  rematchTitle: L("Pedir revanche", "Ask for a rematch", "Pedir revanche"),
  rematchSend: L("Enviar revanche", "Send rematch", "Enviar revanche"),
  rematchHint: L(
    "Mesmas condições do último jogo — só a data muda. Sugerimos o mesmo dia da semana e a mesma hora; ajusta como quiseres.",
    "Same terms as the last match — only the date changes. We suggest the same weekday and time; change it as you like.",
    "Mesmas condições do último jogo — só a data muda. Sugerimos o mesmo dia da semana e o mesmo horário; ajuste como quiser.",
  ),
  rematchPairOpen: L(
    "Já há um desafio em aberto entre as duas equipas — responde a esse primeiro.",
    "There's already an open challenge between the two teams — answer that one first.",
    "Já existe um desafio em aberto entre os dois times — responda esse primeiro.",
  ),
  rematchDone: L("Revanche já combinada.", "Rematch already agreed.", "Revanche já combinada."),
  rematchChip: L("Revanche", "Rematch", "Revanche"),
  rematchOnlyLeaders: L(
    "O capitão ou o vice pode pedir a revanche.",
    "The captain or vice can ask for the rematch.",
    "O capitão ou o vice pode pedir a revanche.",
  ),
  rematchSentToast: L("Revanche enviada.", "Rematch sent.", "Revanche enviada."),

  // ── Share cards ──
  shareResult: L("Partilhar resultado", "Share result", "Compartilhar resultado"),
  shareTeamCard: L("Cartão da equipa", "Team card", "Cartão do time"),
  cardLoading: L("A gerar o cartão…", "Creating the card…", "Gerando o cartão…"),
  cardError: L("Não foi possível gerar o cartão.", "Couldn't create the card.", "Não foi possível gerar o cartão."),
  cardResultAlt: L("Cartão do resultado", "Result card", "Cartão do resultado"),
  cardTeamAlt: L("Cartão da equipa", "Team card", "Cartão do time"),
  cardConfirmed: L("RESULTADO CONFIRMADO", "CONFIRMED RESULT", "RESULTADO CONFIRMADO"),
  cardBothTeams: L("Confirmado pelas duas equipas", "Confirmed by both teams", "Confirmado pelos dois times"),
  cardTeamKicker: L("CARTÃO DA EQUIPA", "TEAM CARD", "CARTÃO DO TIME"),
  cardNoGames: L("Ainda sem jogos confirmados", "No confirmed matches yet", "Ainda sem jogos confirmados"),
  cardScorers: L("MARCADORES", "SCORERS", "ARTILHEIROS"),
  cardAssisters: L("ASSISTÊNCIAS", "ASSISTS", "ASSISTÊNCIAS"),
  cardMilestones: L("MARCOS", "MILESTONES", "MARCOS"),
  cardMore: L("+{n}", "+{n}", "+{n}"),

  // ── Milestones ──
  milestonesTitle: L("Marcos", "Milestones", "Marcos"),
  milestonesLive: L("em curso", "ongoing", "em andamento"),
  milestonesNote: L(
    "Só contam jogos confirmados pelas duas equipas. Sequências descrevem a série atual.",
    "Only matches confirmed by both teams count. Streaks describe the current run.",
    "Só contam jogos confirmados pelos dois times. Sequências descrevem a série atual.",
  ),
  nextMilestone: L("Próximo marco: {label} · faltam {left}", "Next milestone: {label} · {left} to go", "Próximo marco: {label} · faltam {left}"),
  nextMilestoneOne: L("Próximo marco: {label} · falta 1", "Next milestone: {label} · 1 to go", "Próximo marco: {label} · falta 1"),

  msGamesFirst: L("Primeiro jogo", "First match", "Primeiro jogo"),
  msGames: L("{n} jogos", "{n} matches", "{n} jogos"),
  msWinsFirst: L("Primeira vitória", "First win", "Primeira vitória"),
  msWins: L("{n} vitórias", "{n} wins", "{n} vitórias"),
  msCleanFirst: L("Primeiro jogo sem sofrer", "First clean sheet", "Primeiro jogo sem sofrer"),
  msClean: L("{n} jogos sem sofrer", "{n} clean sheets", "{n} jogos sem sofrer"),
  msBigWin: L("Goleada · +{n}", "Thrashing · +{n}", "Goleada · +{n}"),
  msStreak: L("{n} vitórias seguidas", "{n} wins in a row", "{n} vitórias seguidas"),
  msUnbeaten: L("{n} jogos sem perder", "{n} unbeaten", "{n} jogos sem perder"),
  msAppearancesFirst: L("Primeiro jogo pela equipa", "First match for the team", "Primeiro jogo pelo time"),
  msAppearances: L("{n} jogos pela equipa", "{n} matches for the team", "{n} jogos pelo time"),
  msGoalsFirst: L("Primeiro golo", "First goal", "Primeiro gol"),
  msGoals: L("{n} golos", "{n} goals", "{n} gols"),
  msAssistsFirst: L("Primeira assistência", "First assist", "Primeira assistência"),
  msAssists: L("{n} assistências", "{n} assists", "{n} assistências"),
};

// kind → [copy for n === 1, copy for n > 1] (a single entry means no "first" variant)
const LABELS = {
  games: [SC.msGamesFirst, SC.msGames], wins: [SC.msWinsFirst, SC.msWins], clean: [SC.msCleanFirst, SC.msClean],
  bigwin: [SC.msBigWin], streak: [SC.msStreak], unbeaten: [SC.msUnbeaten],
  appearances: [SC.msAppearancesFirst, SC.msAppearances], goals: [SC.msGoalsFirst, SC.msGoals], assists: [SC.msAssistsFirst, SC.msAssists],
};

/** A milestone ({ kind, n }) → its translated label. */
export function milestoneLabel(m) {
  const copy = LABELS[m?.kind];
  if (!copy) return "";
  const key = copy.length > 1 && m.n === 1 ? copy[0] : copy[copy.length - 1];
  return fmt(t(key), { n: m.n });
}
/** nextMilestone() result → the "Próximo marco…" sentence. */
export function nextMilestoneText(next) {
  if (!next) return "";
  return fmt(t(next.left === 1 ? SC.nextMilestoneOne : SC.nextMilestone), { label: milestoneLabel(next), left: next.left });
}

registerStrings("en", EN);
registerStrings("pt-br", BR);
