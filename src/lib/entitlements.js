// App-side entitlements: the pure core (src/lib/core/entitlements.js, shared
// with the wa-bot) + the bits only the app needs — organizer-facing text,
// the local-demo simulated plan and the "avisa-me" lead payload.
// Copy lives in pricingCopy.js (PLAN_STATUS, GATE); this file only fills
// placeholders, so it stays testable without a DOM.
export * from "./core/entitlements.js";
import { effectivePlan, planBadge, requiredPlan } from "./core/entitlements.js";

const PLAN_NAMES = { free: "Free", club: "Club", club_ai: "Club + AI" };
export const planName = (plan) => PLAN_NAMES[plan] ?? "Free";

const MONTHS = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
/** "31 dez" / "31 Dec" in Lisbon time (founder grants end 23:59 Lisbon). */
export function shortDate(iso, lang = "pt") {
  if (!iso) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", day: "numeric", month: "numeric" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${Number(parts.day)} ${(MONTHS[lang === "en" ? "en" : "pt"])[Number(parts.month) - 1]}`;
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

/**
 * Chip text for the organizer. `tr` = the i18n t() (identity in tests),
 * `copy` = PLAN_STATUS from pricingCopy.js.
 *   "Fundador · Club + AI até 31 dez" · "Club + AI grátis para sempre"
 *   "Teste do Club · faltam 9 dias"   · "Free"
 */
export function planChipText(ent, copy, tr = (s) => s, lang = "pt") {
  const b = planBadge(ent);
  const plan = planName(b.plan);
  switch (b.kind) {
    case "forever": return fill(tr(copy.forever), { plan });
    case "founder": return fill(tr(copy.founder), { plan, date: shortDate(b.endsAt, lang) });
    case "trial":
      if (b.daysLeft == null || b.daysLeft > 1) return fill(tr(copy.trial), { n: b.daysLeft ?? "" });
      return tr(b.daysLeft === 1 ? copy.trialOne : copy.trialLast);
    case "paid": return b.endsAt ? fill(tr(copy.paidUntil), { plan, date: shortDate(b.endsAt, lang) }) : fill(tr(copy.paid), { plan });
    default: return tr(copy.free);
  }
}

/** One-line explanation under the chip. */
export function planChipBody(ent, copy, tr = (s) => s) {
  const b = planBadge(ent);
  return tr({ forever: copy.foreverBody, founder: copy.founderBody, trial: copy.trialBody, paid: copy.trialBody }[b.kind]
    ?? (b.expired ? copy.expiredBody : copy.freeBody));
}

/** Trial-ending banner text (≤ 3 days). */
export function trialBannerText(ent, copy, tr = (s) => s) {
  const d = planBadge(ent).daysLeft ?? 0;
  return d <= 0 ? tr(copy.trialBannerToday) : fill(tr(copy.trialBanner), { n: d });
}

/** Free-group soft-cap banner text. */
export const capBannerText = (count, copy, tr = (s) => s) => fill(tr(copy.capBanner), { n: count });

/** Dismiss key for the one-time trial banner: per group + trial end DAY
 *  (day, not instant, so a re-granted trial re-shows it but a re-render never does). */
export const trialBannerKey = (groupId, ent) => `${groupId ?? "local"}:${(ent?.endsAt ?? "").slice(0, 10)}`;

// ── Local demo mode: a simulated plan ─────────────────────
// Default: Club trial with DEMO_TRIAL_DAYS left (VITE_DEMO_TRIAL_DAYS, else 10).
// Switch with ?demoPlan=free | trial | trial:2 | founder | forever | club | club_ai
// (persisted by the hook) or the "Simular plano (demo)" control.
export const DEMO_TRIAL_DAYS = Number(import.meta.env?.VITE_DEMO_TRIAL_DAYS) || 10;
export const DEMO_PLANS = Object.freeze(["trial", "free", "founder", "forever", "club_ai"]);

/** "trial:3" → { id: "trial", days: 3 }; anything unknown → null. */
export function parseDemoPlan(value) {
  const [id, n] = String(value ?? "").trim().toLowerCase().split(":");
  const known = ["free", "trial", "founder", "forever", "club", "club_ai"];
  if (!known.includes(id)) return null;
  const days = Number.parseInt(n, 10);
  return { id, days: Number.isFinite(days) && days >= 0 ? days : null };
}

/** Simulated group_plans row for a demo plan id, relative to `now`. */
export function demoPlanRow(demo, now = new Date(), trialDays = DEMO_TRIAL_DAYS) {
  const d = typeof demo === "string" ? parseDemoPlan(demo) : demo;
  switch (d?.id) {
    case "free": return { plan: "free", status: "active", source: "manual", ends_at: null };
    case "founder": return { plan: "club_ai", status: "active", source: "founder", ends_at: "2026-12-31T23:59:00Z" };
    case "forever": return { plan: "club_ai", status: "active", source: "founder_forever", ends_at: null };
    case "club": return { plan: "club", status: "active", source: "manual", ends_at: null };
    case "club_ai": return { plan: "club_ai", status: "active", source: "manual", ends_at: null };
    default: {
      const days = d?.days ?? trialDays;
      // A whisker under N days so ceil() shows N, not N+1.
      return { plan: "club", status: "trialing", source: "trial", ends_at: new Date(now.getTime() + days * 864e5 - 6e4).toISOString() };
    }
  }
}
export const demoEntitlement = (demo, now = new Date(), trialDays) => effectivePlan(demoPlanRow(demo, now, trialDays), now);

/** submit_lead() payload for "Avisa-me" on the upgrade prompt. Only keys
 *  submit_lead understands (see 20260101001100_leads.sql). */
export function upgradeInterestPayload({ feature = null, planId = null, groupId = null, groupName = "", name = "", email = "" } = {}) {
  const plan = planId ?? (feature ? requiredPlan(feature) : null);
  return {
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    role: "Organizador",
    team_name: String(groupName || "").trim(),
    interest: [plan ? `upgrade:${plan}` : "upgrade"],
    message: [`group:${groupId ?? "-"}`, `feature:${feature ?? "-"}`, `plan:${plan ?? "-"}`].join(" "),
    source: "upgrade_interest",
  };
}
