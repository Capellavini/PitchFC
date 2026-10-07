import { useState } from "react";
import { Check, Minus, ChevronDown } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { COMPARE } from "../lib/pricingCopy";

const cell = (v) => {
  if (v === true) return <Check size={16} color={C.accent} strokeWidth={3} aria-label="✓" />;
  if (v === false) return <Minus size={16} color={C.text3} aria-label="—" />;
  return <span style={{ fontSize: T.meta, color: C.text1, fontWeight: 700, lineHeight: 1.2 }}>{t(v)}</span>;
};

/** Short feature comparison as accordions (no wide table → works at 375px).
 *  Groups and players have their own columns, per the audience toggle. */
export default function PricingComparison({ audience }) {
  const data = audience === "players" ? COMPARE.players : COMPARE.groups;
  const [open, setOpen] = useState(() => new Set([0]));
  const toggle = (i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const cols = `minmax(0, 1fr) repeat(${data.cols.length}, minmax(52px, ${audience === "players" ? "1fr" : "72px"}))`;

  return (
    <section aria-labelledby="pr-compare">
      <h2 id="pr-compare" style={{ ...displayFont, fontSize: "clamp(22px, 4vw, 30px)", margin: `0 0 ${S.lg}px` }}>{t(COMPARE.title)}</h2>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: S.sm, padding: `${S.md}px ${S.lg}px`, borderBottom: `1px solid ${C.border}`, fontSize: T.min, fontWeight: 800, color: C.text2, textAlign: "center" }}>
          <span />
          {data.cols.map((c) => <span key={c} style={{ color: c === "Club + AI" || c === "Player+" ? C.accent : C.text2 }}>{c}</span>)}
        </div>
        {data.sections.map((sec, i) => {
          const isOpen = open.has(i);
          return (
            <div key={sec.title} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <button type="button" aria-expanded={isOpen} onClick={() => toggle(i)}
                style={{ width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", color: C.text1, padding: `0 ${S.lg}px`, fontSize: T.body, fontWeight: 800, cursor: "pointer" }}>
                {t(sec.title)}
                <ChevronDown size={18} color={C.text3} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} aria-hidden />
              </button>
              {isOpen && (
                <div style={{ padding: `0 ${S.lg}px ${S.sm}px` }}>
                  {sec.rows.map(([label, ...vals]) => (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: cols, gap: S.sm, alignItems: "center", minHeight: 44, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
                      <span style={{ fontSize: T.body, color: C.text2, textAlign: "left", lineHeight: 1.25 }}>{t(label)}</span>
                      {vals.map((v, j) => <span key={j} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>{cell(v)}</span>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
