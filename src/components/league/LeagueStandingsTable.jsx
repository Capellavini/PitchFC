import { useEffect, useState } from "react";
import { C, S, T, TOUCH, displayFont } from "../../theme";
import { t } from "../../lib/i18n";

const COLS = [["j", "J", "Jogos"], ["w", "V", "Vitórias"], ["d", "E", "Empates"], ["l", "D", "Derrotas"], ["gf", "GM", "Golos marcados"], ["ga", "GS", "Golos sofridos"], ["gd", "DG", "Diferença de golos"], ["pts", "Pts", "Pontos"]];

const useNarrow = (px = 480) => {
  const [q] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(`(max-width: ${px}px)`) : null));
  const [narrow, setNarrow] = useState(Boolean(q?.matches));
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setNarrow(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, [q]);
  return narrow;
};

/** P J V E D GM GS DG Pts. On narrow screens the team column shows the
 *  short code (full name in the accessible label) so the row fits 320px;
 *  the table still scrolls inside its own box if needed. */
export default function LeagueStandingsTable({ rows, followId, onTeam, provisional }) {
  const narrow = useNarrow();
  const cell = { padding: `${S.sm}px ${narrow ? 3 : S.sm}px`, textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: narrow ? T.meta : T.body };
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${provisional ? C.orange : C.border}`, borderRadius: 16, background: C.card }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {provisional ? t("Classificação provisória") : t("Classificação oficial")}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...cell, color: C.text2, fontSize: T.min }}>P</th>
            <th scope="col" style={{ ...cell, textAlign: "left", color: C.text2, fontSize: T.min }}>{t("Equipa")}</th>
            {COLS.map(([k, ab, full]) => <th key={k} scope="col" title={t(full)} style={{ ...cell, color: C.text2, fontSize: T.min }}><abbr title={t(full)} style={{ textDecoration: "none" }}>{ab}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const mine = r.id === followId;
            return (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.border}`, background: mine ? C.accentDim : "transparent" }}>
                <td style={{ ...cell, fontWeight: 800, color: C.text2 }}>{i + 1}</td>
                <td style={{ ...cell, textAlign: "left", padding: 0 }}>
                  {onTeam ? (
                    <button type="button" onClick={() => onTeam(r.id)} aria-label={r.name}
                      style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, width: "100%", background: "none", border: "none", color: C.text1, cursor: "pointer", padding: `0 ${S.xs}px`, textAlign: "left", fontSize: narrow ? T.meta : T.body, fontWeight: 700 }}>
                      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: r.color, flexShrink: 0 }} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{narrow ? r.short : r.name}</span>
                    </button>
                  ) : (
                    // A read-only table (the league page): the team is a name, not a button that goes nowhere.
                    <span title={r.name} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, padding: `0 ${S.xs}px`, fontSize: narrow ? T.meta : T.body, fontWeight: 700, color: C.text1 }}>
                      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: r.color, flexShrink: 0 }} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{narrow ? r.short : r.name}</span>
                    </span>
                  )}
                </td>
                {COLS.map(([k]) => (
                  <td key={k} style={{ ...cell, ...(k === "pts" ? { ...displayFont, color: C.text1, fontSize: T.body } : { color: k === "gd" ? (r.gd > 0 ? C.green : r.gd < 0 ? C.red : C.text2) : C.text2 }) }}>
                    {k === "gd" && r.gd > 0 ? `+${r.gd}` : r[k]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
