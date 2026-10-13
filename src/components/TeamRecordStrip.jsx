import { Trophy } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import { hasPlayed } from "../lib/rivals";
import FormPills from "./FormPills";
import SectionLabel from "./SectionLabel";

/** The team's confirmed W-D-L + recent form. Until a match is confirmed
 *  (PR6 derives the record server-side) it says "Ainda sem jogos". */
export default function TeamRecordStrip({ record }) {
  if (!hasPlayed(record)) {
    return (
      <div style={{ ...cardStyle, display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
        <Trophy size={20} color={C.text2} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: T.cardTitle - 1, fontWeight: 800, color: C.text1 }}>{t(RC.noGamesYet)}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, lineHeight: 1.5 }}>{t(RC.noGamesBody)}</div>
        </div>
      </div>
    );
  }
  const cells = [
    [RC.played, record.played, C.text1], [RC.wins, record.wins, C.green],
    [RC.draws, record.draws, C.orange], [RC.losses, record.losses, C.red],
  ];
  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(RC.record)}</SectionLabel>
      <div style={{ ...cardStyle }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.md }}>
          {cells.map(([label, n, color]) => (
            <div key={label} style={{ textAlign: "center", minWidth: 0 }}>
              <div style={{ ...displayFont, fontSize: 26, color }}>{n}</div>
              <div style={{ fontSize: T.min, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(label)}</div>
            </div>
          ))}
        </div>
        <FormPills form={record.form} />
      </div>
    </div>
  );
}
