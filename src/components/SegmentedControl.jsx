import { C } from "../theme";
import { t } from "../lib/i18n";

/** Pill segmented control (mockup: "Your games | Open games | Groups",
 *  "Teams | Challenges | Leagues"). Active pill = lime fill + dark text;
 *  inactive = outlined, muted. 44px tall so every segment is a real
 *  touch target. `options`: [{ id, label, badge? }]. */
export default function SegmentedControl({ options, value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16, ...style }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            style={{
              flex: 1, minHeight: 44, borderRadius: 999, padding: "0 12px",
              background: active ? C.accent : "transparent",
              color: active ? C.bg : C.text2,
              border: `1px solid ${active ? C.accent : C.border}`,
              fontSize: 13, fontWeight: active ? 800 : 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              whiteSpace: "nowrap",
            }}>
            {t(o.label)}
            {o.badge && (
              <span style={{ width: 6, height: 6, borderRadius: 3, background: active ? C.bg : C.accent, flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
