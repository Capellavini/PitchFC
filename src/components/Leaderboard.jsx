import { useState } from "react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SegmentedControl from "./SegmentedControl";
import BtnGhost from "./BtnGhost";

const TOP_N = 10;

// Season leaderboard categories. Reliability = matchdays played / matchdays
// the group held this season (derived, never stored — CLAUDE.md data model).
const CATEGORIES = [
  { id: "goals",       label: "Golos",         column: "Golos" },
  { id: "assists",     label: "Assistências",  column: "Assist." },
  { id: "mvps",        label: "MVP",           column: "MVP" },
  { id: "reliability", label: "Fiabilidade %", column: "%" },
];

const RANK_COLOR = [C.gold, C.silver, C.bronze];

/** Season leaderboard for Competir — league-table look (brief mockup):
 *  one card, rows with rank · avatar · name · value, top 3 in medal
 *  colours, the viewer's row highlighted. Shows the top 10 (+ my row
 *  when I'm further down) with a "Ver todos" toggle. */
export default function Leaderboard({ group, seasonDays }) {
  const [cat, setCat] = useState("goals");
  const [showAll, setShowAll] = useState(false);

  const valueOf = (p) => {
    if (cat === "reliability") return seasonDays ? Math.min(100, Math.round(((p.gamesPlayed || 0) / seasonDays) * 100)) : 0;
    return p[cat] || 0;
  };

  const sorted = [...group].sort((a, b) => valueOf(b) - valueOf(a) || String(a.nick).localeCompare(String(b.nick)));
  // Competition ranking: ties share a rank (1, 1, 3…).
  const ranked = [];
  sorted.forEach((p, i) => {
    const v = valueOf(p);
    const rank = i > 0 && v === ranked[i - 1].value ? ranked[i - 1].rank : i + 1;
    ranked.push({ p, value: v, rank });
  });
  const allZero = ranked.every((r) => r.value === 0);

  let rows = showAll ? ranked : ranked.slice(0, TOP_N);
  const meRow = ranked.find((r) => r.p.isMe);
  const meBelow = !showAll && meRow && !rows.includes(meRow);

  const active = CATEGORIES.find((c) => c.id === cat);

  const renderRow = (r, i, gapBefore = false) => {
    const { p, value, rank } = r;
    const top3 = rank <= 3 && value > 0;
    const color = top3 ? RANK_COLOR[rank - 1] : C.text2;
    return (
      <div key={p.id} style={{
        display: "flex", alignItems: "center", gap: S.md, minHeight: 56, padding: `${S.sm}px ${S.lg}px`,
        borderTop: i > 0 || gapBefore ? `1px solid ${C.border}` : "none",
        background: p.isMe ? C.surface : "transparent",
        boxShadow: p.isMe ? `inset 3px 0 0 ${C.accent}` : "none",
      }}>
        <span style={{ ...displayFont, width: 24, textAlign: "center", fontSize: top3 ? T.h - 2 : T.body, color }}>{rank}</span>
        <Avatar name={p.name || p.nick} color={playerColor(group, p)} size={top3 ? 40 : 34} isMe={p.isMe} photo={p.photo} injured={p.injured} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.body + 1, fontWeight: top3 || p.isMe ? 800 : 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.nick}{p.isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("· tu")}</span>}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cat === "reliability"
              ? `${p.gamesPlayed || 0}/${seasonDays} ${t("dias de jogo")}`
              : (p.position ? t(p.position) : "")}
          </div>
        </div>
        <span style={{ ...displayFont, fontSize: top3 ? T.h + 2 : T.h - 2, color: top3 ? C.text1 : C.text2, minWidth: 40, textAlign: "right" }}>
          {value}{cat === "reliability" ? "%" : ""}
        </span>
      </div>
    );
  };

  return (
    <div style={{ marginBottom: S.xl }}>
      <SegmentedControl options={CATEGORIES} value={cat} onChange={(id) => { setCat(id); setShowAll(false); }} style={{ marginBottom: S.md }} />

      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {/* table header */}
        <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.sm + 2}px ${S.lg}px`, borderBottom: `1px solid ${C.border}`, fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 }}>
          <span style={{ width: 24, textAlign: "center" }}>#</span>
          <span style={{ flex: 1 }}>{t("Jogador")}</span>
          <span style={{ minWidth: 40, textAlign: "right" }}>{t(active.column)}</span>
        </div>

        {ranked.length === 0 || (cat === "reliability" && !seasonDays) ? (
          <div style={{ padding: S.lg, fontSize: T.body - 1, color: C.text2 }}>{t("Ainda sem dias de jogo registados.")}</div>
        ) : (
          <>
            {allZero && (
              <div style={{ padding: `${S.md}px ${S.lg}px`, fontSize: T.meta, color: C.text2, borderBottom: `1px solid ${C.border}` }}>
                {t("Ninguém pontuou ainda nesta categoria.")}
              </div>
            )}
            {rows.map((r, i) => renderRow(r, i))}
            {meBelow && (
              <>
                <div style={{ textAlign: "center", fontSize: T.meta, color: C.text2, padding: `${S.xs}px 0`, borderTop: `1px solid ${C.border}` }}>···</div>
                {renderRow(meRow, 0, true)}
              </>
            )}
          </>
        )}
      </div>

      {ranked.length > TOP_N && (
        <div style={{ marginTop: S.sm }}>
          <BtnGhost block onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("Ver menos") : `${t("Ver todos")} (${ranked.length})`}
          </BtnGhost>
        </div>
      )}
    </div>
  );
}
