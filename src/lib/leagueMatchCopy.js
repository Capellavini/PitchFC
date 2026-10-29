// PITCH Ligas Fase 2 — copy for the L4–L8 screens (calendar, ficha de
// jogo, homologation, standings, discipline, awards). Same convention as
// leagueCopy.js: the PT-PT string IS the key; L(pt, en, ptBr?) registers EN
// (and PT-BR when it differs). PT-PT is European Portuguese: "ficha de
// jogo" (BR "súmula"), "adeptos" (BR "torcida"), "época" (BR "temporada").
import { registerStrings, t } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

export const LM = {
  tabMatches: L("Jogos", "Matches", "Jogos"),
  tabTable: L("Classificação", "Standings", "Classificação"),
  tabDiscipline: L("Disciplina", "Discipline", "Disciplina"),
  tabTeams: L("Equipas", "Teams", "Times"),
  tabManage: L("Gestão", "Manage", "Gestão"),
  // calendar
  allTeams: L("Todas as equipas", "All teams", "Todos os times"),
  filterTeam: L("Filtrar por equipa", "Filter by team", "Filtrar por time"),
  noFixtures: L("Ainda sem calendário.", "No fixtures yet.", "Ainda sem tabela de jogos."),
  generate: L("Gerar calendário", "Generate fixtures", "Gerar tabela de jogos"),
  generateHint: L("Campeonato entre as equipas homologadas, uma jornada de cada vez. Os jogos começam por agendar.", "Round robin between the homologated teams. Matches start unscheduled.", "Pontos corridos entre os times homologados. Os jogos começam sem data."),
  doubleLegged: L("Duas voltas (ida e volta)", "Home and away (double round robin)", "Turno e returno"),
  round: L("Jornada {n}", "Round {n}", "Rodada {n}"),
  tbd: L("Data por definir", "Date to be set", "Data a definir"),
  // match page
  secSummary: L("Resumo", "Summary", "Resumo"),
  secLineups: L("Onzes", "Line-ups", "Escalações"),
  secTimeline: L("Lances", "Timeline", "Lances"),
  secAwards: L("Destaques", "Highlights", "Destaques"),
  secReport: L("Ficha de jogo", "Match report", "Súmula"),
  unofficial: L("Não oficial", "Unofficial", "Não oficial"),
  official: L("Oficial", "Official", "Oficial"),
  pendingRehom: L("Há correções por homologar — o resultado oficial mantém-se até lá.", "There are corrections awaiting re-homologation — the official result stands until then.", "Há correções a homologar — o resultado oficial se mantém até lá."),
  operation: L("Operação do jogo", "Match operation", "Operação do jogo"),
  start: L("Iniciar jogo", "Start match", "Iniciar jogo"),
  addEvent: L("Registar lance", "Record event", "Registrar lance"),
  end: L("Terminar jogo", "End match", "Encerrar jogo"),
  submit: L("Enviar para validação", "Send for validation", "Enviar para validação"),
  homologate: L("Homologar", "Homologate", "Homologar"),
  rehomologate: L("Homologar correções", "Re-homologate", "Homologar correções"),
  walkover: L("Registar falta de comparência (W.O.)", "Record walkover", "Registrar W.O."),
  abandon: L("Interromper jogo", "Abandon match", "Interromper jogo"),
  decideAbandoned: L("Decidir jogo interrompido", "Decide abandoned match", "Decidir jogo interrompido"),
  schedule: L("Agendar", "Schedule", "Agendar"),
  reschedule: L("Reagendar", "Reschedule", "Reagendar"),
  postpone: L("Adiar", "Postpone", "Adiar"),
  cancel: L("Cancelar jogo", "Cancel match", "Cancelar jogo"),
  officials: L("Equipa de arbitragem e mesa", "Officials", "Arbitragem e mesa"),
  kickoff: L("Data e hora (hora de Lisboa)", "Date and time (Lisbon time)", "Data e hora (horário de Lisboa)"),
  venue: L("Local", "Venue", "Local"),
  teamSheet: L("Ficha da equipa", "Team sheet", "Relação do time"),
  editTeamSheet: L("Editar ficha", "Edit sheet", "Editar relação"),
  saveTeamSheet: L("Guardar ficha", "Save sheet", "Salvar relação"),
  formation: L("Onze inicial", "Starting line-up", "Escalação inicial"),
  editFormation: L("Editar onze", "Edit line-up", "Editar escalação"),
  dispute: L("Contestar resultado", "Dispute the result", "Contestar resultado"),
  disputes: L("Contestações", "Disputes", "Contestações"),
  uphold: L("Dar razão", "Uphold", "Dar razão"),
  rejectDispute: L("Recusar", "Reject", "Recusar"),
  withdraw: L("Retirar", "Withdraw", "Retirar"),
  officialMvp: L("Craque oficial", "Official player of the match", "Craque oficial"),
  fansMvp: L("Craque dos adeptos", "Fans' player of the match", "Craque da torcida"),
  openVote: L("Abrir votação dos adeptos", "Open the fans' vote", "Abrir votação da torcida"),
  vote: L("Votar", "Vote", "Votar"),
  // standings
  includeProvisional: L("Incluir resultados provisórios", "Include provisional results", "Incluir resultados provisórios"),
  provisionalTable: L("Classificação provisória", "Provisional standings", "Classificação provisória"),
  officialTable: L("Classificação oficial · só jogos homologados", "Official standings · homologated matches only", "Classificação oficial · só jogos homologados"),
  adjustments: L("Ajustes de pontos", "Point adjustments", "Ajustes de pontos"),
  adjust: L("Ajustar pontos", "Adjust points", "Ajustar pontos"),
  rankings: L("Rankings de atletas", "Player rankings", "Rankings de atletas"),
  goals: L("Golos", "Goals", "Gols"),
  assists: L("Assistências", "Assists", "Assistências"),
  cards: L("Cartões", "Cards", "Cartões"),
  // discipline
  cases: L("Casos disciplinares", "Discipline cases", "Casos disciplinares"),
  confirm: L("Confirmar", "Confirm", "Confirmar"),
  waive: L("Arquivar", "Waive", "Arquivar"),
  // manager inbox
  pending: L("À espera da organização", "Waiting for the organisation", "Aguardando a organização"),
  toHomologate: L("Fichas de jogo à espera de validação", "Match reports awaiting validation", "Súmulas aguardando validação"),
  liveNow: L("A decorrer agora", "Live now", "Em andamento agora"),
  toSchedule: L("Por agendar", "To schedule", "A agendar"),
  nothingPending: L("Nada pendente.", "Nothing pending.", "Nada pendente."),
  fantasySoon: L("Fantasy, VAR e notificações chegam às ligas nas próximas fases.", "Fantasy, VAR and notifications come to leagues in the next phases.", "Fantasy, VAR e notificações chegam às ligas nas próximas fases."),
};

