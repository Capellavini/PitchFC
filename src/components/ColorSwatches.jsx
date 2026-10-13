import { Check } from "lucide-react";
import { C, R, TEAM_COLORS, TOUCH, inkOn } from "../theme";
import { RC, tf } from "../lib/rivalsCopy";

/** Kit-colour picker (TEAM_COLORS) as a radiogroup of 44px swatches. */
export default function ColorSwatches({ value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {TEAM_COLORS.map((hex, i) => {
        const on = value === hex;
        return (
          <button key={hex} type="button" role="radio" aria-checked={on} aria-label={tf(RC.colorN, { n: i + 1 })} onClick={() => onChange(hex)} style={{
            width: TOUCH.min, height: TOUCH.min, borderRadius: R.control - 2, background: hex, cursor: "pointer", padding: 0,
            border: `2px solid ${on ? C.accent : C.border}`, boxShadow: on ? `0 0 0 2px ${C.bg} inset` : "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {on && <Check size={16} color={inkOn(hex)} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
