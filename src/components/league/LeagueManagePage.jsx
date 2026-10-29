import LeagueManagePublish from "./LeagueManagePublish";
import LeagueManagePageSettings from "./LeagueManagePageSettings";
import LeagueManageNotices from "./LeagueManageNotices";
import LeagueManageSignups from "./LeagueManageSignups";

/** Gerir → Página: the league's own public page (/leagues/<slug>): its address, what it shows,
 *  the avisos the Gestor publishes there and the fans who signed up for the Pitch Manager. */
export default function LeagueManagePage({ ctx }) {
  return (
    <div>
      <LeagueManagePublish ctx={ctx} />
      <LeagueManageNotices ctx={ctx} />
      <LeagueManagePageSettings ctx={ctx} />
      {ctx.store?.fans && <LeagueManageSignups ctx={ctx} />}
    </div>
  );
}
