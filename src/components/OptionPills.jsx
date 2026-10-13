import { C, R, S, T, TOUCH } from "../theme";

/** Single-choice pill row (radiogroup), 44px targets, wraps on narrow
 *  screens. options: [{ id, label }] — labels already translated. */
export default function OptionPills({ options, value, onChange, label, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.id)}
            style={{
              minHeight: TOUCH.min, minWidth: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill,
              background: on ? C.accent : "transparent", color: on ? C.bg : C.text2,
              border: `1px solid ${on ? C.accent : C.border}`, fontSize: T.meta + 1, fontWeight: on ? 800 : 600,
              cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
