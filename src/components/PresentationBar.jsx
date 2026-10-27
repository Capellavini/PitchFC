import { useState } from "react";
import { C, R, S, T } from "../theme";
import { exitPresentation } from "../lib/presentation";
import { PERSONAS, LANGS, enterPersona, resetPresentationData, setPresentationLang } from "../lib/presentationPersonas";
import { getLang } from "../lib/i18n";

/** Floating "DEMO" pill (presentation mode only): jump between personas
 *  without going back to the launcher, reset the seeded data, or leave. */
export default function PresentationBar() {
  const [open, setOpen] = useState(false);
  if (/^\/demo\/?$/.test(window.location.pathname)) return null;
  const reset = () => { resetPresentationData(); window.location.href = "/demo"; };
  return (
    <div style={{ position: "fixed", left: "50%", top: 8, transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu da demonstração" style={{
        background: C.accent, color: C.bg, border: "none", borderRadius: R.pill, fontSize: T.min, fontWeight: 900, letterSpacing: "0.08em",
        padding: "6px 12px", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.45)", opacity: open ? 1 : 0.8,
      }}>DEMO</button>
      {open && (
        <div role="menu" style={{ background: `${C.card}F7`, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.sm, marginTop: S.sm, minWidth: 200, boxShadow: "0 10px 30px rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }}>
          {PERSONAS.map((p) => (
            <button key={p.id} role="menuitem" onClick={() => enterPersona(p.id)} style={item}>
              <span aria-hidden>{p.emoji}</span> {p.title}
            </button>
          ))}
          <div style={{ height: 1, background: C.border, margin: `${S.xs}px 0` }} />
          <div style={{ display: "flex", gap: S.xs, padding: `${S.xs}px 10px` }}>
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setPresentationLang(l.id)} aria-pressed={getLang() === l.id} style={{
                flex: 1, minHeight: 36, borderRadius: R.control, cursor: "pointer", font: "inherit", fontSize: T.meta, fontWeight: 800,
                border: `1px solid ${getLang() === l.id ? C.accent : C.border}`, background: getLang() === l.id ? `${C.accent}22` : "transparent",
                color: getLang() === l.id ? C.accent : C.text2,
              }}>{l.label}</button>
            ))}
          </div>
          <button role="menuitem" onClick={() => { window.location.href = "/demo"; }} style={item}>🏠 Menu da demo</button>
          <button role="menuitem" onClick={reset} style={item}>↺ Repor dados</button>
          <button role="menuitem" onClick={exitPresentation} style={{ ...item, color: C.text3 }}>✕ Sair da demo</button>
        </div>
      )}
    </div>
  );
}

const item = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none",
  color: C.text1, fontSize: T.body, fontWeight: 700, padding: "10px 10px", minHeight: 40, borderRadius: R.control, cursor: "pointer", font: "inherit",
};
