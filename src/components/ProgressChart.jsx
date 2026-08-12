import { useState } from "react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";

const W = 320, H = 130, PAD_X = 14, PAD_Y = 18;

/** Golos+assistências per day played, last 8 — a single series, so no
 *  legend (the title names it); tap a point for the exact split instead
 *  of labeling every dot. Cloud only, same reason as the calendar. */
export default function ProgressChart({ records, playerKey }) {
  const [active, setActive] = useState(null); // index into points

  const points = [...records]
    .filter((r) => (r.summary?.candidates || []).some((c) => c.key === playerKey))
    .reverse() // oldest → newest, left to right
    .slice(-8)
    .map((r) => {
      const line = (r.summary?.lines || []).find((l) => l.key === playerKey);
      const goals = line?.goals || 0, assists = line?.assists || 0;
      return { date: r.date, goals, assists, ga: goals + assists };
    });

  if (points.length < 2) {
    return (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t("Progresso")}</div>
        <div style={{ fontSize: 11, color: C.text2 }}>{t("Precisas de pelo menos 2 dias de jogo para ver a tendência.")}</div>
      </div>
    );
  }

  const maxGA = Math.max(1, ...points.map((p) => p.ga));
  const xStep = (W - PAD_X * 2) / (points.length - 1);
  const xOf = (i) => PAD_X + i * xStep;
  const yOf = (v) => H - PAD_Y - (v / maxGA) * (H - PAD_Y * 2);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.ga).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xOf(points.length - 1).toFixed(1)},${(H - PAD_Y).toFixed(1)} L${xOf(0).toFixed(1)},${(H - PAD_Y).toFixed(1)} Z`;
  const activePoint = active != null ? points[active] : null;

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Progresso")}</div>
        <div style={{ fontSize: 10, color: C.text3 }}>⚽+🎯 {t("por dia jogado")}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", touchAction: "manipulation" }}>
        <defs>
          <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#progressFill)" stroke="none" />
        <path d={linePath} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setActive(active === i ? null : i)} style={{ cursor: "pointer" }}>
            <circle cx={xOf(i)} cy={H - PAD_Y + 9} r="10" fill="transparent" />
            <circle cx={xOf(i)} cy={yOf(p.ga)} r={active === i ? 5 : 4} fill={active === i ? C.accent : C.card} stroke={C.accent} strokeWidth="2" />
            <text x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="8" fill={C.text3}>{p.date.split(" ")[0]}</text>
          </g>
        ))}
      </svg>
      {activePoint && (
        <div style={{ background: C.surface, borderRadius: 10, padding: "8px 12px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.text2, flex: 1 }}>{activePoint.date}</span>
          <span style={{ ...displayFont, fontSize: 14, color: C.text1 }}>⚽ {activePoint.goals}</span>
          <span style={{ ...displayFont, fontSize: 14, color: C.text1 }}>🎯 {activePoint.assists}</span>
        </div>
      )}
    </div>
  );
}
