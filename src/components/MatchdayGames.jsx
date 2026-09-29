import { useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { buildGameView } from "../lib/matchdayGames";

const ICON = { goal: "⚽", og: "🙈", save: "🧤" };

/** The finished games of one matchday, each one tappable to reopen its detail
 *  (goals, assists, own goals, saves, clean sheets) — read-only, kept forever.
 *
 *  `framed` draws the list as ONE card with divided rows —
 *  the Matchday tab's look. Default (unframed) is for when it already sits inside
 *  a card (e.g. GroupRecords) so cards never nest. */
export default function MatchdayGames({ summary, framed = false }) {
  const [openN, setOpenN] = useState(null);
  const matches = (summary?.matches ?? []).filter((m) => m && m.homeName != null);
  if (!matches.length) return null;

  const sideColor = (s) => s.color || C.text1;
  const metaRow = { display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, minHeight: 24 };
  const minuteCol = { width: 28, textAlign: "right", fontSize: T.min, color: C.text2, flexShrink: 0 };

  const rows = matches.map((m, i) => {
    const v = buildGameView(m, summary);
    const open = openN === m.n;
    const tag = (s) => (s === "h" ? v.home : s === "a" ? v.away : null);
    return (
      <div key={m.n} style={framed
        ? { borderTop: i ? `1px solid ${C.border}` : "none" }
        : { background: C.surface, borderRadius: 12, overflow: "hidden", marginBottom: S.xs + 2 }}>
        <button type="button" onClick={() => setOpenN(open ? null : m.n)} aria-expanded={open}
          style={{ width: "100%", minHeight: 52, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: S.sm, padding: framed ? 0 : "10px 12px", textAlign: "left", color: C.text1 }}>
          <span style={{ fontSize: T.min, fontWeight: 800, color: C.text2, width: 48, flexShrink: 0 }}>{t("JOGO")} {v.n}</span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm, fontSize: T.body - 1, fontWeight: 700 }}>
            <span style={{ color: sideColor(v.home), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", flex: 1 }}>{v.home.name}</span>
            <span style={{ ...displayFont, fontSize: T.cardTitle, flexShrink: 0 }}>{v.home.goals} – {v.away.goals}</span>
            <span style={{ color: sideColor(v.away), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", flex: 1 }}>{v.away.name}</span>
          </span>
          <ChevronDown size={16} color={C.text2} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
        </button>

        {open && (
          <div style={{ padding: framed ? `0 0 ${S.md}px` : "2px 12px 12px", display: "flex", flexDirection: "column", gap: S.xs + 2 }}>
            {v.detailed ? (
              <>
                {v.goals.length === 0 && v.saves.length === 0 && (
                  <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Sem golos neste jogo")}</div>
                )}
                {v.goals.map((e, j) => (
                  <div key={`g${j}`} style={metaRow}>
                    <span style={minuteCol}>{e.min != null ? `${e.min}'` : ""}</span>
                    <span aria-hidden>{ICON[e.type]}</span>
                    <span style={{ fontWeight: 700 }}>{e.who}</span>
                    {e.type === "og" && <span style={{ color: C.text2 }}>({t("autogolo")})</span>}
                    {e.assist && <span style={{ color: C.text2 }}>🎯 {e.assist}</span>}
                    <span style={{ marginLeft: "auto", fontSize: T.min, color: sideColor(tag(e.side) ?? {}), whiteSpace: "nowrap" }}>{tag(e.side)?.name}</span>
                  </div>
                ))}
                {v.saves.map((e, j) => (
                  <div key={`s${j}`} style={{ ...metaRow, color: C.text2 }}>
                    <span style={minuteCol}>{e.min != null ? `${e.min}'` : ""}</span>
                    <span aria-hidden>{ICON.save}</span><span style={{ fontWeight: 700, color: C.text1 }}>{e.who}</span><span>{t("grande defesa")}</span>
                    <span style={{ marginLeft: "auto", fontSize: T.min, color: sideColor(tag(e.side) ?? {}), whiteSpace: "nowrap" }}>{tag(e.side)?.name}</span>
                  </div>
                ))}
                {(v.home.gk || v.away.gk) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.xs, paddingTop: S.sm, borderTop: `1px solid ${C.border}`, fontSize: T.meta, color: C.text2 }}>
                    <span>🧤 {t("GR")}:</span>
                    {v.home.gk && <span style={{ color: sideColor(v.home) }}>{v.home.gk}</span>}
                    {v.home.gk && v.away.gk && <span>·</span>}
                    {v.away.gk && <span style={{ color: sideColor(v.away) }}>{v.away.gk}</span>}
                    {v.cleanSheets.map((cs) => (
                      <span key={cs.side} style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 6, color: C.green }}>
                        <Shield size={12} /> {cs.who}: {t("baliza a zero")}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {v.scorers.length === 0 ? (
                  <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Sem golos neste jogo")}</div>
                ) : v.scorers.map((s, j) => (
                  <div key={j} style={metaRow}>
                    <span style={{ fontWeight: 700 }}>{s.who}</span>
                    <span style={{ color: C.text2, display: "flex", gap: S.sm }}>
                      {s.goals > 0 && <span>⚽ {s.goals}</span>}
                      {s.assists > 0 && <span>🎯 {s.assists}</span>}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: T.min, color: sideColor(tag(s.side) ?? {}), whiteSpace: "nowrap" }}>{tag(s.side)?.name}</span>
                  </div>
                ))}
                <div style={{ fontSize: T.min, color: C.text2, marginTop: 2 }}>{t("Este dia foi encerrado antes do registo golo a golo: só há totais por jogador.")}</div>
              </>
            )}
          </div>
        )}
      </div>
    );
  });

  if (!framed) return <div style={{ marginBottom: S.md }}>{rows}</div>;
  return <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>{rows}</div>;
}
