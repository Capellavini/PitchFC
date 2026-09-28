import { ChevronRight } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import MiniSlotGrid from "./MiniSlotGrid";

/**
 * NextActionCard — Home's single "what needs me now?" card (also reused
 * at the top of Matchday pre-match). Spec §3: action required = lime
 * left edge + lime icon, ONE lime CTA; an optional quiet secondary.
 *
 * Props:
 *  - Icon, eyebrow, title, subtitle — header.
 *  - primaryLabel / onPrimary       — the one lime CTA.
 *  - secondaryLabel / onSecondary   — quiet outlined secondary.
 *  - slots    { taken, spots } → mini slot grid (when about the next game).
 *  - onOpen / openLabel             — small "Ver jogo ›" link (deep link).
 *  - status   optional node next to the eyebrow (e.g. a Chip).
 *  - neutral  true = informational (no lime edge; CTA rendered as ghost).
 *  - style    container overrides.
 */
export default function NextActionCard({ Icon, eyebrow, title, subtitle, primaryLabel, onPrimary, secondaryLabel, onSecondary, slots, onOpen, openLabel, status, neutral, style }) {
  const tint = neutral ? C.text2 : C.accent;
  return (
    <div style={{ ...cardStyle, ...(neutral ? {} : { borderLeft: `3px solid ${C.accent}` }), marginBottom: S.lg, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: S.md, marginBottom: S.lg }}>
        {Icon && (
          <div style={{ width: 40, height: 40, borderRadius: R.control, background: neutral ? C.surface : C.accentDim, border: neutral ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={20} color={tint} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {(eyebrow || status) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.xs }}>
              {eyebrow && <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", color: tint }}>{eyebrow}</div>}
              {status}
            </div>
          )}
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {subtitle && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xxs }}>{subtitle}</div>}
        </div>
      </div>

      {slots && (
        <div style={{ marginBottom: S.lg }}>
          <MiniSlotGrid taken={slots.taken} spots={slots.spots} onClick={onOpen} />
        </div>
      )}

      {primaryLabel && (
        <div style={{ display: "flex", gap: S.sm }}>
          {neutral
            ? <BtnGhost block onClick={onPrimary}>{primaryLabel}</BtnGhost>
            : <BtnPrimary block onClick={onPrimary} style={{ flex: 1 }}>{primaryLabel}</BtnPrimary>}
          {secondaryLabel && (
            <BtnGhost onClick={onSecondary} style={{ color: C.text2, flexShrink: 0 }}>{secondaryLabel}</BtnGhost>
          )}
        </div>
      )}

      {onOpen && openLabel && (
        <button type="button" onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs, width: "100%", minHeight: TOUCH.min, marginTop: S.xs, marginBottom: -S.sm, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer" }}>
          {openLabel} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
