import LeagueToday from "./LeagueToday";
import LeagueTeamHome from "./LeagueTeamHome";
import LeagueFanHome from "./LeagueFanHome";
import LeagueWelcome from "./LeagueWelcome";

/** Início: every role opens on its own screen — the Gestor on the work
 *  queue (Painel), captain and athlete on their team (Equipa), the fan on
 *  the league followed from the stands. */
export default function LeagueHome({ ctx }) {
  const body = ctx.role === "manager" ? <LeagueToday ctx={ctx} />
    : ctx.role === "captain" || ctx.role === "athlete" ? <LeagueTeamHome ctx={ctx} />
      : <LeagueFanHome ctx={ctx} />;
  return <><LeagueWelcome role={ctx.role} seen={ctx.welcomeSeen} onSeen={ctx.markWelcome} />{body}</>;
}
