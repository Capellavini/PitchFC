import { C, R, S, T, TOUCH } from "../theme";

/** Selectable pill for the guided onboarding (weekday, format, quick
 *  answers). 44px tall — touch target rule; lime only when selected. */
export default function OnboardingAiPill({ children, active, onClick, style, ...rest }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={Boolean(active)} {...rest} style={{
      minHeight: TOUCH.min, minWidth: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill,
      background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text1,
      border: `1px solid ${active ? C.accent : C.border}`, fontSize: T.body, fontWeight: active ? 800 : 600,
      cursor: "pointer", boxSizing: "border-box", fontFamily: "inherit", ...style,
    }}>
      {children}
    </button>
  );
}
