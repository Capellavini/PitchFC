import { useState } from "react";
import { Info } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t, getLang } from "../lib/i18n";
import {
  impactoOf, gkScoreOf, reliabilityOf, formaOf, isHot, recentDaysOf,
  performanceGapFn, ratedPlayers, dayTeamRows,
} from "../lib/rankings";
import Avatar from "./Avatar";
import SegmentedControl from "./SegmentedControl";
import BtnGhost from "./BtnGhost";

const TOP_N = 10;
const RANK_COLOR = [C.gold, C.silver, C.bronze];
const round1 = (v) => Math.round(v * 10) / 10;
// Impacto weights give halves (2,5 per Médio goal) — decimal comma outside EN.
const fmtNum = (v) => (getLang() === "en" ? String(v) : String(v).replace(".", ","));

/** Season leaderboard for Competir — league-table look (brief mockup):
 *  one card, rows with rank · avatar · name · value, top 3 in medal
 *  colours, the viewer's row highlighted. Shows the top 10 (+ my row
 *  when I'm further down) with a "Ver todos" toggle.
 *
 *  Opens on Impacto. Categories: Impacto · Golos · Assistências · MVP ·
 *  Guarda-redes · Forma · Fiabilidade % · Mais (Jogadores de campo, Só
 *  guarda-redes, Sobre-entrega, Melhor ataque/defesa num dia). Formulas
 *  live in src/lib/rankings.js. Same props in cloud and local demo:
 *  `group` rows carry season totals, `matchdaySummaries` newest-first. */
