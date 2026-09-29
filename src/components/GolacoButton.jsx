import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";

/** ⚽ Golaço — PITCH's native reaction (posts and auto feed items).
 *  Active = lime tint (lime marks active state). 44px touch target. */
export default function GolacoButton({ active, count = 0, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={Boolean(active)} style={{
      minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, boxSizing: "border-box",
      display: "inline-flex", alignItems: "center", gap: S.xs + 2,
      background: active ? C.accentDim : "transparent",
      color: active ? C.accent : C.text2,
      border: `1px solid ${active ? C.accentBorder : C.border}`,
      fontSize: T.meta, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    }}>
      <span aria-hidden style={{ fontSize: T.body }}>⚽</span> {t("Golaço")}
      {count > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </button>
  );
}
