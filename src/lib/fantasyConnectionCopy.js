// Conexão da Rodada copy: EN / PT-BR strings (keys = PT-PT source text, see
// i18n.registerStrings — never overrides a shared entry) + the texts that
// depend on a rule code. UI states follow the revamp brief §7.
import { registerStrings, t } from "./i18n";

const EN = {
  "Conexão da ronda": "Round Connection", "Opcional": "Optional", "Cria a tua conexão da ronda": "Build your round Connection",
  "Escolhe quem dá a assistência e quem marca. +3 por golo, máximo +6, sem multiplicador. Não custa transferências.":
    "Pick who sets up the goal and who scores it. +3 per goal, max +6, no multiplier. It costs no transfers.",
  "Escolher a dupla": "Pick the pair", "Por resolver": "To fix", "Guardada": "Saved", "Rascunho": "Draft",
  "Assistência de": "Assist by", "para golo de": "for a goal by",
  "Conexão guardada para a ronda": "Connection saved for round", "Podes alterá-la até ao fecho.": "You can change it until the lock.",
  "Ainda não guardada — confirma abaixo para valer na ronda.": "Not saved yet — confirm below for it to count this round.",
  "Guardar conexão e escalação": "Save Connection and lineup", "Escolher outro": "Pick another", "Alterar": "Change", "Remover": "Remove",
  "Continuar sem conexão": "Continue without a Connection",
  "Quem dá a assistência": "Who gives the assist", "Quem marca": "Who scores", "Criador": "Creator", "Finalizador": "Finisher",
  "Usar esta dupla": "Use this pair", "Escolhe quem finaliza": "Pick who finishes", "Escolhe quem cria": "Pick who creates",
  "Só os titulares podem formar a dupla. A direção importa: quem dá a assistência não é quem marca.":
    "Only starters can form the pair. Direction matters: the one who assists isn't the one who scores.",
  "O criador já não está entre os titulares": "The creator is no longer among the starters",
  "O finalizador já não está entre os titulares": "The finisher is no longer among the starters",
  "Escolhe dois jogadores diferentes": "Pick two different players",
  "Estão em equipas opostas neste sorteio — não podem jogar juntos": "They are on opposite teams in this draw — they can't play together",
  "Ainda não há equipas sorteadas: a conexão só pontua se jogarem na mesma equipa.": "Teams aren't drawn yet: the Connection only scores if they play on the same team.",
  "Não foi possível guardar. O rascunho foi mantido.": "Couldn't save. Your draft was kept.",
  "Conexão desta ronda": "This round's Connection", "Conexão ativada": "Connection activated", "limite da ronda alcançado": "round limit reached",
  "A conexão não foi ativada nesta ronda": "The Connection wasn't activated this round",
  "Sem lances que liguem os dois. +0, sem desconto.": "No plays linking the two. +0, no penalty.",
  "Faltam dados para apurar a conexão": "Missing data to settle the Connection",
  "Mantemos a pontuação base. Isto não conta como falha tua.": "The base score stands. This isn't counted against you.",
  "Sem conexão nesta ronda": "No Connection this round", "Não escolheste uma dupla. Sem penalização.": "You didn't pick a pair. No penalty.",
  "lance em apuração": "play being settled", "lances em apuração": "plays being settled",
  "Ainda não conta para o total oficial.": "Doesn't count toward the official total yet.",
  "assistência para golo confirmada": "assist for a confirmed goal", "assistências para golo confirmadas": "assists for confirmed goals",
  "de": "of", "lances com bónus nesta ronda": "bonus plays this round", "O lance que fez a diferença": "The play that made the difference",
  "Os lances que fizeram a diferença": "The plays that made the difference", "Jogo": "Game", "Golo": "Goal", "Assistência": "Assist",
  "sem bónus (limite)": "no bonus (limit)", "Ver registo do lance": "See the play record",
  "Um lance, um bónus. O capitão não multiplica os pontos da conexão.": "One play, one bonus. The captain doesn't multiply Connection points.",
  "do plantel": "from the squad", "da conexão": "from the Connection", "Total base": "Base total",
  "Conexão": "Connection", "Bónus da conexão": "Connection bonus",
  "Meu time": "My team", "Mercado": "Market", "Rodada": "Round", "Ranking": "Ranking",
  "Ronda": "Round", "Fecha em": "Locks in", "A ronda fechou": "The round has locked",
  "Saldo": "Balance", "Valor do plantel": "Squad value", "Transferências": "Transfers", "grátis": "free",
  "O teu último jogo": "Your last game", "Na tua liga": "In your league", "Em boa fase": "In form",
  "Ainda sem rondas pontuadas.": "No scored rounds yet.", "Sem dados suficientes para mostrar quem está em boa fase.": "Not enough data to show who is in form.",
  "na ronda": "in the round", "fez": "scored", "como capitão": "as captain",
  "Sai": "Out", "Entra": "In", "Saldo depois": "Balance after", "Desconto de transferências": "Transfer penalty",
  "Nenhuma troca por gravar.": "No changes to save.", "Resolve a conexão antes de guardar.": "Fix the Connection before saving.",
  "Remover a conexão?": "Remove the Connection?", "Este jogador faz parte da tua conexão. Se o enviares para o banco, a conexão é removida.":
    "This player is part of your Connection. If you move him to the bench the Connection is removed.",
  "Remover conexão e enviar": "Remove Connection and bench", "Cancelar": "Cancel",
  "Escolhe a ronda": "Choose the round", "Ronda encerrada": "Closed round", "Ainda sem rondas encerradas para mostrar.": "No closed rounds to show yet.",
  "Total da ronda": "Round total", "Apuração concluída": "Settled", "Ver classificação": "See standings",
  "A conexão da ronda em curso já fechou. Esta escolha vale para a próxima.": "The current round's Connection is already locked. This choice counts for the next one.",
  "Dados insuficientes": "Insufficient data", "Provisória": "Provisional", "pontos": "points", "Ver registo do jogo": "See the game record",
  "Contexto": "Context", "Capitão e transferências já estão incluídos no total base.": "Captain and transfers are already in the base total.",
  "Não tinhas escalação nesta ronda.": "You had no lineup this round.",
};

