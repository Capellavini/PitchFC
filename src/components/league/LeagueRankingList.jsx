import { C, S, T, TOUCH, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { teamById as DEMO_TEAMS } from "../../lib/leagueDemo";
import Avatar from "../Avatar";

/** Player ranking rows: position · avatar · name / team · value. Empty →
 *  explicit empty state. `dir` (cloud): { teamById }; demo default. */
export default function LeagueRankingList({ rows, onPlayer, render, dir = null }) {
  const teamById = dir?.teamById || DEMO_TEAMS;
  if (!rows.length) return <div style={{ color: C.text2, fontSize: T.body, padding: `${S.md}px 0` }}>{t("Ainda sem registos nesta categoria.")}</div>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.map((r, i) => (
        <li key={r.player.id}>
          <button type="button" onClick={() => onPlayer(r.player.id)}
            style={{ width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", padding: `${S.sm}px 0`, textAlign: "left" }}>
            <span style={{ width: 20, fontWeight: 800, color: C.text2, fontSize: T.meta, flexShrink: 0 }}>{i + 1}</span>
            <Avatar name={r.player.name} photo={r.player.photo} color={teamById[r.player.teamId]?.color} size={32} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.player.name}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamById[r.player.teamId]?.name || "—"}</span>
            </span>
            <span style={{ ...displayFont, fontSize: 20, flexShrink: 0 }}>{render ? render(r) : r.value}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
