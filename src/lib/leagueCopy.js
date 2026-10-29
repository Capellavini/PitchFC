// PITCH Ligas (Fase 1 demo) — structured copy. Same convention as
// rivalsCopy.js: the PT-PT string IS the key; L(pt, en, ptBr?) registers
// the EN (and PT-BR when it differs) translation with the shared i18n.
// Components render t(LG.x) / t(STATE_LABEL[state]); free-form sentences
// in the league components use t("…") directly (PT-PT fallback in EN).
import { registerStrings, t } from "./i18n.js";

const EN = {};
const BR = {};
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

export const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
export const tf = (key, vars) => fmt(t(key), vars);
/** "1 golo" / "3 golos" — PT-PT source strings for both forms, then t(). */
export const plural = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;

export const LG = {
  demoMode: L("Modo demonstração", "Demo mode", "Modo demonstração"),
  demoData: L("Dados de demonstração — liga, equipas e atletas fictícios, guardados só neste navegador.", "Demo data — fictional league, teams and athletes, stored only in this browser.", "Dados de demonstração — liga, times e atletas fictícios, salvos só neste navegador."),
  viewAs: L("Ver como", "View as", "Ver como"),
  roleNote: L("Trocar de papel só muda a vista. Não concede permissões reais.", "Switching role only changes the view. It grants no real permissions.", "Trocar de papel só muda a visão. Não concede permissões reais."),
  manage: L("Gerir liga", "Manage league", "Gerenciar liga"),
  backToLeague: L("Voltar à liga", "Back to the league", "Voltar à liga"),
  reset: L("Repor exemplos", "Reset examples", "Restaurar exemplos"),
  resetDone: L("Exemplos repostos.", "Examples restored.", "Exemplos restaurados."),
  // nav
  navHome: L("Início", "Home", "Início"),
  navMatches: L("Jogos", "Matches", "Jogos"),
  navTable: L("Classificação", "Standings", "Classificação"),
  navFantasy: L("Pitch Manager", "Pitch Manager", "Pitch Manager"),
  navMore: L("Mais", "More", "Mais"),
  // roles
  roleFan: L("Adepto", "Fan", "Torcedor"),
  roleAthlete: L("Atleta", "Athlete", "Atleta"),
  roleCaptain: L("Capitão", "Captain", "Capitão"),
  roleManager: L("Gestor", "Manager", "Gestor"),
  // match sections
  secSummary: L("Resumo", "Summary", "Resumo"),
  secLineups: L("Escalações", "Line-ups", "Escalações"),
  secTimeline: L("Lances", "Timeline", "Lances"),
  secHighlights: L("Destaques", "Highlights", "Destaques"),
  secVideos: L("Vídeos", "Videos", "Vídeos"),
  secReport: L("Súmula", "Match report", "Súmula"),
  officialMvp: L("Craque oficial", "Official player of the match", "Craque oficial"),
  fansMvp: L("Craque da torcida", "Fans' player of the match", "Craque da torcida"),
  provisional: L("Provisória", "Provisional", "Provisória"),
  fantasyRules: L("Regras de exemplo — não é regulamento", "Example rules — not a regulation", "Regras de exemplo — não é regulamento"),
  round: L("Jornada {n}", "Round {n}", "Rodada {n}"),
  varOn: L("VAR ativo nesta partida", "VAR on for this match", "VAR ativo nesta partida"),
  varOff: L("VAR desligado nesta partida", "VAR off for this match", "VAR desligado nesta partida"),
  team: L("Equipa", "Team", "Time"),
  teams: L("Equipas", "Teams", "Times"),
  // entries from outside the league context (role pick, Competir, /league)
  fanEntry: L("Sou adepto", "I'm a fan", "Sou torcedor"),
  fanEntrySub: L("Acompanha uma liga e a tua equipa (demonstração)", "Follow a league and your team (demo)", "Acompanhe uma liga e o seu time (demonstração)"),
  leaguesCard: L("Ligas · demonstração", "Leagues · demo", "Ligas · demonstração"),
  leaguesCardSub: L("Vê como fica uma liga amadora no PITCH (dados fictícios)", "See how an amateur league looks on PITCH (fictional data)", "Veja como fica uma liga amadora no PITCH (dados fictícios)"),
  seeDemo: L("Ver demonstração", "See the demo", "Ver demonstração"),
};

