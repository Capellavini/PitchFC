import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { EVENT_LABEL } from "../../lib/leagueCopy";
import { playerById as DEMO_PLAYERS, teamById as DEMO_TEAMS } from "../../lib/leagueDemo";
import { activeEvents } from "../../lib/core/league";

const ICON = { goal: "⚽", own_goal: "⚽", card_yellow: "🟨", card_second_yellow: "🟨🟥", card_red: "🟥", sub: "🔁", shootout_goal: "🎯" };

/** Lances: the ACTIVE events (corrections applied), home on the left,
 *  away on the right. With `onCorrect` (Gestor, correctable state) each
 *  row offers "Corrigir". `dir` (cloud): { playerById, teamById }; cloud
 *  rows also carry playerName/assistName (public display names). */
export default function LeagueTimeline({ match, log, onCorrect, dir = null }) {
  const playerById = dir?.playerById || DEMO_PLAYERS, teamById = dir?.teamById || DEMO_TEAMS;
  const evs = activeEvents(log);
  if (!evs.length) return <div style={{ color: C.text2, fontSize: T.body, padding: `${S.md}px 0` }}>{t("Ainda sem lances registados.")}</div>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {evs.map((e) => {
        // own goal: listed on the side of the player who scored it
        const sideTeam = e.type === "own_goal" ? (e.teamId === match.homeId ? match.awayId : match.homeId) : e.teamId;
        const away = sideTeam === match.awayId;
        const who = e.playerId ? (e.playerName || playerById[e.playerId]?.name || "—") : t("Autor por identificar");
        return (
          <li key={e.id} style={{ display: "flex", alignItems: "center", gap: S.sm, borderBottom: `1px solid ${C.border}`, padding: `${S.sm}px 0`, flexDirection: away ? "row-reverse" : "row", textAlign: away ? "right" : "left" }}>
            <span style={{ width: 34, flexShrink: 0, fontWeight: 800, fontSize: T.meta, color: C.text2, textAlign: "center" }}>{e.minute != null ? `${e.minute}'` : "—"}</span>
            <span aria-hidden style={{ fontSize: 16, flexShrink: 0 }}>{ICON[e.type]}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflowWrap: "anywhere" }}>{who}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>
                {t(EVENT_LABEL[e.type])}
                {e.type === "own_goal" && ` · ${t("a favor de")} ${teamById[e.teamId]?.short || "—"}`}
                {e.assistId && ` · ${t("assist.")} ${e.assistName || playerById[e.assistId]?.name || "—"}`}
                {e.corrected && ` · ${t("corrigido")}`}
              </span>
            </span>
            {onCorrect && (
              <button type="button" onClick={() => onCorrect(e)} style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.control, background: "transparent", border: `1px solid ${C.border}`, color: C.text1, fontSize: T.meta, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {t("Corrigir")}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