const PT_BR = {
  "Conexão da ronda": "Conexão da rodada", "Cria a tua conexão da ronda": "Crie a sua conexão da rodada",
  "Escolhe quem dá a assistência e quem marca. +3 por golo, máximo +6, sem multiplicador. Não custa transferências.":
    "Escolha quem dá a assistência e quem marca. +3 por gol, máximo +6, sem multiplicador. Não custa transferências.",
  "Escolher a dupla": "Escolher a dupla", "Assistência de": "Assistência de", "para golo de": "para gol de",
  "Conexão guardada para a ronda": "Conexão salva para a rodada", "Podes alterá-la até ao fecho.": "Você pode alterar até o fechamento.",
  "Ainda não guardada — confirma abaixo para valer na ronda.": "Ainda não salva — confirme abaixo para valer na rodada.",
  "Guardar conexão e escalação": "Salvar conexão e escalação", "Guardada": "Salva", "Escolher outro": "Escolher outro",
  "Continuar sem conexão": "Continuar sem conexão", "Quem marca": "Quem faz o gol",
  "Escolhe dois jogadores diferentes": "Escolha dois jogadores diferentes",
  "Estão em equipas opostas neste sorteio — não podem jogar juntos": "Estão em times opostos neste sorteio — não podem jogar juntos",
  "Ainda não há equipas sorteadas: a conexão só pontua se jogarem na mesma equipa.": "Ainda não há times sorteados: a conexão só pontua se jogarem no mesmo time.",
  "Não foi possível guardar. O rascunho foi mantido.": "Não foi possível salvar. O rascunho foi mantido.",
  "Conexão desta ronda": "Conexão desta rodada", "limite da ronda alcançado": "limite da rodada alcançado",
  "A conexão não foi ativada nesta ronda": "A conexão não foi ativada nesta rodada",
  "Faltam dados para apurar a conexão": "Faltam dados para apurar a conexão",
  "Mantemos a pontuação base. Isto não conta como falha tua.": "Mantemos a pontuação base. Isso não conta como falha sua.",
  "Sem conexão nesta ronda": "Sem conexão nesta rodada", "Não escolheste uma dupla. Sem penalização.": "Você não escolheu uma dupla. Sem penalização.",
  "assistência para golo confirmada": "assistência para gol confirmada", "assistências para golo confirmadas": "assistências para gol confirmadas",
  "lances com bónus nesta ronda": "lances com bônus nesta rodada", "Golo": "Gol", "Bónus da conexão": "Bônus da conexão",
  "Um lance, um bónus. O capitão não multiplica os pontos da conexão.": "Um lance, um bônus. O capitão não multiplica os pontos da conexão.",
  "sem bónus (limite)": "sem bônus (limite)", "Ronda": "Rodada", "Fecha em": "Fecha em", "A ronda fechou": "A rodada fechou",
  "Na tua liga": "Na sua liga", "O teu último jogo": "Seu último jogo", "na ronda": "na rodada",
  "Resolve a conexão antes de guardar.": "Resolva a conexão antes de salvar.", "Remover a conexão?": "Remover a conexão?",
  "Este jogador faz parte da tua conexão. Se o enviares para o banco, a conexão é removida.": "Este jogador faz parte da sua conexão. Se enviá-lo para o banco, a conexão é removida.",
  "Escolhe a ronda": "Escolha a rodada", "Ronda encerrada": "Rodada encerrada", "Ainda sem rondas encerradas para mostrar.": "Ainda sem rodadas encerradas para mostrar.",
  "Total da ronda": "Total da rodada", "Ainda sem rondas pontuadas.": "Ainda sem rodadas pontuadas.",
  "A conexão da ronda em curso já fechou. Esta escolha vale para a próxima.": "A conexão da rodada em andamento já fechou. Esta escolha vale para a próxima.",
  "Escolhe quem finaliza": "Escolha quem finaliza", "Escolhe quem cria": "Escolha quem cria", "Nenhuma troca por gravar.": "Nenhuma troca para salvar.",
  "Ver registo do jogo": "Ver registro do jogo", "Não tinhas escalação nesta ronda.": "Você não tinha escalação nesta rodada.",
};

registerStrings("en", EN);
registerStrings("pt-br", PT_BR);

/** connectionDraftIssue() code → line shown on the card and in the picker. */
export function connectionIssueText(issue, pair) {
  switch (issue) {
    case "creator_not_starter": return t("O criador já não está entre os titulares");
    case "finisher_not_starter": return t("O finalizador já não está entre os titulares");
    case "same_player": return t("Escolhe dois jogadores diferentes");
    case "split_teams": return t("Estão em equipas opostas neste sorteio — não podem jogar juntos");
    case "incomplete_finisher": return t("Escolhe quem finaliza");
    case "incomplete_creator": return t("Escolhe quem cria");
    default: return pair ? "" : t("Escolhe dois jogadores diferentes");
  }
}
