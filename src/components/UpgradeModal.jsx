import { useState } from "react";
import { X, Check, Lock, BellRing } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../theme";
import { t, getLang } from "../lib/i18n";
import { isGroupPlan, planPrice, fmtMoney, startCheckout } from "../lib/plans";
import { PAGE, PLANS, UPGRADE } from "../lib/pricingCopy";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const REQUIRED = { club: UPGRADE.availableClub, club_ai: UPGRADE.availableClubAi, player_plus: UPGRADE.availablePlayerPlus };

/**
 * Upgrade dialog, used two ways:
 *  1. From /pricing: pick WHICH group to upgrade (when you manage several),
 *     then continue to checkout.
 *  2. As the soft paywall anywhere in the app (useGate): pass `feature`
 *     (+ `featureBody`) and the dialog explains the feature FIRST and shows
 *     the price second. Never an aggressive paywall: "Agora não" is as big
 *     as "Continuar".
 *
 * Billing is off today (startCheckout → billing_unavailable), so
 * "Continuar" never dead-ends: it turns into "Os pagamentos abrem em
 * breve. Queres ser avisado?" → "Avisa-me" calls `onInterest` (records a
 * lead; optional) → "Combinado!". Nothing is ever charged.
 *
 * Props: planId ("club" | "club_ai" | "player_plus"), billing, size, market ("EU" | "BR"),
 *   groups [{ id, name }] (groups the user manages), feature? / featureBody?
 *   (PT-PT source strings), canUpgrade (false for a plain member: explains
 *   the feature and says only the organizer can change the plan),
 *   onInterest?({ planId, groupId }) → Promise, onClose, onSeePlans?.
 */