export default function Leaderboard({ group, seasonDays, matchdaySummaries = [] }) {
  const [cat, setCat] = useState("impacto");
  const [more, setMore] = useState("onfield");
  const [showAll, setShowAll] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const recentDays = recentDaysOf(matchdaySummaries);
  const gapOf = performanceGapFn(group);
  const teamRows = dayTeamRows(matchdaySummaries);
  const pos = (p) => (p.position ? t(p.position) : "");

  const CATEGORIES = {
    impacto: { label: "Impacto", column: "Pts", value: impactoOf,
      hint: "Quem está mais completo esta época, tudo junto num só número: golo vale mais quanto mais longe da baliza adversária é a posição (2 Avançado, 2,5 Médio, 3 Defesa, 4 Guarda-redes), 1 por assistência, 1 por vitória, 3 por MVP, 1 por baliza a zero." },
    goals: { label: "Golos", column: "Golos", value: (p) => p.goals || 0, hint: "Total de golos marcados na época." },
    assists: { label: "Assistências", column: "Assist.", value: (p) => p.assists || 0, hint: "Total de assistências na época." },
    mvps: { label: "MVP", column: "MVP", value: (p) => p.mvps || 0, hint: "Vezes eleito MVP do dia." },
    gk: { label: "Guarda-redes", column: "Pts", value: gkScoreOf,
      meta: (p) => `${p.cleanSheets || 0} ${t("balizas a zero")} · ${p.epicSaves || 0} ${t("defesas")}`,
      hint: "Balizas a zero (valem 3×) e defesas espetaculares — conta quem defendeu de verdade, não só quem joga na baliza." },
    forma: { label: "Forma", column: "Pts", value: (p) => formaOf(p, recentDays), hot: (p) => isHot(p, recentDays),
      hint: "O mesmo cálculo do Impacto, mas só dos últimos 5 dias de jogo — quem está em alta agora. 🔥 = a render bem acima da média da época." },
    reliability: { label: "Fiabilidade %", column: "%", suffix: "%", value: (p) => reliabilityOf(p, seasonDays),
      meta: (p) => `${p.gamesPlayed || 0}/${seasonDays} ${t("dias de jogo")}`, needsDays: true },
    // ── "Mais" ──
    onfield: { label: "Jogadores de campo", column: "Pts", value: impactoOf, source: group.filter((p) => p.position !== "Guarda-redes"),
      hint: "O mesmo cálculo do Impacto, só que restrito a quem joga fora da baliza." },
    gkOnly: { label: "Só guarda-redes", column: "Pts", value: gkScoreOf, source: group.filter((p) => p.position === "Guarda-redes"),
      meta: (p) => `${p.cleanSheets || 0} ${t("balizas a zero")} · ${p.epicSaves || 0} ${t("defesas")}`,
      hint: "O mesmo cálculo de Guarda-redes, só que restrito a quem joga nessa posição." },
    gap: { label: "Sobre-entrega", column: "%", suffix: "%", signed: true, value: gapOf, source: ratedPlayers(group),
      empty: "Ninguém tem ainda 3+ avaliações dos colegas para comparar.",
      hint: "Compara o ranking de avaliação (OVR dos colegas) com o ranking real de Impacto. Positivo = rende mais do que esperavam; negativo = rende menos. Só entra quem já tem 3+ avaliações." },
    attackDay: { label: "Melhor ataque (dia)", column: "Golos", team: true, rows: [...teamRows].sort((a, b) => b.gf - a.gf).slice(0, 8), teamValue: (r) => r.gf,
      hint: "Mais golos marcados por uma equipa num único dia de jogo." },
    defenseDay: { label: "Melhor defesa (dia)", column: "Sofridos", team: true, rows: [...teamRows].sort((a, b) => a.ga - b.ga).slice(0, 8), teamValue: (r) => r.ga,
      hint: "Menos golos sofridos por uma equipa num único dia de jogo." },
  };
  const MAIN = ["impacto", "goals", "assists", "mvps", "gk", "forma", "reliability"];
  const MORE = ["onfield", "gkOnly", "gap", "attackDay", "defenseDay"];
  const activeId = cat === "mais" ? more : cat;
  const active = CATEGORIES[activeId];

  // ── rows (players or per-day teams) with competition ranking (1, 1, 3…) ──
  let ranked;
  if (active.team) {
    ranked = [];
    active.rows.forEach((r, i) => {
      const v = active.teamValue(r);
      const rank = i > 0 && v === ranked[i - 1].value ? ranked[i - 1].rank : i + 1;
      ranked.push({ key: `${r.name}-${r.date}-${i}`, team: r, value: v, rank });
    });
  } else {
    const source = active.source || group;
    const sorted = [...source].sort((a, b) => active.value(b) - active.value(a) || String(a.nick).localeCompare(String(b.nick)));
    ranked = [];
    sorted.forEach((p, i) => {
      const v = round1(active.value(p));
      const rank = i > 0 && v === ranked[i - 1].value ? ranked[i - 1].rank : i + 1;
      ranked.push({ key: p.id, p, value: v, rank });
    });
  }
  const allZero = !active.signed && !active.team && ranked.every((r) => r.value === 0);

  const rows = showAll ? ranked : ranked.slice(0, TOP_N);
  const meRow = ranked.find((r) => r.p?.isMe);
  const meBelow = !showAll && meRow && !rows.includes(meRow);

  const renderRow = (r, i, gapBefore = false) => {
    const { p, team, value, rank } = r;
    // Medals only for "real" leaders (value > 0; for signed gap, positive).
    const top3 = rank <= 3 && (active.team ? true : value > 0);
    const color = top3 ? RANK_COLOR[rank - 1] : C.text2;
    const valueColor = active.signed ? (value > 0 ? C.green : value < 0 ? C.red : C.text2) : top3 ? C.text1 : C.text2;
    return (
      <div key={r.key} style={{
        display: "flex", alignItems: "center", gap: S.md, minHeight: 56, padding: `${S.sm}px ${S.lg}px`,
        borderTop: i > 0 || gapBefore ? `1px solid ${C.border}` : "none",
        background: p?.isMe ? C.surface : "transparent",
        boxShadow: p?.isMe ? `inset 3px 0 0 ${C.accent}` : "none",
      }}>
        <span style={{ ...displayFont, width: 24, textAlign: "center", fontSize: top3 ? T.h - 2 : T.body, color }}>{rank}</span>
        {team ? (
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: team.color || C.border, border: `1px solid ${C.border}` }} />
        ) : (
          <Avatar name={p.name || p.nick} color={playerColor(group, p)} size={top3 ? 40 : 34} isMe={p.isMe} photo={p.photo} injured={p.injured} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.body + 1, fontWeight: top3 || p?.isMe ? 800 : 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {team ? team.name : <>{active.hot?.(p) && "🔥 "}{p.nick}{p.isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("· tu")}</span>}</>}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {team ? team.date : active.meta ? active.meta(p) : pos(p)}
          </div>
        </div>
        <span style={{ ...displayFont, fontSize: top3 ? T.h + 2 : T.h - 2, color: valueColor, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {active.signed && value > 0 ? "+" : ""}{fmtNum(value)}{active.suffix || ""}
        </span>
      </div>
    );
  };

  const options = [...MAIN.map((id) => ({ id, label: CATEGORIES[id].label })), { id: "mais", label: "Mais" }];
  const noDays = active.needsDays && !seasonDays;

  return (
    <div style={{ marginBottom: S.xl }}>
      <SegmentedControl options={options} value={cat} onChange={(id) => { setCat(id); setShowAll(false); }} style={{ marginBottom: S.md }} />

      {cat === "mais" && (
        <select value={more} onChange={(e) => { setMore(e.target.value); setShowAll(false); }} aria-label={t("Mais rankings")}
          style={{ width: "100%", minHeight: 44, marginBottom: S.md, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px`, fontSize: T.body, fontWeight: 700, color: C.text1, outline: "none" }}>
          {MORE.map((id) => <option key={id} value={id}>{t(CATEGORIES[id].label)}</option>)}
        </select>
      )}

      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {/* table header */}
        <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.xs}px ${S.xs}px ${S.xs}px ${S.lg}px`, borderBottom: `1px solid ${C.border}`, fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 }}>
          <span style={{ width: 24, textAlign: "center" }}>#</span>
          <span style={{ flex: 1, display: "flex", alignItems: "center", gap: S.xs, minWidth: 0 }}>
            {active.team ? t("Equipa") : t("Jogador")}
            {active.hint && (
              <button type="button" onClick={() => setShowHint((v) => !v)} aria-expanded={showHint} aria-label={t("Como se calcula?")} title={t("Como se calcula?")}
                style={{ width: 36, height: 36, background: "none", border: "none", color: showHint ? C.text1 : C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                <Info size={14} />
              </button>
            )}
          </span>
          <span style={{ minWidth: 40, textAlign: "right", paddingRight: S.md }}>{t(active.column)}</span>
        </div>
        {showHint && active.hint && (
          <div style={{ padding: `${S.md}px ${S.lg}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.45, borderBottom: `1px solid ${C.border}`, background: C.surface }}>
            {t(active.hint)}
          </div>
        )}

        {ranked.length === 0 || noDays ? (
          <div style={{ padding: S.lg, fontSize: T.body - 1, color: C.text2 }}>{t(active.empty || "Ainda sem dias de jogo registados.")}</div>
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
