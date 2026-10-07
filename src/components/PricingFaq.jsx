import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { FAQ } from "../lib/pricingCopy";

/** Accordion FAQ. `onOpen(id)` fires only when a question opens (analytics). */
export default function PricingFaq({ onOpen }) {
  const [openId, setOpenId] = useState(null);
  return (
    <section aria-labelledby="pr-faq">
      <h2 id="pr-faq" style={{ ...displayFont, fontSize: "clamp(22px, 4vw, 30px)", margin: `0 0 ${S.lg}px` }}>{t(FAQ.title)}</h2>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {FAQ.items.map((it, i) => {
          const open = openId === it.id;
          return (
            <div key={it.id} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <button type="button" aria-expanded={open} aria-controls={`faq-${it.id}`}
                onClick={() => { if (!open) onOpen?.(it.id); setOpenId(open ? null : it.id); }}
                style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, background: "none", border: "none", color: C.text1, padding: `${S.md}px ${S.lg}px`, fontSize: T.body, fontWeight: 700, textAlign: "left", cursor: "pointer", lineHeight: 1.35 }}>
                <span>{t(it.q)}</span>
                <ChevronDown size={18} color={C.text3} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} aria-hidden />
              </button>
              {open && <div id={`faq-${it.id}`} style={{ padding: `0 ${S.lg}px ${S.lg}px`, fontSize: T.body, color: C.text2, lineHeight: 1.6 }}>{t(it.a)}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