/** Error codes of the L4–L8 RPCs → user message. */
export const LM_ERR = {
  stale_seq: L("Alguém mexeu neste jogo entretanto. Atualizámos — revê e tenta outra vez.", "Someone changed this match meanwhile. Refreshed — review and try again.", "Alguém mexeu neste jogo. Atualizamos — revise e tente de novo."),
  stale_event: L("Este lance já foi corrigido por outra pessoa. Atualiza e revê a ficha de jogo.", "Someone already corrected this event. Refresh and review the report.", "Este lance já foi corrigido por outra pessoa. Atualize e revise a súmula."),
  stale_formation: L("O onze foi alterado por outra pessoa. Atualizámos — revê e guarda outra vez.", "The line-up was changed by someone else. Refreshed — review and save again.", "A escalação foi alterada por outra pessoa. Atualizamos — revise e salve de novo."),
  event_id_conflict: L("Conflito no identificador do lance. Fecha e regista outra vez.", "Event id conflict. Close and record again.", "Conflito no identificador do lance. Feche e registre de novo."),
  not_operator: L("Só a mesa, o árbitro ou a organização podem operar este jogo.", "Only the scorer, the referee or the organisation can run this match.", "Só a mesa, o árbitro ou a organização podem operar este jogo."),
  not_authority: L("Só quem o regulamento indica pode homologar ou decidir.", "Only the authority set in the regulation can homologate or decide.", "Só quem o regulamento indica pode homologar ou decidir."),
  not_allowed: L("Não tens permissão para isto.", "You're not allowed to do this.", "Você não tem permissão para isso."),
  match_not_found: L("Jogo não encontrado (ou sem permissão).", "Match not found (or no permission).", "Jogo não encontrado (ou sem permissão)."),
  match_not_live: L("O jogo não está a decorrer.", "The match isn't live.", "O jogo não está em andamento."),
  match_not_finished: L("O jogo ainda não terminou.", "The match hasn't ended yet.", "O jogo ainda não terminou."),
  too_early: L("Só podes iniciar até 2 horas antes da hora marcada.", "You can only start up to 2 hours before kick-off.", "Só é possível iniciar até 2 horas antes do horário."),
  sumula_closed: L("A ficha de jogo já foi enviada: só correções com motivo, pela organização.", "The report was submitted: only corrections with a reason, by the organisation.", "A súmula já foi enviada: só correções com motivo, pela organização."),
  player_not_in_squad: L("Esse atleta não está no plantel homologado.", "That player isn't in the homologated squad.", "Esse atleta não está no elenco homologado."),
  player_required: L("Cartões precisam de atleta.", "Cards need a player.", "Cartões precisam de atleta."),
  player_suspended: L("Há um atleta suspenso na ficha.", "A suspended player is on the sheet.", "Há um atleta suspenso na relação."),
  player_not_eligible: L("Há um atleta que não pode jogar (fora do plantel ou suspenso).", "A player can't play (not in the squad or suspended).", "Há um atleta que não pode jogar (fora do elenco ou suspenso)."),
  assists_disabled: L("O regulamento não regista assistências.", "The regulation doesn't record assists.", "O regulamento não registra assistências."),
  invalid_event: L("Lance inválido.", "Invalid event.", "Lance inválido."),
  event_not_found: L("Lance não encontrado.", "Event not found.", "Lance não encontrado."),
  invalid_fixtures: L("O calendário não é um campeonato completo das equipas homologadas.", "The fixtures aren't a complete round robin of the homologated teams.", "A tabela não é um pontos corridos completo dos times homologados."),
  fixtures_exist: L("O calendário já foi gerado.", "Fixtures already exist.", "A tabela já foi gerada."),
  not_enough_teams: L("São precisas pelo menos 2 equipas homologadas.", "At least 2 homologated teams are needed.", "São necessários pelo menos 2 times homologados."),
  kickoff_required: L("Indica a data e a hora.", "Set the date and time.", "Informe data e hora."),
  not_a_collaborator: L("Essa pessoa não é colaboradora da liga com esse papel.", "That person isn't a league collaborator with that role.", "Essa pessoa não é colaboradora da liga com esse papel."),
  formation_locked: L("O onze fecha quando o jogo começa.", "The line-up locks when the match starts.", "A escalação fecha quando o jogo começa."),
  invalid_formation: L("Onze inválido.", "Invalid line-up.", "Escalação inválida."),
  invalid_lineup: L("Ficha inválida (atletas repetidos ou demasiados).", "Invalid sheet (duplicates or too many).", "Relação inválida (atletas repetidos ou demais)."),
  nothing_to_rehomologate: L("Não há correções novas desde a última homologação.", "No new corrections since the last homologation.", "Não há correções novas desde a última homologação."),
  invalid_team: L("Equipa inválida.", "Invalid team.", "Time inválido."),
  invalid_score: L("Resultado inválido.", "Invalid score.", "Resultado inválido."),
  invalid_decision: L("Decisão inválida.", "Invalid decision.", "Decisão inválida."),
  nothing_to_dispute: L("Ainda não há resultado para contestar.", "There's no result to dispute yet.", "Ainda não há resultado para contestar."),
  dispute_window_closed: L("O prazo para contestar já terminou.", "The dispute window has closed.", "O prazo para contestar já terminou."),
  dispute_already_open: L("A tua equipa já tem uma contestação aberta neste jogo.", "Your team already has an open dispute on this match.", "Seu time já tem uma contestação aberta neste jogo."),
  invalid_dispute: L("Descreve o motivo (mín. 5 caracteres).", "Describe the reason (min. 5 characters).", "Descreva o motivo (mín. 5 caracteres)."),
  dispute_not_found: L("Contestação não encontrada.", "Dispute not found.", "Contestação não encontrada."),
  invalid_adjustment: L("Ajuste inválido (entre −50 e 50, diferente de 0, motivo com 5+ caracteres).", "Invalid adjustment (−50 to 50, not 0, reason 5+ characters).", "Ajuste inválido (entre −50 e 50, diferente de 0, motivo com 5+ caracteres)."),
  fan_vote_disabled: L("O regulamento não tem votação dos adeptos.", "The regulation has no fans' vote.", "O regulamento não tem votação da torcida."),
  vote_closed: L("A votação está fechada.", "Voting is closed.", "A votação está fechada."),
  no_self_vote: L("Não podes votar em ti.", "You can't vote for yourself.", "Você não pode votar em si mesmo."),
  not_a_candidate: L("Esse atleta não jogou este jogo.", "That player didn't play this match.", "Esse atleta não jogou este jogo."),
  invalid_ranking: L("Ranking inválido.", "Invalid ranking.", "Ranking inválido."),
};

registerStrings("en", EN);
registerStrings("pt-br", BR);

export const lmError = (code) => (LM_ERR[code] ? t(LM_ERR[code]) : null);
