import { Trophy } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { hasPlayed } from "../lib/rivals";
import FormPills from "./FormPills";
import SectionLabel from "./SectionLabel";

const STREAK = { W: RC.winShort, D: RC.drawShort, L: RC.lossShort };
const signed = (n) => (n > 0 ? `+${n}` : String(n));

/** The team's record from CONFIRMED results only: played · V · E · D, then
 *  goals for–against, goal difference, current streak, clean sheets, the
 *  last five as form pills, the biggest win and — when it matters to whoever
 *  decides to challenge — cancellations. Before the first confirmed result
 *  it says "Ainda sem jogos". `flat` drops the label + card (embedded in
 *  another card, e.g. the scouting block). */
export default function TeamRecordStrip({ record, flat = false }) {
  if (!hasPlayed(record)) {
    return (
      <div style={{ ...(flat ? {} : cardStyle), display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
        <Trophy size={20} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
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
  const tiles = [
    [MC.tileGoals, `${record.goalsFor}–${record.goalsAgainst}`],
    [MC.tileDiff, signed(record.goalDiff)],
    [MC.tileStreak, record.streak?.type ? `${record.streak.n}${t(STREAK[record.streak.type])}` : "—"],
    [MC.tileClean, record.cleanSheets],
  ];
  const body = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.md }}>
        {cells.map(([label, n, color]) => (
          <div key={label} style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ ...displayFont, fontSize: 26, color }}>{n}</div>
            <div style={{ fontSize: T.min, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(label)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, padding: `${S.sm}px 0`, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: S.md }}>
        {tiles.map(([label, v]) => (
          <div key={label} style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            <div style={{ fontSize: T.min, color: C.text2, lineHeight: 1.2 }}>{t(label)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: S.xs + 2 }}>{t(MC.formLabel)}</div>
      <FormPills form={record.form} />
      {(record.biggestWin || record.cancellations > 0) && (
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.6, marginTop: S.md }}>
          {record.biggestWin && <div>{tf(MC.biggestWin, { score: record.biggestWin.score || "—", team: record.biggestWin.opponent || "—" })}</div>}
          {record.cancellations > 0 && <div>{tf(MC.cancelLine, { n: record.cancellations, late: record.lateCancellations })}</div>}
        </div>
      )}
      <div style={{ fontSize: T.min + 0.5, color: C.text2, marginTop: S.sm }}>{t(MC.onlyConfirmed)}</div>
    </>
  );
  if (flat) return <div style={{ marginBottom: S.md }}>{body}</div>;
  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(RC.record)}</SectionLabel>
      <div style={{ ...cardStyle }}>{body}</div>
    </div>
  );
}
