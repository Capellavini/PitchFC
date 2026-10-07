import { Check } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import { PAGE } from "../lib/pricingCopy";

/**
 * One plan on /pricing. Football product first: a big italic price, one
 * CTA, a plain feature list. `highlighted` (Club + AI) gets the lime
 * border + badge — it doesn't shrink the other cards, they stay full
 * strength so Free and Club never look deliberately weak.
 *
 * Props:
 *  - name, tag?, badge?, subtitle     header copy (already PT-PT source, t() applied here)
 *  - price                            display string ("€7,99")
 *  - unit?                            small text after the price ("/ mês / grupo")
 *  - priceNote?                       one line under the price
 *  - inherits?                        "Tudo o que está no Free, mais:"
 *  - features                         string[]
 *  - cta, onCta, ctaVariant           "primary" (lime) | "ghost"
 *  - current, onManage                already on this plan: shows "Current plan" + "Manage subscription" instead of a purchase CTA
 *  - highlighted
 *  - children                         extra block between CTA and the feature list
 *  - body                             replaces/extends the plain feature list (Player+ pillars)
 *  - footer                           extra block under the CTA
 */
export default function PricingPlanCard({ id, name, tag, badge, subtitle, price, unit, priceNote, inherits, features, cta, onCta, ctaVariant = "ghost", highlighted = false, current = false, onManage, children, footer, body }) {
  const Btn = ctaVariant === "primary" ? BtnPrimary : BtnGhost;
  return (
    <article data-plan={id} aria-label={t(name)} style={{
      ...cardStyle, position: "relative", display: "flex", flexDirection: "column", padding: S.xl,
      background: highlighted ? C.accentDim : C.card,
      border: `${highlighted ? 2 : 1}px solid ${highlighted ? C.accent : C.border}`,
    }}>
      {badge && (
        <span style={{ position: "absolute", top: -12, left: S.xl, background: C.accent, color: C.bg, fontSize: T.min, fontWeight: 900, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: R.pill }}>
          {t(badge)}
        </span>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, marginBottom: S.xs }}>
        <h3 style={{ ...displayFont, fontSize: T.h + 4, margin: 0 }}>{t(name)}</h3>
        {tag && <span style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t(tag)}</span>}
      </div>
      <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.4, minHeight: 40 }}>{t(subtitle)}</div>

      <div style={{ margin: `${S.lg}px 0 ${S.xs}px`, display: "flex", alignItems: "baseline", gap: S.sm, flexWrap: "wrap" }}>
        <span style={{ ...displayFont, fontSize: 44, lineHeight: 1, color: highlighted ? C.accent : C.text1 }}>{price}</span>
        {unit && <span style={{ fontSize: T.body, color: C.text2, fontWeight: 600 }}>{t(unit)}</span>}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, minHeight: 18, marginBottom: S.lg, lineHeight: 1.4 }}>{priceNote}</div>

      {current ? (
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <div role="status" style={{ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm, border: `1px solid ${C.greenBorder}`, background: C.greenDim, color: C.green, borderRadius: R.control, fontSize: T.body, fontWeight: 800 }}>
            <Check size={16} strokeWidth={3} aria-hidden /> {t(PAGE.currentPlan)}
          </div>
          {onManage && <BtnGhost block onClick={onManage}>{t(PAGE.manageSub)}</BtnGhost>}
        </div>
      ) : (
        <Btn block onClick={onCta}>{t(cta)}</Btn>
      )}
      {footer}

      {children}

      <div style={{ height: 1, background: C.border, margin: `${S.xl}px 0 ${S.lg}px` }} />
      {inherits && <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text1, marginBottom: S.md }}>{t(inherits)}</div>}
      {features.length > 0 && <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.sm + 2 }}>
        {features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: S.sm, fontSize: T.body, color: C.text1, lineHeight: 1.35 }}>
            <Check size={16} color={C.accent} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            <span>{t(f)}</span>
          </li>
        ))}
      </ul>}
      {body}
    </article>
  );
}
