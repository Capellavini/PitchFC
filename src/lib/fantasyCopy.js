// Pitch Manager v2 copy: EN / PT-BR strings for the Fantasy components
// (keys = PT-PT source text, see i18n.registerStrings — never overrides a
// shared entry), the server error codes → copy, and season labels.
import { registerStrings, t } from "./i18n";
import { MONTHS_PT } from "./helpers";

const EN = {
  "Modo": "Mode", "Clássico": "Classic", "orçamento e preços": "budget & prices", "em breve": "coming soon",
  "Titulares": "Starters", "no banco": "on the bench", "na última ronda": "last round",
  "A liga não acaba: há Taça do Mês e Campeonato da Época, que renovam sozinhos.": "The league never ends: a Monthly Cup and a Season Championship renew on their own.",
  "dias": "days",
  "Ronda em curso — as mudanças contam para a próxima ronda.": "Round in progress — changes count for the next round.",
  "Fecha às": "Locks at", "começo do jogo": "kick-off", "faltam": "in",
  "Fecha no começo do próximo jogo.": "Locks at the next kick-off.",
  "Transferências ilimitadas até à primeira ronda fechar.": "Unlimited transfers until the first round locks.",
  "transferências": "transfers", "pts na próxima ronda": "pts next round",
  "transferência grátis": "free transfer", "transferências grátis": "free transfers",
  "a seguinte custa": "the next one costs", "Sem transferências grátis": "No free transfers", "a próxima custa": "the next one costs",
  "2.º MVP": "2nd MVP", "3.º MVP": "3rd MVP", "Jogou": "Played", "Assist.": "Ast.", "Defesas": "Saves", "Sem sofrer": "Clean sheet",
  "Vitórias": "Wins", "Hat-trick": "Hat-trick", "Autogolos": "Own goals", "Faltou": "No-show",
  "A tua última ronda": "Your last round", "Capitão ×2": "Captain ×2", "Vice ×2": "Vice ×2", "Entrou por": "Came on for",
  "Não jogou — substituído por": "Didn't play — replaced by", "Não jogou": "Didn't play", "Transferências extra": "Extra transfers",
  "Sem sofrer e vitórias contam por jogo da noite. Quem não jogou é trocado pelo primeiro suplente que jogou.": "Clean sheets and wins count per game of the night. Anyone who didn't play is replaced by the first sub who did.",
  "Taça do Mês": "Monthly Cup", "Campeonato": "Championship", "Temporada 1": "Season 1", "Campeonato da Época": "Season Championship",
  "A abrir a próxima temporada…": "Opening the next season…", "Ainda sem rondas pontuadas nesta competição.": "No scored rounds in this competition yet.",
  "ronda": "round", "rondas": "rounds", "Campeões": "Champions",
  "título": "title", "títulos": "titles", "pódio": "podium", "pódios": "podiums",
  "Vice-capitão": "Vice-captain", "Por ordem: o 1.º entra por quem não jogar.": "In order: the 1st comes on for whoever doesn't play.",
  "Sem suplentes — compra mais jogadores para teres banco.": "No subs — buy more players to have a bench.",
  "Subir no banco": "Move up the bench", "Já é o vice-capitão": "Already vice-captain", "Tornar vice-capitão": "Make vice-captain",
  "Entra se um titular não jogar — o 1.º do banco tem prioridade.": "Comes on if a starter doesn't play — the 1st sub goes first.",
  "O capitão pontua a dobrar. Se ele não jogar, o vice-capitão herda o ×2.": "The captain scores double. If he doesn't play, the vice-captain gets the ×2.",
  "confirmado": "confirmed", "não vai": "not going", "pendente": "pending", "Próximo jogo": "Next game",
  "Preço a subir": "Price rising", "Preço a descer": "Price falling",
  "titulares, capitão e vice-capitão. Extras ficam no banco e entram se alguém faltar.": "starters, a captain and a vice-captain. Extras sit on the bench and come on if someone misses the game.",
  "titulares; os restantes ficam no banco, pela ordem em que os escolheste.": "starters; the rest sit on the bench, in the order you picked them.",
  "Volta a calcular as rondas a partir dos dias de jogo gravados": "Recalculates the rounds from the saved matchdays",
  "A recalcular…": "Recalculating…", "Recalcular": "Recalculate", "Última ronda": "Last round", "transf.": "transf.",
  "A Taça do Mês fecha no fim de cada mês e o Campeonato a 31 de julho — os campeões ficam no Perfil.": "The Monthly Cup closes at the end of each month and the Championship on 31 July — champions show on the profile.",
  "PTS NA ÉPOCA": "SEASON PTS", "Uma troca aceite conta como transferência na próxima ronda.": "An accepted trade counts as a transfer next round.",
  "Esta liga já não está ativa.": "This league is no longer active.", "Não és membro deste grupo.": "You're not a member of this group.",
  "Faltam jogadores para completar os titulares.": "Not enough players to fill the starters.",
  "Só podes escolher jogadores deste grupo.": "You can only pick players from this group.",
  "Esse jogador já tem o número máximo de managers — faz uma oferta de troca.": "That player already has the maximum number of managers — make a trade offer.",
  "O modo Draft chega em breve.": "Draft mode is coming soon.", "Só o organizador pode recalcular.": "Only the organizer can recalculate.",
  "Sem sessão.": "Not signed in.",
  MED: "MID", AVA: "FWD", DEF: "DEF", GR: "GK",
  Jan: "Jan", Fev: "Feb", Mar: "Mar", Abr: "Apr", Mai: "May", Jun: "Jun", Jul: "Jul", Ago: "Aug", Set: "Sep", Out: "Oct", Nov: "Nov", Dez: "Dec",
};

