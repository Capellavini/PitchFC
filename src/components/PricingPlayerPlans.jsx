import { Check, MessageCircle } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t, getLang } from "../lib/i18n";
import { planPrice, fmtPlanPrice } from "../lib/plans";
import { PAGE, PLANS } from "../lib/pricingCopy";
import PricingPlanCard from "./PricingPlanCard";

const pillarLabel = { fontSize: T.meta, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent };

function Example({ children }) {
  return (
    <div style={{ marginTop: S.sm, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.sm}px ${S.md}px`, fontSize: T.body - 1, color: C.text2, fontStyle: "italic", lineHeight: 1.4, display: "flex", gap: S.sm }}>
      <MessageCircle size={14} color={C.text3} style={{ flexShrink: 0, marginTop: 3 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Four-pillar body of Player+ — identity, intelligence and discovery,
 *  deliberately not a "see more stats" paywall. Open Matches stay free. */
function PlusPillars() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S.xl }}>
      {PLANS.player_plus.pillars.map((p) => (
        <section key={p.id} aria-label={t(p.title)}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
            <span style={pillarLabel}>{t(p.title)}</span>
            {p.beta && <span style={{ fontSize: T.min, fontWeight: 800, color: C.orange, border: `1px solid ${C.orange}55`, background: C.orangeDim, borderRadius: R.pill, padding: "1px 8px" }}>{t(p.beta)}</span>}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.sm }}>
            {p.items.map((it) => (
              <li key={it} style={{ display: "flex", gap: S.sm, alignItems: "flex-start", fontSize: T.body, lineHeight: 1.35 }}>
                <Check size={16} color={C.accent} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span>{t(it)}</span>
              </li>
            ))}
          </ul>
          {p.example && <Example>{t(p.example)}</Example>}
          {p.examples && <div style={{ display: "flex", flexDirection: "column", gap: S.xs + 2 }}>{p.examples.map((ex) => <Example key={ex}>{t(ex)}</Example>)}</div>}
        </section>
      ))}
    </div>
  );
}

/** Player (free) · Player+ — exactly two options, no tiers. */
export default function PricingPlayerPlans({ billing, onPlan }) {
  const annual = billing === "annual";
  const lang = getLang() === "en" ? "en" : "pt";
  return (
    <div className="pr-grid pr-grid-2">
      <PricingPlanCard id="player_free" name={PLANS.player_free.name} tag={PLANS.player_free.tag} subtitle={PLANS.player_free.subtitle}
        price={fmtPlanPrice(0, lang)} features={PLANS.player_free.features}
        cta={PLANS.player_free.cta} onCta={() => onPlan("player_free")}
        footer={<div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.45 }}>{t(PAGE.openMatchesFree)}</div>} />

      <PricingPlanCard id="player_plus" name={PLANS.player_plus.name} badge="Player+" highlighted subtitle={PLANS.player_plus.subtitle}
        price={fmtPlanPrice(planPrice("player_plus", billing), lang)} unit={annual ? PAGE.perYear : PAGE.perMonth}
        priceNote={annual ? <strong style={{ color: C.accent, fontWeight: 800 }}>{t(PAGE.perSaving)}</strong> : null}
        cta={PLANS.player_plus.cta} ctaVariant="primary" onCta={() => onPlan("player_plus")}
        inherits={PLANS.player_plus.inherits} features={[]} body={<PlusPillars />} />
    </div>
  );
}
