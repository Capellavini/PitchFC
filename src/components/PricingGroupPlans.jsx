import { C, S, T } from "../theme";
import { t, getLang } from "../lib/i18n";
import { planPrice, fmtMoney, largeGroupAddon, activeCampaign } from "../lib/plans";
import { PAGE, PLANS, CTA } from "../lib/pricingCopy";
import PricingPlanCard from "./PricingPlanCard";
import PricingAiDemo from "./PricingAiDemo";

const uiLang = () => getLang();

/** Free · Club · Club + AI — the three group plans. Large groups (31–60)
 *  are a size modifier on Club / Club + AI, never a fourth card. */
export default function PricingGroupPlans({ billing, size, market, upgradeLabel = false, current = {}, onPlan, onManage }) {
  const annual = billing === "annual";
  const lang = uiLang();
  const money = (n) => fmtMoney(n, market, lang);
  const cta = (planId) => (upgradeLabel && planId !== "free" ? CTA.upgradeGroup : PLANS[planId].cta);

  // Optional temporary campaign (e.g. Founding Club, Brazil) — null unless enabled by config.
  const campaign = (planId) => activeCampaign(market, planId, billing, size);

  const paid = (planId) => {
    const c = campaign(planId);
    return {
      price: money(c ? c.monthly : planPrice(planId, billing, size, market)),
      unit: annual ? PAGE.perYearGroup : PAGE.perMonthGroup,
      priceNote: (
        <>
          {c && <strong style={{ color: C.accent, fontWeight: 800 }}>{t(PAGE.foundingLabel)} · </strong>}
          {annual && <strong style={{ color: C.accent, fontWeight: 800 }}>{t(PAGE.perSaving)} · </strong>}
          {size === "large" ? t(PAGE.sizeLarge) : t(PAGE.includesUpTo30)}
        </>
      ),
    };
  };
  const foundingNote = (planId) => {
    const c = campaign(planId);
    return c ? (
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4, textAlign: "center" }}>
        {t(PAGE.foundingNote)} <span style={{ color: C.text3 }}>({money(planPrice(planId, billing, size, market))}{t(PAGE.perMonthShort)})</span>
      </div>
    ) : null;
  };

  const largeHint = (
    <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4, textAlign: "center" }}>
      {size === "standard" && <>{t(PAGE.largeBand)}: +{money(largeGroupAddon(billing, market))}{t(annual ? PAGE.perYearShort : PAGE.perMonthShort)}<br /></>}
      {t(PAGE.above60)} <a href="mailto:vini@pitch-fc.com?subject=Pitch%2060%2B%20players" style={{ color: C.text1, fontWeight: 700 }}>{t(PAGE.talkToUs)}</a>
    </div>
  );

  return (
    <div className="pr-grid">
      <PricingPlanCard id="free" name={PLANS.free.name} tag={PLANS.free.tag} subtitle={PLANS.free.subtitle}
        price={money(0)}
        features={PLANS.free.features} cta={PLANS.free.cta} onCta={() => onPlan("free")} />

      <PricingPlanCard id="club" name={PLANS.club.name} subtitle={PLANS.club.subtitle}
        {...paid("club")} inherits={PLANS.club.inherits} features={PLANS.club.features}
        cta={cta("club")} onCta={() => onPlan("club")} current={Boolean(current.club)} onManage={onManage}
        footer={<>{foundingNote("club")}{largeHint}</>} />

      <PricingPlanCard id="club_ai" name={PLANS.club_ai.name} badge={PAGE.mostPopular} highlighted subtitle={PLANS.club_ai.subtitle}
        {...paid("club_ai")} inherits={PLANS.club_ai.inherits} features={PLANS.club_ai.features}
        cta={cta("club_ai")} ctaVariant="primary" onCta={() => onPlan("club_ai")} current={Boolean(current.club_ai)} onManage={onManage}
        footer={<>{foundingNote("club_ai")}{largeHint}</>}>
        <PricingAiDemo name={PLANS.club_ai.copilotName} label={PLANS.club_ai.demoLabel} ask={PLANS.club_ai.demoAsk} reply={PLANS.club_ai.demoReply} />
      </PricingPlanCard>
    </div>
  );
}

