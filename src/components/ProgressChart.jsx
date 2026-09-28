import { useState } from "react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";

const W = 320, H = 140, PAD_X = 16, PAD_Y = 20;

/** Perfil → Stats: golos+assistências per matchday played, last 8. A
 *  single series, so no legend (the label names it); tap a point for the
 *  exact split instead of labelling every dot. `records` = normalized
 *  matchday list, newest first ({ date, summary }). */
export default function ProgressChart({ records = [], playerKey }) {
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
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <SectionLabel>{t("Progresso")}</SectionLabel>
        <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Precisas de pelo menos 2 dias de jogo para ver a tendência.")}</div>
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
    <div style={{ ...cardStyle, marginBottom: S.lg }}>
      <SectionLabel right={<span style={{ fontSize: T.meta, color: C.text2 }}>{t("G+A por dia jogado")}</span>}>{t("Progresso")}</SectionLabel>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", touchAction: "manipulation" }}>
        <defs>
          <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} stroke={C.border} strokeWidth="1" />
        <path d={areaPath} fill="url(#progressFill)" stroke="none" />
        <path d={linePath} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i} onClick={() => setActive(active === i ? null : i)} style={{ cursor: "pointer" }}>
            {/* generous invisible hit area — the dots themselves are tiny */}
            <rect x={xOf(i) - xStep / 2} y={0} width={Math.max(24, xStep)} height={H} fill="transparent" />
            <circle cx={xOf(i)} cy={yOf(p.ga)} r={active === i ? 5.5 : 4} fill={active === i ? C.accent : C.card} stroke={C.accent} strokeWidth="2" />
            <text x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="11" fill={C.text2}>{p.date.split(" ")[0]}</text>
          </g>
        ))}
      </svg>
      {activePoint && (
        <div style={{ display: "flex", alignItems: "baseline", gap: S.lg, marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: T.meta, color: C.text2, flex: 1 }}>{activePoint.date}</span>
          <span style={{ fontSize: T.meta, color: C.text2 }}><span style={{ ...displayFont, fontSize: T.h, color: C.text1 }}>{activePoint.goals}</span> {t("golos")}</span>
          <span style={{ fontSize: T.meta, color: C.text2 }}><span style={{ ...displayFont, fontSize: T.h, color: C.text1 }}>{activePoint.assists}</span> {t("assist.")}</span>
        </div>
      )}
    </div>
  );
}
