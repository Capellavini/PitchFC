import LeagueToday from "./LeagueToday";
import LeagueTeamHome from "./LeagueTeamHome";
import LeagueFanHome from "./LeagueFanHome";

/** Início: every role opens on its own screen — the Gestor on the work
 *  queue (Painel), captain and athlete on their team (Equipa), the fan on
 *  the league followed from the stands. */
export default function LeagueHome({ ctx }) {
  if (ctx.role === "manager") return <LeagueToday ctx={ctx} />;
  if (ctx.role === "captain" || ctx.role === "athlete") return <LeagueTeamHome ctx={ctx} />;
  return <LeagueFanHome ctx={ctx} />;
}
