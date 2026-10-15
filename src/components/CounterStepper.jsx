import { Minus, Plus } from "lucide-react";
import { C, R, T, TOUCH, displayFont } from "../theme";

/** A small labelled −/+ counter (44px targets) for goals / assists. The
 *  value is a live region so a screen reader hears each change.
 *  Props: label, value, onChange(n), max, lessLabel / moreLabel (aria). */
export default function CounterStepper({ label, value, onChange, max = 30, lessLabel, moreLabel }) {
  const btn = (disabled) => ({
    width: TOUCH.min, height: TOUCH.min, borderRadius: R.control, background: C.card, border: `1px solid ${C.border}`, color: C.text1,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
  });
  return (
    <div role="group" aria-label={label} style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <button type="button" aria-label={lessLabel} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} style={btn(value <= 0)}><Minus size={16} aria-hidden /></button>
        <div aria-live="polite" style={{ ...displayFont, fontSize: 24, minWidth: 28, textAlign: "center", color: value ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <button type="button" aria-label={moreLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} style={btn(value >= max)}><Plus size={16} aria-hidden /></button>
      </div>
    </div>
  );
}
