// Copy for the PITCH Rivals MATCH screens (PR7): call-up, who plays, the
// shared result, goals/assists, head-to-head, scouting, team stats card.
// Same convention as rivalsCopy.js (PT-PT string = key = source; L(pt, en,
// ptBr?) registers EN and — when it differs — PT-BR). PT-BR says "time" /
// "gols" / "convocação"; "PITCH Rivals" is a product name, never translated.
// Honesty rule: the official score only exists after the OTHER team
// confirms it, and goals/assists are post-game entries (no live engine).

import { registerStrings } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

export const MC = {
  // ── Call-up (convocatória) ──
  callUpClosed: L("O jogo já começou — a convocatória está fechada.", "The match has started — the call-up is closed.", "O jogo já começou — a convocação está fechada."),
  countYes: L("{n} vão", "{n} in", "{n} vão"),
  countMaybe: L("{n} talvez", "{n} maybe", "{n} talvez"),
  countNo: L("{n} não vão", "{n} out", "{n} não vão"),
  countPending: L("{n} sem resposta", "{n} no answer", "{n} sem resposta"),
  answersTitle: L("RESPOSTAS DA EQUIPA", "SQUAD ANSWERS", "RESPOSTAS DO TIME"),
  showAnswers: L("Ver respostas", "See answers"),
  hideAnswers: L("Esconder respostas", "Hide answers", "Esconder respostas"),
  statusYes: L("Vai", "In", "Vai"),
  statusNo: L("Não vai", "Out", "Não vai"),
  statusMaybe: L("Talvez", "Maybe", "Talvez"),
  statusPending: L("Sem resposta", "No answer", "Sem resposta"),
  nudgePending: L("Lembrar quem falta", "Remind who's missing", "Lembrar quem falta"),
  nudgeMessage: L(
    "⚽ {names}, falta responderem à convocatória de {team} vs {opp} ({when}). Respondam no PITCH: {url}",
    "⚽ {names}, we're still missing your answer for {team} vs {opp} ({when}). Answer on PITCH: {url}",
    "⚽ {names}, falta responderem à convocação do {team} contra {opp} ({when}). Respondam no PITCH: {url}",
  ),
  noAnswersYet: L("Ainda ninguém respondeu.", "Nobody has answered yet.", "Ainda ninguém respondeu."),
  loadingAnswers: L("A carregar respostas…", "Loading answers…", "Carregando respostas…"),
  rsvpSavedYes: L("Combinado — estás na lista.", "Done — you're on the list.", "Combinado — você está na lista."),

  // ── Who plays (lineup) ──
  lineupTitle: L("Quem joga", "Who's playing", "Quem joga"),
  lineupPick: L("Escolher quem joga", "Pick who plays", "Escolher quem joga"),
  lineupEdit: L("Alterar quem joga", "Change who plays", "Alterar quem joga"),
  lineupN: L("{n} a jogar", "{n} playing", "{n} jogando"),
  lineupNone: L("Ainda sem lista de quem joga.", "Nobody picked to play yet.", "Ainda sem lista de quem joga."),
  lineupHint: L("Pré-selecionámos quem respondeu “Vou”. Ajusta e guarda.", "We pre-selected everyone who answered “I'm in”. Adjust and save.", "Pré-selecionamos quem respondeu “Vou”. Ajuste e salve."),
  lineupFormat: L("Formato {format} · até {max} jogadores", "{format} format · up to {max} players", "Formato {format} · até {max} jogadores"),
  lineupSelected: L("{n} selecionados", "{n} selected", "{n} selecionados"),
  lineupSave: L("Guardar lista", "Save list", "Salvar lista"),
  lineupSaved: L("Lista guardada.", "List saved.", "Lista salva."),
  lineupMax: L("Máximo de {n} jogadores.", "Up to {n} players.", "Máximo de {n} jogadores."),
  lineupEmptySquad: L("Ainda ninguém no plantel.", "Nobody in the squad yet.", "Ainda ninguém no elenco."),

  // ── Shared result ──
  resultBefore: L("O resultado regista-se depois do jogo.", "The result is logged after the match.", "O resultado é registrado depois do jogo."),
  resultReady: L(
    "Jogo terminado? Regista o resultado. Só conta como oficial depois de {team} o confirmar.",
    "Match over? Log the result. It only counts as official once {team} confirms it.",
    "Jogo terminado? Registre o resultado. Só vale como oficial depois que o {team} confirmar.",
  ),
  resultReadyMember: L("Quando o jogo acabar, o capitão regista o resultado.", "When the match ends, your captain logs the result.", "Quando o jogo acabar, o capitão registra o resultado."),
  reportAction: L("Registar resultado", "Log the result", "Registrar resultado"),
  notPlayedAction: L("O jogo não se realizou", "The match wasn't played", "O jogo não aconteceu"),
  notPlayedConfirm: L("Marcar como não realizado? Fica registado e não conta como derrota para ninguém.", "Mark as not played? It's recorded and doesn't count as a loss for anyone.", "Marcar como não realizado? Fica registrado e não conta como derrota para ninguém."),
  notPlayedConfirmLabel: L("Marcar como não realizado", "Mark as not played", "Marcar como não realizado"),
  notPlayedDone: L("Marcado como não realizado.", "Marked as not played.", "Marcado como não realizado."),
  notPlayedState: L("Jogo não realizado", "Match not played", "Jogo não realizado"),
  notPlayedBody: L("Não conta como vitória nem derrota para nenhuma equipa.", "It counts as neither a win nor a loss for either team.", "Não conta como vitória nem derrota para nenhum time."),
  reportTitle: L("Registar o resultado", "Log the result", "Registrar o resultado"),
  reportHint: L(
    "Só fica oficial depois de {team} confirmar. Se não concordarem, qualquer das equipas pode enviar outro resultado.",
    "It only becomes official once {team} confirms. If you disagree, either team can send another score.",
    "Só fica oficial depois que o {team} confirmar. Se não concordarem, qualquer time pode enviar outro resultado.",
  ),
  scoreGroup: L("Resultado", "Score", "Resultado"),
  resultNotePh: L("Nota (opcional) — ex.: golo anulado", "Note (optional) — e.g. goal disallowed", "Nota (opcional) — ex.: gol anulado"),
  submitReport: L("Enviar para confirmação", "Send for confirmation", "Enviar para confirmação"),
  reportedToast: L("Resultado enviado. Só fica oficial quando {team} confirmar.", "Result sent. It only becomes official when {team} confirms.", "Resultado enviado. Só fica oficial quando o {team} confirmar."),
  badgeProvisional: L("Provisório", "Provisional", "Provisório"),
  badgeOfficial: L("Oficial", "Official", "Oficial"),
  badgeDisputed: L("Em disputa", "Disputed", "Em disputa"),
  stateReportedMine: L("À espera de {team} confirmar", "Waiting for {team} to confirm", "Esperando o {team} confirmar"),
  stateReportedTheirs: L("{team} registou este resultado", "{team} logged this result", "O {team} registrou este resultado"),
  stateDisputedMine: L("Enviaste outro resultado — à espera de {team}", "You sent another score — waiting for {team}", "Você enviou outro resultado — esperando o {team}"),
  stateDisputedTheirs: L("{team} propõe outro resultado", "{team} proposes another score", "O {team} propõe outro resultado"),
  stateConfirmed: L("Confirmado pelas duas equipas", "Confirmed by both teams", "Confirmado pelos dois times"),
  stateCorrectionMine: L("Correção enviada — à espera de {team}", "Correction sent — waiting for {team}", "Correção enviada — esperando o {team}"),
  stateCorrectionTheirs: L("{team} propõe uma correção", "{team} proposes a correction", "O {team} propõe uma correção"),
  provisionalNote: L(
    "Provisório: não conta para o registo nem para as estatísticas até a outra equipa confirmar.",
    "Provisional: it doesn't count towards the record or stats until the other team confirms.",
    "Provisório: não conta para o retrospecto nem para as estatísticas até o outro time confirmar.",
  ),
  correctionNote: L("O resultado oficial ({score}) mantém-se até {team} confirmar a correção.", "The official score ({score}) stands until {team} confirms the correction.", "O resultado oficial ({score}) continua até o {team} confirmar a correção."),
  proposedNote: L("Proposto: {score}", "Proposed: {score}", "Proposto: {score}"),
  respondAction: L("Confirmar ou contestar", "Confirm or contest", "Confirmar ou contestar"),
  respondTitle: L("{team} registou o resultado", "{team} logged the result", "O {team} registrou o resultado"),
  respondHint: L("Foi mesmo assim que o jogo acabou? Se confirmares, fica oficial para as duas equipas.", "Is that really how the match ended? If you confirm, it becomes official for both teams.", "Foi mesmo assim que o jogo acabou? Se você confirmar, fica oficial para os dois times."),
  confirmAction: L("Confirmar resultado", "Confirm result", "Confirmar resultado"),
  contestAction: L("Não é este o resultado", "That's not the score", "Esse não é o resultado"),
  contestTitle: L("Qual foi o resultado?", "What was the score?", "Qual foi o resultado?"),
  contestHint: L("Indica o resultado que a tua equipa tem. {team} vai ter de o confirmar.", "Enter the score your team has. {team} will have to confirm it.", "Informe o resultado que o seu time tem. O {team} vai precisar confirmar."),
  submitContest: L("Enviar outro resultado", "Send another score", "Enviar outro resultado"),
  backToProposal: L("Voltar à proposta", "Back to the proposal", "Voltar à proposta"),
  confirmedToast: L("Resultado confirmado — já conta para as duas equipas.", "Result confirmed — it now counts for both teams.", "Resultado confirmado — já vale para os dois times."),
  contestedToast: L("Enviaste outro resultado. À espera de {team}.", "You sent another score. Waiting for {team}.", "Você enviou outro resultado. Esperando o {team}."),
  withdrawAction: L("Retirar proposta", "Withdraw proposal", "Retirar proposta"),
  withdrawTitle: L("Retirar a proposta?", "Withdraw the proposal?", "Retirar a proposta?"),
  withdrawBody: L("O resultado {score} deixa de estar à espera de confirmação e podes registar outro.", "The score {score} stops waiting for confirmation and you can log another.", "O resultado {score} deixa de esperar confirmação e você pode registrar outro."),
  withdrawConfirm: L("Retirar", "Withdraw", "Retirar"),
  keep: L("Manter", "Keep it", "Manter"),
  withdrawnToast: L("Proposta retirada.", "Proposal withdrawn.", "Proposta retirada."),
  correctAction: L("Corrigir resultado", "Correct the result", "Corrigir resultado"),
  correctTitle: L("Propor uma correção", "Propose a correction", "Propor uma correção"),
  correctHint: L("O resultado oficial ({score}) mantém-se até {team} confirmar a correção.", "The official score ({score}) stands until {team} confirms the correction.", "O resultado oficial ({score}) continua até o {team} confirmar a correção."),
  submitCorrect: L("Propor correção", "Propose correction", "Propor correção"),
  correctedToast: L("Correção enviada. O resultado oficial mantém-se até {team} confirmar.", "Correction sent. The official score stands until {team} confirms.", "Correção enviada. O resultado oficial continua até o {team} confirmar."),
  asLeaderOnly: L("Só o capitão ou o vice podem confirmar o resultado.", "Only the captain or vice can confirm the result.", "Só o capitão ou o vice podem confirmar o resultado."),
  memberSeesProposal: L("{team} registou {score}. O teu capitão ou vice tem de confirmar ou contestar.", "{team} logged {score}. Your captain or vice has to confirm or contest.", "O {team} registrou {score}. Seu capitão ou vice precisa confirmar ou contestar."),
  // history
  historyShow: L("Ver histórico do resultado", "See the result history", "Ver histórico do resultado"),
  historyHide: L("Esconder histórico", "Hide history", "Esconder histórico"),
  historyTitle: L("HISTÓRICO DO RESULTADO", "RESULT HISTORY", "HISTÓRICO DO RESULTADO"),
  revN: L("Revisão {n}", "Revision {n}", "Revisão {n}"),
  kindReport: L("Resultado registado", "Result logged", "Resultado registrado"),
  kindCounter: L("Outro resultado", "Another score", "Outro resultado"),
  kindCorrection: L("Correção", "Correction", "Correção"),
  revProposed: L("À espera", "Waiting", "Esperando"),
  revConfirmed: L("Confirmado", "Confirmed", "Confirmado"),
  revDisputed: L("Contestado", "Contested", "Contestado"),
  revSuperseded: L("Substituído", "Replaced", "Substituído"),
  revWithdrawn: L("Retirado", "Withdrawn", "Retirado"),
  noHistory: L("Ainda sem propostas.", "No proposals yet.", "Ainda sem propostas."),
  // support
  helpTitle: L("Precisas de ajuda? Fala connosco", "Need help? Talk to us", "Precisa de ajuda? Fale com a gente"),
  helpBody: L(
    "Quando as equipas não se entendem não decidimos por ninguém — mas ajudamos a resolver. Fala com o PITCH no WhatsApp.",
    "When teams can't agree we don't pick a side — but we help sort it out. Talk to PITCH on WhatsApp.",
    "Quando os times não se entendem a gente não decide por ninguém — mas ajuda a resolver. Fale com o PITCH no WhatsApp.",
  ),
  helpLimit: L(
    "Já houve {n} propostas de resultado. Para evitar o vai-e-vem, só dá para confirmar a última ou falar connosco.",
    "There have been {n} score proposals. To avoid going back and forth you can only confirm the latest one or talk to us.",
    "Já houve {n} propostas de resultado. Para evitar o vai e vem, só dá para confirmar a última ou falar com a gente.",
  ),
  helpStale: L("Este resultado está à espera há mais de 7 dias.", "This result has been waiting for more than 7 days.", "Este resultado está esperando há mais de 7 dias."),
  helpOpen: L("Falar com o PITCH", "Talk to PITCH", "Falar com o PITCH"),
  helpMessage: L("Olá! Preciso de ajuda com o resultado de {team} vs {opp} ({when}) no PITCH Rivals.", "Hi! I need help with the result of {team} vs {opp} ({when}) on PITCH Rivals.", "Olá! Preciso de ajuda com o resultado de {team} contra {opp} ({when}) no PITCH Rivals."),

  // ── Goals and assists (post-game, no live engine) ──
  statsTitle: L("GOLOS E ASSISTÊNCIAS", "GOALS AND ASSISTS", "GOLS E ASSISTÊNCIAS"),
  statsEntry: L("Registar golos e assistências", "Log goals and assists", "Registrar gols e assistências"),
  statsEdit: L("Editar golos e assistências", "Edit goals and assists", "Editar gols e assistências"),
  statsInfo: L(
    "Informativo: só entra nas estatísticas dos jogadores quando o resultado for confirmado.",
    "Informational: it only counts towards player stats once the result is confirmed.",
    "Informativo: só entra nas estatísticas dos jogadores quando o resultado for confirmado.",
  ),
  statsNone: L("Ainda sem golos nem assistências registados.", "No goals or assists logged yet.", "Ainda sem gols nem assistências registrados."),
  statsSheetTitle: L("Golos e assistências", "Goals and assists", "Gols e assistências"),
  statsSheetHint: L("Registo depois do jogo, jogador a jogador. Não é um marcador ao vivo.", "Logged after the match, player by player. It isn't a live scorer.", "Registro depois do jogo, jogador a jogador. Não é um placar ao vivo."),
  statsFromLineup: L("Jogadores da lista de quem joga.", "Players from the who's-playing list.", "Jogadores da lista de quem joga."),
  statsFromSquad: L("Sem lista de quem joga — mostramos todo o plantel.", "No who's-playing list — showing the whole squad.", "Sem lista de quem joga — mostramos todo o elenco."),
  goalsLabel: L("Golos", "Goals", "Gols"),
  assistsLabel: L("Assistências", "Assists", "Assistências"),
  goalsShort: L("Golos", "Goals", "Gols"),
  assistsShort: L("Assist.", "Assists", "Assist."),
  statLess: L("Menos {stat} · {nick}", "Fewer {stat} · {nick}", "Menos {stat} · {nick}"),
  statMore: L("Mais {stat} · {nick}", "More {stat} · {nick}", "Mais {stat} · {nick}"),
  statsSave: L("Guardar", "Save", "Salvar"),
  statsSaved: L("Golos e assistências guardados.", "Goals and assists saved.", "Gols e assistências salvos."),
  statsMismatch: L("A soma dos golos ({n}) é diferente do resultado ({score}) — confirma se está certo.", "The goals add up to {n} but the score is {score} — check it's right.", "A soma dos gols ({n}) é diferente do resultado ({score}) — confira se está certo."),

  // ── Head to head ──
  h2hTitle: L("Confronto #{n}", "Meeting #{n}", "Confronto #{n}"),
  h2hFirst: L("Primeiro confronto entre as duas equipas.", "First meeting between the two teams.", "Primeiro confronto entre os dois times."),
  h2hLine: L("{w}V · {d}E · {l}D · golos {gf}-{ga}", "{w}W · {d}D · {l}L · goals {gf}-{ga}", "{w}V · {d}E · {l}D · gols {gf}-{ga}"),
  h2hLast: L("Último: {score} ({when})", "Last: {score} ({when})", "Último: {score} ({when})"),
  h2hOnlyConfirmed: L("Só contam resultados confirmados.", "Only confirmed results count.", "Só valem resultados confirmados."),
  h2hLabel: L("CONFRONTO DIRETO", "HEAD TO HEAD", "CONFRONTO DIRETO"),

  // ── Scouting the opponent ──
  scoutTitle: L("CONHECER O ADVERSÁRIO", "SCOUT THE OPPONENT", "CONHECER O ADVERSÁRIO"),
  scoutShow: L("Ver jogadores de {team}", "See {team}'s players", "Ver jogadores do {team}"),
  scoutHide: L("Esconder jogadores", "Hide players", "Esconder jogadores"),
  scoutSub: L("Números dos jogos confirmados no PITCH.", "Numbers from matches confirmed on PITCH.", "Números dos jogos confirmados no PITCH."),
  scoutOvr: L("OVR", "OVR", "OVR"),
  scoutApps: L("Jogos", "Apps", "Jogos"),
  scoutNoPlayers: L("Sem jogadores para mostrar.", "No players to show.", "Sem jogadores para mostrar."),
  scoutNoRating: L("Sem avaliação", "Not rated", "Sem avaliação"),
  scoutPrivacy: L("Só mostramos alcunha, posição e números de jogo — nunca contactos.", "We only show nickname, position and match numbers — never contact details.", "Só mostramos apelido, posição e números de jogo — nunca contatos."),
  scoutLoading: L("A carregar o adversário…", "Loading the opponent…", "Carregando o adversário…"),
  scoutUnavailable: L("O adversário só aparece com o jogo combinado.", "The opponent shows up once the match is agreed.", "O adversário só aparece com o jogo combinado."),

  // ── Team stats card ──
  cardTitle: L("CARTÃO DA EQUIPA", "TEAM CARD", "CARTÃO DO TIME"),
  tileGoals: L("Golos", "Goals", "Gols"),
  tileDiff: L("Saldo", "Diff", "Saldo"),
  tileStreak: L("Sequência", "Streak", "Sequência"),
  tileClean: L("Baliza a zero", "Clean sheets", "Sem sofrer gols"),
  formLabel: L("Forma · últimos 5", "Form · last 5", "Forma · últimos 5"),
  onlyConfirmed: L("Só contam resultados confirmados pelas duas equipas.", "Only results confirmed by both teams count.", "Só valem resultados confirmados pelos dois times."),
  biggestWin: L("Maior vitória: {score} vs {team}", "Biggest win: {score} vs {team}", "Maior vitória: {score} contra {team}"),
  cancelLine: L("{n} cancelamentos ({late} em cima da hora)", "{n} cancellations ({late} late)", "{n} cancelamentos ({late} em cima da hora)"),
  topScorers: L("Melhores marcadores", "Top scorers", "Artilheiros"),
  topAssisters: L("Mais assistências", "Most assists", "Mais assistências"),
  lastResults: L("ÚLTIMOS RESULTADOS", "LATEST RESULTS", "ÚLTIMOS RESULTADOS"),
  resultRow: L("{outcome} {score} vs {opp}", "{outcome} {score} vs {opp}", "{outcome} {score} contra {opp}"),
  nextMatchHere: L("PRÓXIMO JOGO", "NEXT MATCH", "PRÓXIMO JOGO"),

  // ── Stage lines + actions in the challenge list ──
  stageResultReady: L("Jogo terminado · falta o resultado", "Match over · result missing", "Jogo terminado · falta o resultado"),
  stageResultReadyLeader: L("Regista o resultado", "Log the result", "Registre o resultado"),
  stageResultWaiting: L("À espera de {team} confirmar {score}", "Waiting for {team} to confirm {score}", "Esperando o {team} confirmar {score}"),
  stageResultRespond: L("{team} registou {score} — confirma ou contesta", "{team} logged {score} — confirm or contest", "O {team} registrou {score} — confirme ou conteste"),
  stageResultDone: L("Resultado confirmado: {score}", "Result confirmed: {score}", "Resultado confirmado: {score}"),
  stageNotPlayed: L("Jogo não realizado", "Match not played", "Jogo não realizado"),
  actReportResult: L("Registar resultado", "Log the result", "Registrar resultado"),
  actConfirmResult: L("Confirmar resultado", "Confirm result", "Confirmar resultado"),

  // ── Home feed ──
  feedConfirmTitle: L("{opp} registou o resultado: {mine}–{theirs}", "{opp} logged the result: {mine}–{theirs}", "O {opp} registrou o resultado: {mine}–{theirs}"),
  feedConfirmSub: L("Confirma ou contesta — só conta depois de confirmado.", "Confirm or contest — it only counts once confirmed.", "Confirme ou conteste — só vale depois de confirmado."),
  feedConfirmCta: L("Rever resultado", "Review result", "Rever resultado"),
  feedReportTitle: L("O jogo com {opp} já acabou?", "Is the match with {opp} over?", "O jogo com o {opp} já acabou?"),
  feedReportSub: L("Regista o resultado — {opp} tem de o confirmar.", "Log the result — {opp} has to confirm it.", "Registre o resultado — o {opp} precisa confirmar."),
  feedDoneTitle: L("{outcome} contra {opp}: {mine}–{theirs}", "{outcome} vs {opp}: {mine}–{theirs}", "{outcome} contra o {opp}: {mine}–{theirs}"),
  feedDoneSub: L("Confirmado pelas duas equipas.", "Confirmed by both teams.", "Confirmado pelos dois times."),

  // ── Matchday (team mode) ──
  mdToClose: L("JOGOS POR FECHAR", "MATCHES TO WRAP UP", "JOGOS POR FECHAR"),
  mdCallUp: L("Convocatória", "Call-up", "Convocação"),
  mdActions: L("No dia do jogo", "On match day", "No dia do jogo"),

  // ── Perfil: my career in my teams ──
  careerTitle: L("A MINHA CARREIRA NAS EQUIPAS", "MY TEAM CAREER", "MINHA CARREIRA NOS TIMES"),
  careerPlayed: L("{n} jogos", "{n} games", "{n} jogos"),
  careerEmpty: L("Ainda sem jogos de equipa confirmados.", "No confirmed team games yet.", "Ainda sem jogos de time confirmados."),

  // ── Demo-only ──
  demoToolsBody: L(
    "Ferramentas só do modo demo, para percorreres o fluxo sozinho. O capitão rival confirma o que a tua equipa propõe.",
    "Demo-mode tools so you can walk the whole flow alone. The rival captain confirms whatever your team proposes.",
    "Ferramentas só do modo demo, para você percorrer o fluxo sozinho. O capitão rival confirma o que o seu time propõe.",
  ),
  demoAdvance: L("Simular que o jogo já passou", "Pretend the match has been played", "Simular que o jogo já aconteceu"),
  demoRivalReports: L("O rival regista um resultado", "The rival logs a result", "O rival registra um resultado"),
};