const PT_BR = {
  "Modo": "Modo", "Clássico": "Clássico", "orçamento e preços": "orçamento e preços", "em breve": "em breve",
  "Titulares": "Titulares", "no banco": "no banco", "na última ronda": "na última rodada",
  "A liga não acaba: há Taça do Mês e Campeonato da Época, que renovam sozinhos.": "A liga não acaba: tem Taça do Mês e Campeonato da Temporada, que renovam sozinhos.",
  "Ronda em curso — as mudanças contam para a próxima ronda.": "Rodada em andamento — as mudanças valem para a próxima rodada.",
  "Fecha às": "Fecha às", "começo do jogo": "início do jogo", "faltam": "faltam",
  "Fecha no começo do próximo jogo.": "Fecha no início do próximo jogo.",
  "Transferências ilimitadas até à primeira ronda fechar.": "Transferências ilimitadas até a primeira rodada fechar.",
  "pts na próxima ronda": "pts na próxima rodada",
  "A tua última ronda": "Sua última rodada", "Assist.": "Assist.", "Defesas": "Defesas", "Sem sofrer": "Sem sofrer gol",
  "Autogolos": "Gols contra", "Faltou": "Faltou", "Entrou por": "Entrou no lugar de",
  "Sem sofrer e vitórias contam por jogo da noite. Quem não jogou é trocado pelo primeiro suplente que jogou.": "Jogos sem sofrer gol e vitórias contam por partida da noite. Quem não jogou é trocado pelo primeiro reserva que jogou.",
  "Campeonato da Época": "Campeonato da Temporada", "A abrir a próxima temporada…": "Abrindo a próxima temporada…",
  "Ainda sem rondas pontuadas nesta competição.": "Ainda sem rodadas pontuadas nesta competição.",
  "ronda": "rodada", "rondas": "rodadas",
  "Por ordem: o 1.º entra por quem não jogar.": "Por ordem: o 1.º entra no lugar de quem não jogar.",
  "Sem suplentes — compra mais jogadores para teres banco.": "Sem reservas — compre mais jogadores para ter banco.",
  "Subir no banco": "Subir no banco", "Entra se um titular não jogar — o 1.º do banco tem prioridade.": "Entra se um titular não jogar — o 1.º do banco tem prioridade.",
  "O capitão pontua a dobrar. Se ele não jogar, o vice-capitão herda o ×2.": "O capitão pontua em dobro. Se ele não jogar, o vice-capitão herda o ×2.",
  "Próximo jogo": "Próximo jogo",
  "titulares, capitão e vice-capitão. Extras ficam no banco e entram se alguém faltar.": "titulares, capitão e vice-capitão. Extras ficam no banco e entram se alguém faltar.",
  "titulares; os restantes ficam no banco, pela ordem em que os escolheste.": "titulares; os outros ficam no banco, na ordem em que você escolheu.",
  "Volta a calcular as rondas a partir dos dias de jogo gravados": "Recalcula as rodadas a partir dos dias de jogo salvos",
  "Última ronda": "Última rodada",
  "A Taça do Mês fecha no fim de cada mês e o Campeonato a 31 de julho — os campeões ficam no Perfil.": "A Taça do Mês fecha no fim de cada mês e o Campeonato em 31 de julho — os campeões ficam no Perfil.",
  "PTS NA ÉPOCA": "PTS NA TEMPORADA", "Uma troca aceite conta como transferência na próxima ronda.": "Uma troca aceita conta como transferência na próxima rodada.",
  "Não és membro deste grupo.": "Você não é membro deste grupo.",
  "Esse jogador já tem o número máximo de managers — faz uma oferta de troca.": "Esse jogador já tem o número máximo de managers — faça uma oferta de troca.",
  "Sem sessão.": "Sem sessão.",
};

registerStrings("en", EN);
registerStrings("pt-br", PT_BR);

const ERRORS = {
  auth: "Sem sessão.",
  no_league: "Esta liga já não está ativa.",
  not_member: "Não és membro deste grupo.",
  squad_incomplete: "Faltam jogadores para completar os titulares.",
  not_in_group: "Só podes escolher jogadores deste grupo.",
  injured: "Não podes escalar um jogador lesionado.",
  ownership_cap: "Esse jogador já tem o número máximo de managers — faz uma oferta de troca.",
  over_budget: "Orçamento insuficiente para esta escalação.",
  draft_soon: "O modo Draft chega em breve.",
  not_allowed: "Só o organizador pode recalcular.",
};

/** Server message "fantasy:<code>" → localized copy; anything else (the
 *  trade RPC's PT messages, network errors) passes through t(). */
export function fantasyErrorText(message) {
  const m = /fantasy:([a-z_]+)/.exec(message || "");
  return t(m && ERRORS[m[1]] ? ERRORS[m[1]] : (message || ""));
}

/** Season row → display label: month "2026-10" → "Out 2026"; Campeonato
 *  keeps its "2026/27"; legacy → "Temporada 1". */
export function seasonLabel(s) {
  if (!s) return "";
  if (s.kind === "legacy") return t("Temporada 1");
  if (s.kind === "month" && /^\d{4}-\d{2}$/.test(s.label || "")) {
    return `${t(MONTHS_PT[Number(s.label.slice(5)) - 1])} ${s.label.slice(0, 4)}`;
  }
  return s.label || "";
}
