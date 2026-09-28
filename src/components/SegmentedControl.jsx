import { C, R, S, TOUCH } from "../theme";
import { t } from "../lib/i18n";

/**
 * SegmentedControl — pill segments (mockup: "Your games | Open games |
 * Groups"). Active = lime fill + dark text (lime = active state);
 * inactive = outlined, C.text2. 44px tall so every segment is a real
 * touch target. Scrolls horizontally instead of squashing when the
 * labels don't fit (e.g. 4 segments in EN on a 360px phone).
 *
 * Props:
 *  - options   [{ id, label, badge? }] — `label` is the PT-PT source
 *              string (t() is applied here); `badge` shows a dot.
 *  - value     active id.
 *  - onChange  (id) => void.
 *  - style     container overrides (default marginBottom 16).
 */
export default function SegmentedControl({ options, value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: S.sm, marginBottom: S.lg, overflowX: "auto", scrollbarWidth: "none", ...style }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(o.id)}
            style={{
              flex: "1 0 auto", minHeight: TOUCH.min, borderRadius: R.pill, padding: `0 ${S.md + 2}px`,
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
