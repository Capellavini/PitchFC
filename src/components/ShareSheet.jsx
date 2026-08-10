import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";

/** Generic "one button → pick an action" sheet — replaces scattered
 *  standalone share buttons with a single entry point. `options`:
 *  [{ icon, label, desc?, onClick, done? }]. `done` swaps in a green
 *  "Copiado!" state for a couple seconds after a copy-style action fires
 *  (same convention as the old inline copy buttons). Mirrors the visual
 *  language of CardTemplatePicker, the other "one button → sheet" case. */
export default function ShareSheet({ title, options, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 14, textAlign: "center" }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {options.map(({ icon: Icon, label, desc, onClick, done }, i) => (
            <button key={i} onClick={onClick}
              style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", border: `1px solid ${done ? C.greenBorder : C.border}` }}>
              <Icon size={22} color={done ? C.green : C.accent} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{done ? t("Copiado!") : label}</div>
                {desc && !done && <div style={{ fontSize: 12, color: C.text2 }}>{desc}</div>}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", padding: 8 }}>{t("Fechar")}</button>
      </div>
    </div>
  );
}
