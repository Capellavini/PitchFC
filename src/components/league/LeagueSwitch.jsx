import { C, TOUCH } from "../../theme";

/** On/off switch (role="switch"), 44px touch target. */
export default function LeagueSwitch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 64, minHeight: TOUCH.min, flexShrink: 0, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      <span aria-hidden style={{ width: 48, height: 28, borderRadius: 999, background: on ? C.accent : C.border, position: "relative", transition: "background 120ms" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 999, background: on ? C.bg : C.text2, transition: "left 120ms" }} />
      </span>
    </button>
  );
}
