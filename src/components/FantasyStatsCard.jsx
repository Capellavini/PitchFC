import { C, S, cardStyle } from "../theme";
import { fmtM } from "../lib/fantasy";
import { t } from "../lib/i18n";
import StatTile from "./StatTile";

/**
 * FantasyStatsCard — Pitch Manager header: four StatTiles in ONE card
 * (2×2 so money values like "$30.0M" fit a phone at 28px).
 *  - Selecionados n/min — green when the squad is complete, orange while
 *    incomplete (pending, never red).
 *  - Banco — red only when the draft is over budget (a real error).
 *  - Pontos — my league total; sub = last round.
 *  - Posição — my rank in the league table; sub = "de N".
 */
export default function FantasyStatsCard({ count, squadSize, bank, overBudget, points = null, lastRound = null, rank = null, participants = 0 }) {
  const complete = count >= squadSize;
  const cell = (i) => ({
    padding: `${S.sm}px ${S.xs}px`,
    borderLeft: i % 2 ? `1px solid ${C.border}` : "none",
    borderTop: i > 1 ? `1px solid ${C.border}` : "none",
  });
  return (
    <div style={{ ...cardStyle, padding: `${S.xs}px ${S.sm}px`, marginBottom: S.lg, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      <StatTile style={cell(0)} value={`${count}/${squadSize}`} label={t("Selecionados")} color={complete ? C.green : C.orange} />
      <StatTile style={cell(1)} value={fmtM(bank)} label={t("Banco")} color={overBudget ? C.red : C.text1} />
      <StatTile style={cell(2)} value={points != null ? Math.round(points) : "—"} label={t("Pontos")}
        sub={lastRound != null ? `${lastRound > 0 ? "+" : ""}${Math.round(lastRound)} ${t("na última jornada")}` : null} />
      <StatTile style={cell(3)} value={rank ? `#${rank}` : "—"} label={t("Posição")}
        sub={rank && participants ? `${t("de")} ${participants}` : null} />
    </div>
  );
}
