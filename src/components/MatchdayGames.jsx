import { useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import { C, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { buildGameView } from "../lib/matchdayGames";

const ICON = { goal: "⚽", og: "🙈", save: "🧤" };

/** The finished games of one matchday, each one tappable to reopen its detail
 *  (goals, assists, own goals, saves, clean sheets) — the same idea as the
 *  concluded-game rows during the live day, but read-only and kept forever. */
export default function MatchdayGames({ summary }) {
  const [openN, setOpenN] = useState(null);
  const matches = (summary?.matches ?? []).filter((m) => m && m.homeName != null);
  if (!matches.length) return null;

  const sideColor = (s) => s.color || C.text1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text3 }}>
        {t("JOGOS")} · <span style={{ fontWeight: 600, letterSpacing: 0 }}>{t("toca num jogo para ver os detalhes")}</span>
      </div>
      {matches.map((m) => {
        const v = buildGameView(m, summary);
        const open = openN === m.n;
        const tag = (s) => (s === "h" ? v.home : s === "a" ? v.away : null);
        return (
          <div key={m.n} style={{ background: C.surface, borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenN(open ? null : m.n)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", textAlign: "left", color: C.text1 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.text3, width: 40, flexShrink: 0 }}>{t("JOGO")} {v.n}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: sideColor(v.home), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", flex: 1 }}>{v.home.name}</span>
                <span style={{ ...displayFont, fontSize: 15, flexShrink: 0 }}>{v.home.goals} – {v.away.goals}</span>
                <span style={{ color: sideColor(v.away), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", flex: 1 }}>{v.away.name}</span>
              </span>
              <ChevronDown size={15} color={C.text3} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
            </button>

            {open && (
              <div style={{ padding: "2px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {v.detailed ? (
                  <>
                    {v.goals.length === 0 && v.saves.length === 0 && (
                      <div style={{ fontSize: 12, color: C.text3 }}>{t("Sem golos neste jogo")}</div>
                    )}
                    {v.goals.map((e, i) => (
                      <div key={`g${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 28, textAlign: "right", fontSize: 10, color: C.text3, flexShrink: 0 }}>{e.min != null ? `${e.min}'` : ""}</span>
                        <span>{ICON[e.type]}</span>
                        <span style={{ fontWeight: 700 }}>{e.who}</span>
                        {e.type === "og" && <span style={{ color: C.text3 }}>({t("próprio golo")})</span>}
                        {e.assist && <span style={{ color: C.text2 }}>🎯 {e.assist}</span>}
                        <span style={{ marginLeft: "auto", fontSize: 10, color: sideColor(tag(e.side) ?? {}), whiteSpace: "nowrap" }}>{tag(e.side)?.name}</span>
                      </div>
                    ))}
                    {v.saves.map((e, i) => (
                      <div key={`s${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text2 }}>
                        <span style={{ width: 28, textAlign: "right", fontSize: 10, color: C.text3, flexShrink: 0 }}>{e.min != null ? `${e.min}'` : ""}</span>
                        <span>{ICON.save}</span><span style={{ fontWeight: 700, color: C.text1 }}>{e.who}</span><span>{t("grande defesa")}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: sideColor(tag(e.side) ?? {}), whiteSpace: "nowrap" }}>{tag(e.side)?.name}</span>
                      </div>
                    ))}
                    {(v.home.gk || v.away.gk) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.text2 }}>
                        <span>🧤 {t("GR")}:</span>
                        {v.home.gk && <span style={{ color: sideColor(v.home) }}>{v.home.gk}</span>}
                        {v.home.gk && v.away.gk && <span style={{ color: C.text3 }}>·</span>}
                        {v.away.gk && <span style={{ color: sideColor(v.away) }}>{v.away.gk}</span>}
                        {v.cleanSheets.map((cs) => (
                          <span key={cs.side} style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: 6, color: C.green }}>
                            <Shield size={11} /> {cs.who}: {t("baliza a zero")}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {v.scorers.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.text3 }}>{t("Sem golos neste jogo")}</div>
                    ) : v.scorers.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ fontWeight: 700 }}>{s.who}</span>
                        <span style={{ color: C.text2, display: "flex", gap: 8 }}>
                          {s.goals > 0 && <span>⚽ {s.goals}</span>}
                          {s.assists > 0 && <span>🎯 {s.assists}</span>}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: sideColor(tag(s.side) ?? {}), whiteSpace: "nowrap" }}>{tag(s.side)?.name}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{t("Este dia foi encerrado antes do registo golo a golo: só há totais por jogador.")}</div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
