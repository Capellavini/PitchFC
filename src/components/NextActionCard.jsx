import { ChevronRight, Clock, MapPin, CreditCard } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import SlotGrid from "./SlotGrid";
import FieldArtwork from "./FieldArtwork";

/**
 * NextActionCard — Home's single "what needs me now?" card (also reused
 * at the top of Matchday pre-match). Spec §3: action required = lime
 * left edge + lime icon, ONE lime CTA; an optional quiet secondary.
 *
 * Props:
 *  - Icon, eyebrow, title, subtitle — header.
 *  - primaryLabel / onPrimary       — the one lime CTA.
 *  - secondaryLabel / onSecondary   — quiet outlined secondary.
 *  - slots    { taken, spots, waitlist, groupName, date, time, venue } →
 *             "game" layout, the same visual language as Jogar's next-game
 *             card: PRÓXIMO JOGO header + count row + shared SlotGrid on
 *             the field artwork, then the action below a divider.
 *  - owes     amount label ("€4") → orange "Falta pagar" strip above the CTA.
 *  - prompt   short line above the CTA in the game layout ("Vais jogar?").
 *  - onOpen / openLabel             — small "Ver jogo ›" link (deep link).
 *  - status   optional node next to the eyebrow (e.g. a Chip).
 *  - neutral  true = informational (no lime edge; CTA rendered as ghost).
 *  - style    container overrides.
 */
export default function NextActionCard({ Icon, eyebrow, title, subtitle, primaryLabel, onPrimary, secondaryLabel, onSecondary, slots, onOpen, openLabel, status, neutral, owes, prompt, style }) {
  const tint = neutral ? C.text2 : C.accent;
  if (slots) return <GameLayout {...{ primaryLabel, onPrimary, secondaryLabel, onSecondary, slots, onOpen, openLabel, status, neutral, owes, prompt, style }} />;
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
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, lineHeight: 1.3, overflowWrap: "break-word" }}>{title}</div>
          {subtitle && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xxs }}>{subtitle}</div>}
        </div>
      </div>

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

/** Next-game variant: Jogar's card language, compact grid, action below. */
function GameLayout({ primaryLabel, onPrimary, secondaryLabel, onSecondary, slots, onOpen, openLabel, status, neutral, owes, prompt, style }) {
  const { taken = [], spots = 10, waitlist = 0, groupName, date, time, venue } = slots;
  const players = taken.slice(0, spots);
  return (
    <div style={{ ...cardStyle, padding: 0, position: "relative", overflow: "hidden", ...(neutral ? {} : { borderLeft: `3px solid ${C.accent}` }), marginBottom: S.lg, ...style }}>
      <div style={{ position: "relative", overflow: "hidden", padding: S.lg }}>
        <FieldArtwork />
        <div style={{ position: "relative", marginBottom: S.lg }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.xs }}>
            <span style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: "0.08em", color: C.text2 }}>{t("PRÓXIMO JOGO")}</span>
            {status}
          </div>
          <div style={{ fontSize: T.h, fontWeight: 800, lineHeight: 1.2, color: C.text1, overflowWrap: "break-word" }}>{groupName}</div>
          <div style={{ display: "flex", alignItems: "center", columnGap: S.md, rowGap: S.xs, fontSize: T.meta, color: C.text2, flexWrap: "wrap", marginTop: S.xs }}>
            {(date || time) && <span style={{ display: "flex", alignItems: "center", gap: S.xs }}><Clock size={13} /> {[date, time].filter(Boolean).join(" · ")}</span>}
            {venue && <span style={{ display: "flex", alignItems: "center", gap: S.xs }}><MapPin size={13} /> {venue}</span>}
          </div>
        </div>
        {onOpen ? (
          <button type="button" onClick={onOpen} aria-label={t("Ver jogo")} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", textAlign: "left", color: "inherit", position: "relative" }}>
            <SlotGrid compact players={players} spots={spots} waitlist={waitlist} />
          </button>
        ) : <SlotGrid compact players={players} spots={spots} waitlist={waitlist} />}
      </div>

      {(primaryLabel || owes || prompt) && (
        <div style={{ padding: S.lg, borderTop: `1px solid ${C.border}` }}>
          {owes && (
            <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: primaryLabel ? S.md : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: C.orangeDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={18} color={C.orange} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.body, fontWeight: 700, color: C.orange }}>{t("Falta pagar")} {owes}</div>
                <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Estás dentro — só falta a tua parte.")}</div>
              </div>
            </div>
          )}
          {prompt && <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, marginBottom: primaryLabel ? S.md : 0 }}>{prompt}</div>}
          {primaryLabel && (
            <div style={{ display: "flex", gap: S.sm }}>
              {neutral
                ? <BtnGhost block onClick={onPrimary}>{primaryLabel}</BtnGhost>
                : <BtnPrimary onClick={onPrimary} style={{ flex: 1 }}>{primaryLabel}</BtnPrimary>}
              {secondaryLabel && <BtnGhost onClick={onSecondary} style={{ flex: 1 }}>{secondaryLabel}</BtnGhost>}
            </div>
          )}
        </div>
      )}

      {onOpen && openLabel && !neutral && (
        <button type="button" onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs, width: "100%", minHeight: TOUCH.min, marginTop: -S.sm, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer" }}>
          {openLabel} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
