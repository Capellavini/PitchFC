import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, cardStyle } from "../theme";

/**
 * Card with a tappable header that expands/collapses its content. Keeps
 * the Jogo tab focused on the slot grid by tucking secondary sections
 * (material, payments, timer…) away until needed.
 */
export default function Collapsible({ icon, title, subtitle, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...cardStyle, marginBottom: 14, padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: C.text1, display: "flex", alignItems: "center", gap: 10, padding: 16, textAlign: "left" }}
      >
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {badge != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 9px" }}>{badge}</span>
        )}
        <ChevronDown size={18} color={C.text3} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}
