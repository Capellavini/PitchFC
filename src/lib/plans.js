// Plan catalogue + pricing maths for the /pricing page (and the contextual
// upgrade modal). Plans are identified by STABLE ids — prices are data, never
// identifiers — so changing a price never touches anything that stores or
// compares a plan.
//
// There is NO billing backend yet: startCheckout() is the single seam the
// CTAs call, and today it deliberately charges nothing (see below). Connect
// Stripe by replacing its body with a call to a Supabase Edge Function that
// creates a Checkout Session — secret keys must never live in the client.

export const PLAN_IDS = Object.freeze(["free", "club", "club_ai", "player_plus"]);
export const GROUP_PLAN_IDS = Object.freeze(["free", "club", "club_ai"]);
export const BILLING_PERIODS = Object.freeze(["monthly", "annual"]);
/** standard = up to 30 active players; large = 31–60. Above 60 → "talk to us". */
export const GROUP_SIZES = Object.freeze(["standard", "large"]);

export const GROUP_PLAYER_LIMITS = Object.freeze({ free: 20, standard: 30, large: 60 });

// EUR, launch pricing. Same prices everywhere for now (no country pricing).
const PRICES = Object.freeze({
  free: { monthly: 0, annual: 0 },
  club: { monthly: 7.99, annual: 79 },
  club_ai: { monthly: 10.99, annual: 109 },
  player_plus: { monthly: 2.99, annual: 29 },
});

// Large groups (31–60 active players) pay +€5/month. The annual surcharge
// follows the same "pay 10 months, get 12" rule as the base plans (5 × 10).
const LARGE_SURCHARGE = Object.freeze({ monthly: 5, annual: 50 });

export const isGroupPlan = (id) => GROUP_PLAN_IDS.includes(id);
export const isPaidPlan = (id) => id !== "free" && PLAN_IDS.includes(id);

/** Price in EUR for a plan. `size` only matters for paid group plans. */
export function planPrice(planId, billing = "monthly", size = "standard") {
  const base = PRICES[planId]?.[billing];
  if (base == null) throw new Error(`Unknown plan/billing: ${planId}/${billing}`);
  const large = size === "large" && (planId === "club" || planId === "club_ai");
  return +(base + (large ? LARGE_SURCHARGE[billing] : 0)).toFixed(2);
}

/** Months of the year you don't pay for on the annual plan (≈ 2). */
export function annualSavingMonths(planId, size = "standard") {
  const monthly = planPrice(planId, "monthly", size);
  if (!monthly) return 0;
  return Math.round(12 - planPrice(planId, "annual", size) / monthly);
}

/** "€7.99" (en) / "€7,99" (pt); whole amounts drop the decimals ("€79"). */
export function fmtPlanPrice(amount, lang = "pt") {
  const body = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `€${lang === "en" ? body : body.replace(".", ",")}`;
}

/** The extra a large group pays per period, for display ("+€5"). */
export const largeSurcharge = (billing = "monthly") => LARGE_SURCHARGE[billing];

// Flip to true ONLY when a real checkout exists behind startCheckout().
export const BILLING_ENABLED = false;

/**
 * The one entry point every upgrade CTA goes through.
 *   startCheckout({ planId, billing, groupId?, groupSize? })
 *     → { ok: true, url }                    (later: redirect to Stripe Checkout)
 *     → { ok: false, reason: "billing_unavailable" | "invalid_plan" | "group_required" }
 * Today billing is off, so nothing is charged and no network call is made.
 */
export async function startCheckout({ planId, billing = "monthly", groupId = null, groupSize = "standard" } = {}) {
  if (!isPaidPlan(planId) || !BILLING_PERIODS.includes(billing) || !GROUP_SIZES.includes(groupSize)) {
    return { ok: false, reason: "invalid_plan" };
  }
  if (isGroupPlan(planId) && !groupId) return { ok: false, reason: "group_required" };
  if (!BILLING_ENABLED) return { ok: false, reason: "billing_unavailable" };
  // TODO(billing): POST to a Supabase Edge Function that creates a Stripe
  // Checkout Session for { planId, billing, groupId, groupSize } and return its url.
  return { ok: false, reason: "billing_unavailable" };
}
