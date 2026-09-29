import { useState } from "react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t, getLang } from "../lib/i18n";
import { impactoOf, playerKey, togetherStats } from "../lib/rankings";
import Avatar from "./Avatar";
import BackHeader from "./BackHeader";

/**
 * 🆚 Comparar jogadores — pushed screen from Competir (was a sub-view of
 * the old group StatsTab). Pick 2–4 players: their season stats side by
 * side, plus how they do when they play TOGETHER on the same team
 * (games, win %, goals for/against — from matchdaySummaries' teamResults
 * snapshots, see togetherStats in src/lib/rankings.js).
 */
export default function ComparePlayers({ group, matchdaySummaries = [], onBack }) {
  const [picks, setPicks] = useState([]); // season-stable keys, 2-4 players
  const toggle = (key) => setPicks((cur) =>
    cur.includes(key) ? cur.filter((k) => k !== key) : (cur.length >= 4 ? cur : [...cur, key]));

  const picked = picks.map((k) => group.find((p) => playerKey(p) === k)).filter(Boolean);
  const together = picked.length >= 2 ? togetherStats(picks, matchdaySummaries) : null;

  const STAT_ROWS = [
    ["Jogos", (p) => p.gamesPlayed || 0],
    ["Golos", (p) => p.goals || 0],
    ["Assist.", (p) => p.assists || 0],
    ["MVP", (p) => p.mvps || 0],
    ["Impacto", (p) => Math.round(impactoOf(p) * 10) / 10],
  ];

  return (
    <div style={{ padding: `0 ${S.lg}px ${S.xl}px` }}>
      <BackHeader onBack={onBack} title={t("Comparar jogadores")} />
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md, lineHeight: 1.4 }}>
        {t("Escolhe 2 a 4 jogadores para comparar as stats e ver a % de vitórias quando jogam juntos.")}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: S.xl }}>
        {group.map((p) => {
          const key = playerKey(p);
          const on = picks.includes(key);
          return (
            <button key={p.id} type="button" onClick={() => toggle(key)} aria-pressed={on}
              style={{ minHeight: 44, display: "flex", alignItems: "center", gap: S.sm, background: on ? C.accentDim : C.card, border: `1px solid ${on ? C.accentBorder : C.border}`, borderRadius: R.pill, padding: `0 ${S.md}px 0 ${S.xs + 2}px`, cursor: "pointer" }}>
              <Avatar name={p.name} color={playerColor(group, p)} size={30} photo={p.photo} isMe={p.isMe} />
              <span style={{ fontSize: T.body - 1, fontWeight: on ? 800 : 600, color: on ? C.accent : C.text1 }}>{p.nick}</span>
            </button>
          );
        })}
      </div>

      {picked.length < 2 ? (
        <div style={{ ...cardStyle, fontSize: T.body, color: C.text2 }}>{t("Escolhe pelo menos 2 jogadores.")}</div>
      ) : (
        <>
          {/* side-by-side season stats */}
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: S.lg }}>
            <div style={{ display: "grid", gridTemplateColumns: `minmax(64px, 1fr) repeat(${picked.length}, minmax(0, 1fr))`, alignItems: "center", padding: `${S.md}px ${S.md}px`, borderBottom: `1px solid ${C.border}` }}>
              <span />
              {picked.map((p) => (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, minWidth: 0 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={36} photo={p.photo} isMe={p.isMe} />
                  <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text1, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
                </div>
              ))}
            </div>
            {STAT_ROWS.map(([label, fn], i) => {
              const vals = picked.map(fn);
              const best = Math.max(...vals);
              return (
                <div key={label} style={{ display: "grid", gridTemplateColumns: `minmax(64px, 1fr) repeat(${picked.length}, minmax(0, 1fr))`, alignItems: "center", minHeight: 44, padding: `0 ${S.md}px`, borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>{t(label)}</span>
                  {vals.map((v, j) => (
                    <span key={j} style={{ ...displayFont, fontSize: T.cardTitle + 2, textAlign: "center", color: v === best && best > 0 ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums" }}>{getLang() === "en" ? v : String(v).replace(".", ",")}</span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* together on the same team */}
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: S.sm }}>{t("Jogos juntos")}</div>
          <div style={{ ...cardStyle }}>
            {together.gamesTogether === 0 ? (
              <div style={{ fontSize: T.body - 1, color: C.text2, textAlign: "center", lineHeight: 1.4 }}>
                {t("Ainda sem dias em que todos jogaram juntos na mesma equipa — passa a contar a partir do próximo dia de jogo.")}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: S.sm }}>
                {[
                  [t("Jogos juntos"), together.gamesTogether, C.text1],
                  [t("% Vitórias"), `${Math.round((together.winsTogether / together.gamesTogether) * 100)}%`, C.text1],
                  [t("Golos marcados"), together.goalsFor, C.green],
                  [t("Golos sofridos"), together.goalsAgainst, C.red],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background: C.surface, borderRadius: R.control, padding: `${S.md}px ${S.sm}px`, textAlign: "center" }}>
                    <div style={{ ...displayFont, fontSize: T.h + 4, color }}>{value}</div>
                    <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
