import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { PLAYERS, playerById, teamById, captainOf, ovrOfPlayer, modOn } from "../../lib/leagueDemo";
import { canEditTactics } from "../../lib/core/league";
import SectionLabel from "../SectionLabel";
import LeagueSquadGrid from "./LeagueSquadGrid";
import LeagueTacticsPanel from "./LeagueTacticsPanel";

/** Escalações = scouting for both sides: the published call-up as player
 *  cards (photo/initials, OVR), then each team's Futebol 7 board — read-
 *  only for everyone, editable by that team's Capitão / the Gestor. Only
 *  display name, number, position and OVR — never contacts. */
export default function LeagueLineups({ ctx, match }) {
  const { role, acc, derived, act, lang, open } = ctx;
  const suspended = new Set(Object.values(derived.discipline).filter((d) => d.pending > 0).map((d) => d.playerId));
  return (
    <div>
      {[match.homeId, match.awayId].map((tid) => {
        const ids = match.lineups?.[tid] || [];
        const called = ids.length > 0;
        // before the call-up, scouting shows the inscribed squad
        const players = (called ? ids.map((id) => playerById[id]) : PLAYERS.filter((p) => p.teamId === tid)).filter(Boolean);
        const avg = modOn("ovr") && players.length ? Math.round(players.reduce((n, p) => n + ovrOfPlayer(p), 0) / players.length) : null;
        return (
          <section key={tid} style={{ marginBottom: S.xl }}>
            <SectionLabel right={avg ? <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 700 }}>{tf(t("OVR médio {n}"), { n: avg })}</span> : null}>{teamById[tid].name}</SectionLabel>
            {!called && <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t("Convocatória ainda não publicada — a mostrar o plantel inscrito.")}</div>}
            <div style={{ marginBottom: S.md }}><LeagueSquadGrid players={players} suspended={suspended} captainId={captainOf(tid)} meId={acc.playerId} onPlayer={(id) => open({ kind: "player", id })} /></div>
            {modOn("tactics") && <LeagueTacticsPanel match={match} teamId={tid} lang={lang} discipline={derived.discipline}
              canEdit={canEditTactics(match, role, tid, acc.teamId)} onSave={(board) => act.setTactics(match.id, tid, board)} />}
          </section>
        );
      })}
    </div>
  );
}