export default function UpgradeModal({ planId, billing = "monthly", size = "standard", market = "EU", groups = [], feature = null, featureBody = null,
  canUpgrade = true, onInterest, onClose, onSeePlans }) {
  const needsGroup = isGroupPlan(planId);
  const [groupId, setGroupId] = useState(groups.length === 1 ? groups[0].id : null);
  const [step, setStep] = useState("offer"); // offer | interest | done
  const [busy, setBusy] = useState(false);
  const [needGroup, setNeedGroup] = useState(false);
  const plan = PLANS[planId];
  const annual = billing === "annual";
  const price = fmtMoney(planPrice(planId, billing, size, market), market, getLang());
  const unit = needsGroup ? (annual ? PAGE.perYearGroup : PAGE.perMonthGroup) : (annual ? PAGE.perYear : PAGE.perMonth);

  const go = async () => {
    if (needsGroup && !groupId) { setNeedGroup(true); return; }
    setBusy(true);
    const result = await startCheckout({ planId, billingPeriod: billing, market, groupId, groupSize: size });
    setBusy(false);
    if (result.ok && result.url) { window.location.href = result.url; return; }
    setStep("interest"); // billing_unavailable (or any other failure): never a dead end
  };

  const notify = async () => {
    setBusy(true);
    try { await onInterest?.({ planId, groupId }); } catch { /* best effort — the person still gets the friendly answer */ }
    setBusy(false);
    setStep("done");
  };

  const features = (plan.features || []).slice(0, 4);
  const box = { background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.control, padding: S.lg, marginBottom: S.lg };

  return (
    <div onClick={onClose} role="presentation" style={{ position: "fixed", inset: 0, zIndex: 80, background: `${C.bg}E6`, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={feature ? t(feature) : t(plan.name)}
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: `${R.card + 4}px ${R.card + 4}px 0 0`, padding: `${S.md}px ${S.xl}px ${S.xxl}px`, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: `0 auto ${S.md}px` }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: S.md, marginBottom: S.lg }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {feature && (
              <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, marginBottom: S.xs }}>
                <Lock size={13} aria-hidden /> {t(REQUIRED[planId])}
              </div>
            )}
            <h2 style={{ ...displayFont, fontSize: T.h + 4, margin: 0, lineHeight: 1.15, overflowWrap: "anywhere" }}>{feature ? t(feature) : t(plan.name)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t(UPGRADE.close)}
            style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -12, marginTop: -8, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {step === "done" && (
          <div role="status" style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.body, fontWeight: 800, marginBottom: S.xs }}>
              <Check size={16} color={C.accent} strokeWidth={3} aria-hidden /> {t(UPGRADE.doneTitle)}
            </div>
            <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45 }}>{t(UPGRADE.doneBody)}</div>
          </div>
        )}

        {step === "interest" && (
          <div role="status" style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.body, fontWeight: 800, marginBottom: S.xs }}>
              <BellRing size={16} color={C.accent} aria-hidden /> {t(UPGRADE.interestTitle)}
            </div>
            <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45 }}>{t(UPGRADE.interestBody)}</div>
          </div>
        )}

        {step === "offer" && (
          <>
            {/* feature first (when contextual), price second */}
            <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45, marginBottom: S.md }}>{t(featureBody || plan.subtitle)}</div>
            {!feature && features.length > 0 && (
              <ul style={{ listStyle: "none", margin: `0 0 ${S.lg}px`, padding: 0, display: "flex", flexDirection: "column", gap: S.sm }}>
                {features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: S.sm, fontSize: T.body, alignItems: "flex-start" }}>
                    <Check size={16} color={C.accent} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden /> {t(f)}
                  </li>
                ))}
              </ul>
            )}
            {canUpgrade ? (
              <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: S.sm, marginBottom: S.lg }}>
                <span style={{ ...displayFont, fontSize: 34, color: C.accent }}>{price}</span>
                <span style={{ fontSize: T.body, color: C.text2 }}>{t(unit)} · {t(plan.name)}</span>
              </div>
            ) : (
              <div style={{ ...box, background: C.surface, border: `1px solid ${C.border}`, fontSize: T.body, color: C.text2, lineHeight: 1.45 }}>{t(UPGRADE.askOrganizer)}</div>
            )}

            {canUpgrade && needsGroup && groups.length > 1 && (
              <fieldset style={{ border: "none", margin: `0 0 ${S.lg}px`, padding: 0 }}>
                <legend style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.sm, padding: 0 }}>{t(UPGRADE.whichGroup)}</legend>
                <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                  {groups.map((g) => {
                    const on = groupId === g.id;
                    return (
                      <button key={g.id} type="button" role="radio" aria-checked={on} onClick={() => { setGroupId(g.id); setNeedGroup(false); }}
                        style={{ minHeight: TOUCH.min + 4, textAlign: "left", padding: `0 ${S.lg}px`, borderRadius: R.control, cursor: "pointer", fontSize: T.body, fontWeight: 700, color: C.text1, background: on ? C.accentDim : C.surface, border: `1px solid ${on ? C.accent : C.border}` }}>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {needGroup && <div role="alert" style={{ fontSize: T.meta, color: C.orange, marginBottom: S.md }}>{t(UPGRADE.needGroup)}</div>}
          </>
        )}

        <div style={{ display: "flex", gap: S.sm }}>
          {step === "done" || !canUpgrade ? (
            <BtnPrimary onClick={onClose} style={{ flex: 1 }}>{t(step === "done" ? UPGRADE.close : UPGRADE.gotIt)}</BtnPrimary>
          ) : (
            <>
              <BtnGhost onClick={onClose} style={{ flex: 1 }}>{t(UPGRADE.notNow)}</BtnGhost>
              {step === "offer"
                ? <BtnPrimary onClick={go} disabled={busy} style={{ flex: 1 }}>{t(UPGRADE.continue)}</BtnPrimary>
                : <BtnPrimary onClick={notify} disabled={busy} style={{ flex: 1 }}>{t(UPGRADE.notifyMe)}</BtnPrimary>}
            </>
          )}
        </div>
        {onSeePlans && feature && step !== "done" && (
          <div style={{ textAlign: "center", marginTop: S.sm }}>
            <button type="button" onClick={onSeePlans}
              style={{ minHeight: TOUCH.min, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>
              {t(UPGRADE.seePlans)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