export const ROLE_LABEL = { fan: LG.roleFan, athlete: LG.roleAthlete, captain: LG.roleCaptain, manager: LG.roleManager };

export const STATE_LABEL = {
  scheduled: L("Agendado", "Scheduled", "Agendado"),
  live: L("Ao vivo", "Live", "Ao vivo"),
  ended_provisional: L("Encerrado · provisório", "Ended · provisional", "Encerrado · provisório"),
  in_review: L("Em revisão", "Under review", "Em revisão"),
  homologated: L("Homologado", "Confirmed", "Homologado"),
  postponed: L("Adiado", "Postponed", "Adiado"),
  cancelled: L("Cancelado", "Cancelled", "Cancelado"),
  walkover: L("W.O.", "Walkover", "W.O."),
};
/** Chip variant per state — semantic colours (CLAUDE.md). */
export const STATE_VARIANT = {
  scheduled: "neutral", live: "lime", ended_provisional: "orange", in_review: "orange",
  homologated: "green", postponed: "neutral", cancelled: "red", walkover: "neutral",
};

export const EVENT_LABEL = {
  goal: L("Golo", "Goal", "Gol"),
  own_goal: L("Autogolo", "Own goal", "Gol contra"),
  card_yellow: L("Amarelo", "Yellow card", "Amarelo"),
  card_red: L("Vermelho", "Red card", "Vermelho"),
  sub: L("Substituição", "Substitution", "Substituição"),
  shootout_goal: L("Penálti (desempate)", "Shoot-out penalty", "Pênalti (disputa)"),
  void: L("Anulado", "Voided", "Anulado"),
};

export const POSITION_LABEL = {
  GR: L("GR", "GK", "GOL"), DEF: L("DEF", "DEF", "ZAG"), MED: L("MED", "MID", "MEI"), AVA: L("AVA", "FWD", "ATA"),
};

/** LeagueError codes → user message. */
export const LEAGUE_ERROR = {
  reason_required: L("Indica um motivo — é obrigatório.", "Give a reason — it's required.", "Informe um motivo — é obrigatório."),
  already_superseded: L("Este lance já foi corrigido por outra pessoa. Atualiza e revê a súmula.", "Someone already corrected this event. Refresh and review the report.", "Este lance já foi corrigido por outra pessoa. Atualize e revise a súmula."),
  forbidden_transition: L("Não tens permissão para esta mudança de estado.", "You can't make this state change.", "Você não tem permissão para esta mudança de estado."),
  not_your_match: L("Só podes contestar jogos da tua equipa.", "You can only contest your own team's matches.", "Você só pode contestar jogos do seu time."),
  vote_closed: L("A votação está fechada.", "Voting is closed.", "A votação está fechada."),
  forbidden_mvp: L("Só o gestor escolhe o craque oficial.", "Only the manager picks the official player of the match.", "Só o gestor escolhe o craque oficial."),
  match_not_ended: L("O jogo ainda não terminou.", "The match hasn't ended yet.", "O jogo ainda não terminou."),
  card_needs_player: L("Um cartão precisa de atleta.", "A card needs a player.", "Um cartão precisa de atleta."),
  forbidden_tactics: L("Só o capitão da equipa (ou o gestor) pode mexer na formação, antes ou durante o jogo.", "Only the team's captain (or the manager) can edit the formation, before or during the match.", "Só o capitão do time (ou o gestor) pode mexer na formação, antes ou durante o jogo."),
  tactics_suspended: L("Há um atleta suspenso na formação.", "A suspended player is in the formation.", "Há um atleta suspenso na formação."),
  tactics_not_called: L("Só atletas convocados podem entrar na formação.", "Only called-up players can be in the formation.", "Só atletas convocados podem entrar na formação."),
  tactics_duplicate: L("O mesmo atleta está em duas posições.", "The same player is in two positions.", "O mesmo atleta está em duas posições."),
  generic: L("Não foi possível guardar. Tenta outra vez.", "Couldn't save. Try again.", "Não foi possível salvar. Tente novamente."),
};
export const leagueError = (e) => t(LEAGUE_ERROR[e?.code] || LEAGUE_ERROR.generic);

registerStrings("en", EN);
registerStrings("pt-br", BR);
