import { ArrowRight, ArrowDown, User, Wallet, Building2 } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { PAYMENTS } from "../lib/pricingCopy";
import Chip from "./Chip";

function Node({ Icon, label, strong = false }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs + 2, padding: `${S.md}px ${S.sm}px`, background: strong ? C.accentDim : C.surface, border: `1px solid ${strong ? C.accentBorder : C.border}`, borderRadius: R.control }}>
      <Icon size={20} color={strong ? C.accent : C.text2} aria-hidden />
      <span style={{ fontSize: T.meta, fontWeight: 800, color: strong ? C.accent : C.text1, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

/** "Payments without the spreadsheet" — Player → Pitch → Organizer/Venue.
 *  Marked "coming soon": payments aren't live, so no fee is promised. */
export default function PricingPayments() {
  return (
    <section aria-labelledby="pr-payments" style={{ ...cardStyle, padding: S.xl }}>
      <div style={{ marginBottom: S.md }}><Chip variant="orange">{t(PAYMENTS.soon)}</Chip></div>
      <h2 id="pr-payments" style={{ ...displayFont, fontSize: "clamp(22px, 4vw, 30px)", margin: `0 0 ${S.lg}px` }}>{t(PAYMENTS.title)}</h2>

      <div className="pr-flow" aria-hidden>
        <Node Icon={User} label={t(PAYMENTS.player)} />
        <ArrowRight className="pr-arrow-h" size={18} color={C.text3} />
        <ArrowDown className="pr-arrow-v" size={18} color={C.text3} />
        <Node Icon={Wallet} label={t(PAYMENTS.pitch)} strong />
        <ArrowRight className="pr-arrow-h" size={18} color={C.text3} />
        <ArrowDown className="pr-arrow-v" size={18} color={C.text3} />
        <Node Icon={Building2} label={t(PAYMENTS.organizer)} />
      </div>

      <p style={{ fontSize: T.body, color: C.text1, lineHeight: 1.55, margin: `${S.lg}px 0 ${S.sm}px` }}>{t(PAYMENTS.body1)}</p>
      <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.55, margin: `0 0 ${S.sm}px` }}>{t(PAYMENTS.body2)}</p>
      <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.55, margin: `0 0 ${S.md}px` }}>{t(PAYMENTS.body3)}</p>
      <p style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, margin: 0, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>{t(PAYMENTS.fees)}</p>
    </section>
  );
}
