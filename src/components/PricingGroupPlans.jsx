import { C, S, T } from "../theme";
import { t, getLang } from "../lib/i18n";
import { planPrice, fmtPlanPrice } from "../lib/plans";
import { PAGE, PLANS, CTA } from "../lib/pricingCopy";
import PricingPlanCard from "./PricingPlanCard";
import PricingAiDemo from "./PricingAiDemo";

const priceLang = () => (getLang() === "en" ? "en" : "pt");

/** Free · Club · Club + AI — the three group plans. Large groups (31–60)
 *  are a size modifier on Club / Club + AI, never a fourth card. */
export default function PricingGroupPlans({ billing, size, upgradeLabel = false, onPlan }) {
  const annual = billing === "annual";
  const lang = priceLang();
  const cta = (planId) => (upgradeLabel && planId !== "free" ? CTA.upgradeGroup : PLANS[planId].cta);

  const paid = (planId) => ({
    price: fmtPlanPrice(planPrice(planId, billing, size), lang),
    unit: annual ? PAGE.perYearGroup : PAGE.perMonthGroup,
    priceNote: (
      <>
        {annual && <strong style={{ color: C.accent, fontWeight: 800 }}>{t(PAGE.perSaving)} · </strong>}
        {size === "large" ? t(PAGE.sizeLarge) : t(PAGE.includesUpTo30)}
      </>
    ),
  });

  const largeHint = (
    <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4, textAlign: "center" }}>
      {size === "standard" && <>{t(annual ? PAGE.largeLineAnnual : PAGE.largeLine)}<br /></>}
      {t(PAGE.above60)} <a href="mailto:vini@pitch-fc.com?subject=Pitch%2060%2B%20players" style={{ color: C.text1, fontWeight: 700 }}>{t(PAGE.talkToUs)}</a>
    </div>
  );

  return (
    <div className="pr-grid">
      <PricingPlanCard id="free" name={PLANS.free.name} tag={PLANS.free.tag} subtitle={PLANS.free.subtitle}
        price={fmtPlanPrice(0, lang)}
        features={PLANS.free.features} cta={PLANS.free.cta} onCta={() => onPlan("free")} />

      <PricingPlanCard id="club" name={PLANS.club.name} subtitle={PLANS.club.subtitle}
        {...paid("club")} inherits={PLANS.club.inherits} features={PLANS.club.features}
        cta={cta("club")} onCta={() => onPlan("club")} footer={largeHint} />

      <PricingPlanCard id="club_ai" name={PLANS.club_ai.name} badge={PAGE.mostPopular} highlighted subtitle={PLANS.club_ai.subtitle}
        {...paid("club_ai")} inherits={PLANS.club_ai.inherits} features={PLANS.club_ai.features}
        cta={cta("club_ai")} ctaVariant="primary" onCta={() => onPlan("club_ai")} footer={largeHint}>
        <PricingAiDemo name={PLANS.club_ai.copilotName} label={PLANS.club_ai.demoLabel} ask={PLANS.club_ai.demoAsk} reply={PLANS.club_ai.demoReply} />
      </PricingPlanCard>
    </div>
  );
}

