import { Crown, Lock, Check, Bot, Sparkles, Users, Trophy, CreditCard } from "lucide-react";
import { C, S, T, TOUCH, cardStyle } from "../theme";
import { t, getLang } from "../lib/i18n";
import { can, planBadge, planChipText, planChipBody, DEMO_PLANS } from "../lib/entitlements";
import { PLAN_STATUS, GATE } from "../lib/pricingCopy";
import Chip from "./Chip";
import SectionLabel from "./SectionLabel";
import BtnGhost from "./BtnGhost";
import ListRow from "./ListRow";
import SegmentedControl from "./SegmentedControl";

// What an organizer most wants to know is in (or not in) their plan.
const ROWS = [
  { feature: "bot_automation", Icon: Bot },
  { feature: "payment_reminders", Icon: CreditCard },
  { feature: "co_organizers", Icon: Users },
  { feature: "fantasy", Icon: Trophy },
  { feature: "adjunto", Icon: Sparkles },
];

/**
 * Group page → Definições: the group's plan, for organizers only.
 * "Fundador · Club + AI até 31 dez" / "Club + AI grátis para sempre" /
 * "Teste do Club · faltam N dias" / "Free" + "Ver planos", then the Club
 * features with a check (included) or a lock — a locked row opens the
 * soft paywall (onGate) explaining it. Nothing here charges anything.
 *
 * Props: ent (effective entitlement, null while loading → renders nothing),
 *   onSeePlans, onGate(feature), demoPlan + onDemoPlan (local demo only).
 */
export default function PlanCard({ ent, onSeePlans, onGate, demoPlan, onDemoPlan }) {
  if (!ent) return null;
  const badge = planBadge(ent);
  const paid = badge.plan !== "free";
  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t(PLAN_STATUS.label)}</SectionLabel>
      <div style={{ ...cardStyle, padding: `${S.lg}px ${S.lg}px ${S.md}px` }}>
        <Chip variant={paid ? "lime" : "neutral"} Icon={paid ? Crown : undefined}>{planChipText(ent, PLAN_STATUS, t, getLang())}</Chip>
        <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45, margin: `${S.sm}px 0 ${S.md}px` }}>{planChipBody(ent, PLAN_STATUS, t)}</div>

        <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text3, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t(PLAN_STATUS.inYourPlan)}</div>
        {ROWS.map(({ feature, Icon }, i) => {
          const on = can(feature, ent);
          const lock = (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: TOUCH.min, height: TOUCH.min, marginRight: -12 }}>
              {on ? <Check size={18} color={C.green} strokeWidth={3} aria-label={t(PLAN_STATUS.included)} /> : <Lock size={16} color={C.text3} aria-hidden />}
            </span>
          );
          return (
            <ListRow key={feature} divider={i > 0} leading={<Icon size={20} color={on ? C.text2 : C.text3} />}
              title={t(GATE[feature].title)} right={lock}
              onClick={on ? undefined : () => onGate?.(feature)} chevron={false} />
          );
        })}

        <BtnGhost block onClick={onSeePlans} style={{ marginTop: S.md }}>{t(PLAN_STATUS.seePlans)}</BtnGhost>

        {onDemoPlan && (
          <div style={{ marginTop: S.lg, paddingTop: S.md, borderTop: `1px dashed ${C.border}` }}>
            <div style={{ fontSize: T.min, color: C.text3, fontWeight: 700, marginBottom: S.sm }}>{t(PLAN_STATUS.demoLabel)}</div>
            <SegmentedControl style={{ marginBottom: 0 }} value={demoPlan} onChange={onDemoPlan}
              options={DEMO_PLANS.map((id) => ({ id, label: PLAN_STATUS.demoPlans[id] }))} />
          </div>
        )}
      </div>
    </div>
  );
}
