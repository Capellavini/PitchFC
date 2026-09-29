import { C, R, S, T, TOUCH } from "../theme";

/**
 * Chip — small pill for CONTEXT (spec §3: Grupo / Equipa / Competição),
 * statuses ("Pago", "Pendente") and filters. Not a CTA — use BtnPrimary.
 *
 * Props:
 *  - children  label (already t()-wrapped).
 *  - variant   "neutral" (default) | "lime" | "green" | "orange" | "red".
 *              lime = active/selected context only (lime = action/state).
 *  - Icon      optional lucide icon component, rendered 14px before label.
 *  - onClick   makes it a <button>; the visual pill stays 28px but the
 *              hit area is padded to 44px tall (touch target rule).
 *  - title     tooltip / accessible name.
 *  - style     overrides for the pill itself.
 *
 * e.g. <Chip Icon={Users}>{groupName}</Chip>  ·  <Chip variant="green">{t("Pago")}</Chip>
 */
export default function Chip({ children, variant = "neutral", Icon, onClick, title, style }) {
  const v = {
    neutral: { bg: C.surface,   fg: C.text2,  bd: C.border },
    lime:    { bg: C.accentDim, fg: C.accent, bd: C.accentBorder },
    green:   { bg: C.greenDim,  fg: C.green,  bd: C.greenBorder },
    orange:  { bg: C.orangeDim, fg: C.orange, bd: `${C.orange}55` },
    red:     { bg: C.redDim,    fg: C.red,    bd: `${C.red}55` },
  }[variant] ?? { bg: C.surface, fg: C.text2, bd: C.border };

  const pill = (
    <span title={onClick ? undefined : title} style={{
      display: "inline-flex", alignItems: "center", gap: S.xs + 2, height: 28, maxWidth: "100%",
      padding: `0 ${S.md - 2}px`, borderRadius: R.pill, boxSizing: "border-box",
      background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
      fontSize: T.meta, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      ...style,
    }}>
      {Icon && <Icon size={14} strokeWidth={2.25} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </span>
  );

  if (!onClick) return pill;
  return (
    <button type="button" onClick={onClick} title={title} style={{
      display: "inline-flex", alignItems: "center", minHeight: TOUCH.min, padding: 0,
      background: "none", border: "none", cursor: "pointer", maxWidth: "100%",
    }}>
      {pill}
    </button>
  );
}