export const MATCH_ERRORS = {
  not_team_member: L("Só quem está na equipa pode fazer isto.", "Only team members can do this.", "Só quem está no time pode fazer isso."),
  too_early: L("O jogo ainda não começou.", "The match hasn't started yet.", "O jogo ainda não começou."),
  too_late: MC.callUpClosed,
  result_exists: L("Já existe um resultado ou uma proposta para este jogo.", "There's already a result or a proposal for this match.", "Já existe um resultado ou uma proposta para este jogo."),
  no_open_proposal: L("Já não há nenhuma proposta à espera.", "There's no proposal waiting any more.", "Não há mais nenhuma proposta esperando."),
  stale_revision: L("O resultado mudou entretanto — vê a proposta mais recente.", "The result changed meanwhile — see the latest proposal.", "O resultado mudou nesse meio-tempo — veja a proposta mais recente."),
  own_proposal: L("Não podes confirmar a proposta da tua equipa — tem de ser a outra equipa.", "You can't confirm your own team's proposal — the other team has to.", "Você não pode confirmar a proposta do seu time — o outro time precisa fazer isso."),
  same_score: L("É o mesmo resultado — confirma em vez de contestar.", "That's the same score — confirm instead of contesting.", "É o mesmo resultado — confirme em vez de contestar."),
  needs_help: L("Já houve demasiadas propostas. Fala connosco para resolver.", "There have been too many proposals. Talk to us to sort it out.", "Já houve propostas demais. Fale com a gente para resolver."),
  invalid_score: L("O resultado tem de estar entre 0 e 99.", "The score must be between 0 and 99.", "O resultado precisa estar entre 0 e 99."),
  invalid_status: L("Resposta inválida.", "Invalid answer.", "Resposta inválida."),
  invalid_lineup: L("Escolhe apenas jogadores da tua equipa (máx. 22).", "Pick only players from your team (max 22).", "Escolha apenas jogadores do seu time (máx. 22)."),
  invalid_stats: L("Revê os golos e assistências (0 a 30, só jogadores da lista).", "Check the goals and assists (0 to 30, listed players only).", "Revise os gols e assistências (0 a 30, só jogadores da lista)."),
  not_played_blocked: L("Já há um resultado registado — não dá para marcar como não realizado.", "A result is already logged — it can't be marked as not played.", "Já há um resultado registrado — não dá para marcar como não realizado."),
  not_proposer: L("Só o capitão ou o vice da equipa que fez a proposta a podem retirar.", "Only the captain or vice of the team that made the proposal can withdraw it.", "Só o capitão ou o vice do time que fez a proposta pode retirá-la."),
  proposal_open: L("Já há uma correção à espera de resposta.", "A correction is already waiting for an answer.", "Já há uma correção esperando resposta."),
  result_not_confirmed: L("Só dá para corrigir um resultado já confirmado pelas duas equipas.", "Only a result confirmed by both teams can be corrected.", "Só dá para corrigir um resultado já confirmado pelos dois times."),
  scout_unavailable: L("O adversário só aparece com o jogo combinado e marcado.", "The opponent only shows up while the match is agreed and scheduled.", "O adversário só aparece com o jogo combinado e marcado."),
  invalid_kickoff: L("Escolhe a data e a hora do jogo.", "Pick the match's date and time.", "Escolha a data e o horário do jogo."),
  not_eligible_rematch: L("A revanche só abre depois de um resultado confirmado.", "A rematch only opens after a confirmed result.", "A revanche só abre depois de um resultado confirmado."),
};

registerStrings("en", EN);
registerStrings("pt-br", BR);
