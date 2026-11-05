import { rpc } from "./leagueRolesApi";

/** The Pitch Manager of a REAL league: what the server keeps (my squad, the lineups locked at each round's
 *  first kick-off, how many managers own each athlete) and the one way to change a squad. A null workspace id
 *  means the caller's own league (the Gestor); a member passes the league they were invited to. */
export const leaguePmApi = Object.freeze({
  board: (workspaceId = null) => rpc("league_pm_board", { p_workspace: workspaceId }),
  save: (workspaceId, squad, name) => rpc("league_pm_save_squad", { p_workspace: workspaceId, p_squad: squad, p_name: name }),
});

/** Error code → what a person reads (PT-PT source strings; t() is applied by the screen). */
export const PM_ERROR = Object.freeze({
  pm_invalid: "A equipa não é válida. Confirma os titulares, o banco e o capitão.",
  pm_unknown_athlete: "Um dos atletas já não está na liga. Atualiza a página e tenta outra vez.",
  pm_connection_invalid: "A conexão tem de ser entre dois titulares diferentes.",
  module_off: "O Pitch Manager está desligado nesta liga.",
  forbidden: "Não tens acesso ao Pitch Manager desta liga.",
  not_authenticated: "Entra na tua conta para jogar.",
  network: "Sem ligação. Confirma a internet e tenta outra vez.",
  not_deployed: "O Pitch Manager ainda não está ativo nesta liga.",
});
export const pmErrorText = (code) => PM_ERROR[code] || "Não foi possível guardar. Tenta outra vez.";
