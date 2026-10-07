import { useState } from "react";
import { X, Check, Lock } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../theme";
import { t, getLang } from "../lib/i18n";
import { isGroupPlan, planPrice, fmtPlanPrice, startCheckout } from "../lib/plans";
import { PAGE, PLANS, UPGRADE } from "../lib/pricingCopy";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const REQUIRED = { club: UPGRADE.availableClub, club_ai: UPGRADE.availableClubAi, player_plus: UPGRADE.availablePlayerPlus };

/**
 * Upgrade dialog, used two ways:
 *  1. From /pricing: pick WHICH group to upgrade (when you manage several),
 *     then continue to checkout.
 *  2. As a contextual prompt anywhere in the app ("Available with Pitch
 *     Club") — pass `feature` and the dialog explains the feature FIRST and
 *     shows the price second. Never an aggressive paywall: "Not now" is as
 *     big as "Continue".
 *
 * Props: planId ("club" | "club_ai" | "player_plus"), billing, size,
 *   groups [{ id, name }] (groups the user manages), feature? (PT-PT source
 *   string describing the locked feature), onClose, onSeePlans?.
 * Checkout goes through startCheckout() — billing is off today, so the
 * result is a friendly "not open yet, nothing charged".
 */
export default function UpgradeModal({ planId, billing = "monthly", size = "standard", groups = [], feature = null, onClose, onSeePlans }) {
  const needsGroup = isGroupPlan(planId);
  const [groupId, setGroupId] = useState(groups.length === 1 ? groups[0].id : null);
  const [state, setState] = useState({ busy: false, result: null });
  const plan = PLANS[planId];
  const lang = getLang() === "en" ? "en" : "pt";
  const annual = billing === "annual";
  const price = fmtPlanPrice(planPrice(planId, billing, size), lang);
  const unit = needsGroup ? (annual ? PAGE.perYearGroup : PAGE.perMonthGroup) : (annual ? PAGE.perYear : PAGE.perMonth);

  const go = async () => {
    if (needsGroup && !groupId) return setState({ busy: false, result: { ok: false, reason: "group_required" } });
    setState({ busy: true, result: null });
    const result = await startCheckout({ planId, billing, groupId, groupSize: size });
    if (result.ok && result.url) { window.location.href = result.url; return; }
    setState({ busy: false, result });
  };

  const r = state.result;
  const soon = r?.reason === "billing_unavailable";
  const features = (plan.features || []).slice(0, 4);

  return (
    <div onClick={onClose} role="presentation" style={{ position: "fixed", inset: 0, zIndex: 80, background: `${C.bg}E6`, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t(plan.name)}
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: `${R.card + 4}px ${R.card + 4}px 0 0`, padding: `${S.md}px ${S.xl}px ${S.xxl}px`, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: `0 auto ${S.md}px` }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: S.md, marginBottom: S.lg }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {feature && (
              <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, marginBottom: S.xs }}>
                <Lock size={13} aria-hidden /> {t(REQUIRED[planId])}
              </div>
            )}
            <h2 style={{ ...displayFont, fontSize: T.h + 4, margin: 0, lineHeight: 1.15 }}>{feature ? t(feature) : t(plan.name)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t(UPGRADE.close)}
            style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -12, marginTop: -8, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={20} />
          </button>
        </div>

        {soon ? (
          <div role="status" style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.control, padding: S.lg, marginBottom: S.lg }}>
            <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.xs }}>{t(UPGRADE.soonTitle)}</div>
            <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45 }}>{t(UPGRADE.soonBody)}</div>
          </div>
        ) : (
          <>
            {/* feature first (when contextual), price second */}
            <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45, marginBottom: S.md }}>{t(plan.subtitle)}</div>
            {!feature && features.length > 0 && (
              <ul style={{ listStyle: "none", margin: `0 0 ${S.lg}px`, padding: 0, display: "flex", flexDirection: "column", gap: S.sm }}>
                {features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: S.sm, fontSize: T.body, alignItems: "flex-start" }}>
                    <Check size={16} color={C.accent} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden /> {t(f)}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, marginBottom: S.lg }}>
              <span style={{ ...displayFont, fontSize: 34, color: C.accent }}>{price}</span>
              <span style={{ fontSize: T.body, color: C.text2 }}>{t(unit)} · {t(plan.name)}</span>
            </div>

            {needsGroup && groups.length > 1 && (
              <fieldset style={{ border: "none", margin: `0 0 ${S.lg}px`, padding: 0 }}>
                <legend style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.sm, padding: 0 }}>{t(UPGRADE.whichGroup)}</legend>
                <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                  {groups.map((g) => {
                    const on = groupId === g.id;
                    return (
                      <button key={g.id} type="button" role="radio" aria-checked={on} onClick={() => setGroupId(g.id)}
                        style={{ minHeight: TOUCH.min + 4, textAlign: "left", padding: `0 ${S.lg}px`, borderRadius: R.control, cursor: "pointer", fontSize: T.body, fontWeight: 700, color: C.text1, background: on ? C.accentDim : C.surface, border: `1px solid ${on ? C.accent : C.border}` }}>
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {r?.reason === "group_required" && <div role="alert" style={{ fontSize: T.meta, color: C.orange, marginBottom: S.md }}>{t(UPGRADE.needGroup)}</div>}
          </>
        )}

        <div style={{ display: "flex", gap: S.sm }}>
          <BtnGhost onClick={onClose} style={{ flex: 1 }}>{t(soon ? UPGRADE.close : UPGRADE.notNow)}</BtnGhost>
          {!soon && (onSeePlans && feature
            ? <BtnPrimary onClick={onSeePlans} style={{ flex: 1 }}>{t(UPGRADE.seePlans)}</BtnPrimary>
            : <BtnPrimary onClick={go} disabled={state.busy} style={{ flex: 1 }}>{t(UPGRADE.continue)}</BtnPrimary>)}
        </div>
      </div>
    </div>
  );
}
