import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { POSITION_LABEL } from "../../lib/leagueCopy";
import { playerById, teamById } from "../../lib/leagueDemo";

/** Escalações: published call-ups of both teams (or "ainda não
 *  publicada"). Only display name, number and position — no contacts. */
export default function LeagueLineups({ match, onPlayer }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: S.sm }}>
      {[match.homeId, match.awayId].map((tid) => {
        const ids = match.lineups?.[tid] || [];
        return (
          <div key={tid} style={cardStyle}>
            <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.sm }}>{teamById[tid].name}</div>
            {ids.length === 0 && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Convocatória ainda não publicada.")}</div>}
            {ids.map((id) => {
              const p = playerById[id];
              return (
                <button key={id} type="button" onClick={() => onPlayer(id)} style={{ display: "flex", width: "100%", minHeight: 44, alignItems: "center", gap: S.sm, background: "none", border: "none", borderTop: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", padding: 0, textAlign: "left", fontSize: T.body }}>
                  <span style={{ width: 24, color: C.text2, fontWeight: 800, fontSize: T.meta }}>{p.number}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ fontSize: T.meta, color: C.text2 }}>{t(POSITION_LABEL[p.position])}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
