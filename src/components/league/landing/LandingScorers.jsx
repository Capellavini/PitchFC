import { useState } from "react";
import { C, S, T, cardStyle, displayFont } from "../../../theme";
import { t } from "../../../lib/i18n";
import SegmentedControl from "../../SegmentedControl";
import Avatar from "../../Avatar";
import { teamById } from "../../../lib/leagueDemo";

/** Top scorers and assisters of the competition (official games only). Read-only. */
export default function LandingScorers({ comp }) {
  const [kind, setKind] = useState("goals");
  const rows = kind === "goals" ? comp.scorers : comp.assisters;
  return (
    <div>
      <SegmentedControl value={kind} onChange={setKind} options={[{ id: "goals", label: "Golos" }, { id: "assists", label: "Assistências" }]} />
      <div style={{ ...cardStyle, paddingTop: 0, paddingBottom: 0 }}>
        {rows.length === 0
          ? <div style={{ color: C.text2, fontSize: T.body, padding: `${S.md}px 0` }}>{t("Ainda sem registos nesta categoria.")}</div>
          : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.map((r, i) => (
                <li key={r.player.id} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 52, borderBottom: i === rows.length - 1 ? "none" : `1px solid ${C.border}`, padding: `${S.sm}px 0` }}>
                  <span style={{ width: 20, fontWeight: 800, color: C.text2, fontSize: T.meta, flexShrink: 0 }}>{i + 1}</span>
                  <Avatar name={r.player.name} photo={r.player.photo} color={teamById[r.player.teamId]?.color} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.player.name}</span>
                    <span style={{ display: "block", fontSize: T.meta, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamById[r.player.teamId]?.name || "—"}</span>
                  </span>
                  <span style={{ ...displayFont, fontSize: 20, flexShrink: 0 }}>{r.value}</span>
                </li>
              ))}
            </ol>
          )}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
        {t("Só jogos homologados. Golos não incluem autogolos nem penáltis de desempate.")}
      </div>
    </div>
  );
}
