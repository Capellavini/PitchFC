import { C, R, S, T, TOUCH } from "../theme";

/**
 * BtnPrimary — the ONE lime call-to-action of a card/screen (spec §3:
 * lime = action only, one primary CTA per card).
 *
 * Props:
 *  - children   label (already t()-wrapped) and/or a lucide icon; laid
 *               out inline-flex with an 8px gap, centred.
 *  - onClick
 *  - disabled   muted, not clickable (opacity .45, cursor not-allowed).
 *  - block      full width (width: 100%).
 *  - compact    36px min height instead of 48 — ONLY for dense chrome
 *               (e.g. landing header); never for a card's main CTA.
 *  - style      overrides (spread last), plus any other <button> prop
 *               (type, aria-label, title…) passed through.
 */
export default function BtnPrimary({ children, onClick, disabled, block, compact, style, ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest} style={{
      minHeight: compact ? 36 : TOUCH.button,
      width: block ? "100%" : undefined,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm,
      background: C.accent, color: C.bg, border: `1px solid ${C.accent}`, borderRadius: R.control,
      padding: `0 ${S.lg}px`, fontWeight: 800, fontSize: T.body, lineHeight: 1.2,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
      boxSizing: "border-box",
      ...style,
    }}>
      {children}
    </button>
  );
}
