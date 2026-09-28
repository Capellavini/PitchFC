import { C, R, S, T, TOUCH } from "../theme";

/**
 * BtnGhost — secondary action, outlined. Same metrics as BtnPrimary
 * (48px tall, radius 12) so a primary + ghost pair lines up.
 *
 * Props:
 *  - children, onClick, disabled, block, compact, style — as BtnPrimary.
 *  - tone       "neutral" (default: C.border outline, C.text1 label) |
 *               "accent" (lime outline + label on accentDim — use for a
 *               secondary action that still belongs to the lime flow) |
 *               "danger" (red outline + label — destructive only).
 */
export default function BtnGhost({ children, onClick, disabled, block, compact, tone = "neutral", style, ...rest }) {
  const tones = {
    neutral: { bg: "transparent", fg: C.text1, bd: C.border },
    accent:  { bg: C.accentDim, fg: C.accent, bd: C.accentBorder },
    danger:  { bg: "transparent", fg: C.red, bd: `${C.red}66` },
  };
  const tn = tones[tone] ?? tones.neutral;
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest} style={{
      minHeight: compact ? 36 : TOUCH.button,
      width: block ? "100%" : undefined,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm,
      background: tn.bg, color: tn.fg, border: `1px solid ${tn.bd}`, borderRadius: R.control,
      padding: `0 ${S.lg}px`, fontWeight: 700, fontSize: T.body, lineHeight: 1.2,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      boxSizing: "border-box",
      ...style,
    }}>
      {children}
    </button>
  );
}
