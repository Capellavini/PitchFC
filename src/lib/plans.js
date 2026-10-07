// Plan catalogue + pricing for the /pricing page and the contextual upgrade
// modal. ONE central configuration: no price, currency or Stripe id is ever
// written in a component.
//
// Plans are identified by STABLE ids — never by price. Two commercial
// markets, each with its OWN price list (Brazil is localized pricing, never
// EUR × an exchange rate). The market is a commercial/app setting, not a tax
// residency determination.
//
// There is NO billing backend yet: startCheckout() is the single seam every
// CTA goes through and today it charges nothing. Subscription billing (Club,
// Club + AI, Player+) is a separate flow from game payments between players.

export const PLAN_IDS = Object.freeze(["free", "club", "club_ai", "player_plus"]);
export const GROUP_PLAN_IDS = Object.freeze(["free", "club", "club_ai"]);
export const BILLING_PERIODS = Object.freeze(["monthly", "annual"]);
/** standard = up to 30 active players; large = 31–60. Above 60 → "talk to us". */
export const GROUP_SIZES = Object.freeze(["standard", "large"]);
export const MARKETS = Object.freeze({
  EU: Object.freeze({ id: "EU", currency: "EUR", symbol: "€" }),
  BR: Object.freeze({ id: "BR", currency: "BRL", symbol: "R$" }),
});
export const MARKET_IDS = Object.freeze(Object.keys(MARKETS));

// "Active player" (the unit of the group-size bands) has no backend
// definition yet — these are only the band limits the UI displays.
export const GROUP_PLAYER_LIMITS = Object.freeze({ free: 20, standard: 30, large: 60 });

const addon = (monthly) => Object.freeze({ monthly, annual: monthly * 10 }); // same "pay 10, get 12" rule as the base plans

/** The single source of truth for what things cost. */
export const PRICING = Object.freeze({
  EU: Object.freeze({
    currency: "EUR",
    free: { monthly: 0, annual: 0 },
    club: { monthly: 7.99, annual: 79 },
    club_ai: { monthly: 10.99, annual: 109 },
    player_plus: { monthly: 2.99, annual: 29 },
    largeGroupAddon: addon(5),
  }),
  BR: Object.freeze({
    currency: "BRL",
    free: { monthly: 0, annual: 0 },
    club: { monthly: 24.9, annual: 249 },
    club_ai: { monthly: 34.9, annual: 349 },
    player_plus: { monthly: 9.9, annual: 99 },
    largeGroupAddon: addon(15),
  }),
});

/** Optional, temporary pricing campaigns. Everything here is OFF unless
 *  switched on by configuration — never part of the permanent price list. */
export const CAMPAIGNS = Object.freeze({
  founding_club_br: Object.freeze({
    id: "founding_club_br",
    market: "BR",
    planId: "club",
    billing: "monthly",
    monthly: 19.9,
    lockMonths: 12,
    // Build-time switch (VITE_FOUNDING_CLUB_BR=true); flip here to hard-enable.
    enabled: import.meta.env?.VITE_FOUNDING_CLUB_BR === "true",
  }),
});

export const isGroupPlan = (id) => GROUP_PLAN_IDS.includes(id);
export const isPaidPlan = (id) => id !== "free" && PLAN_IDS.includes(id);

/** Price for a plan in a market's own currency. `size` only matters for
 *  paid group plans (Club / Club + AI). */
export function planPrice(planId, billing = "monthly", size = "standard", market = "EU") {
  const book = PRICING[market];
  const base = book?.[planId]?.[billing];
  if (base == null) throw new Error(`Unknown plan/billing/market: ${planId}/${billing}/${market}`);
  const large = size === "large" && (planId === "club" || planId === "club_ai");
  return +(base + (large ? book.largeGroupAddon[billing] : 0)).toFixed(2);
}

/** What a large group adds per period, in the market's currency. */
export const largeGroupAddon = (billing = "monthly", market = "EU") => PRICING[market].largeGroupAddon[billing];

/** Months of the year you don't pay for on the annual plan (≈ 2). */
export function annualSavingMonths(planId, size = "standard", market = "EU") {
  const monthly = planPrice(planId, "monthly", size, market);
  if (!monthly) return 0;
  return Math.round(12 - planPrice(planId, "annual", size, market) / monthly);
}

/** The active campaign for this plan/market/billing/size, or null. */
export function activeCampaign(market, planId, billing = "monthly", size = "standard", campaigns = CAMPAIGNS) {
  if (size !== "standard") return null;
  return Object.values(campaigns).find((c) => c.enabled && c.market === market && c.planId === planId && c.billing === billing) ?? null;
}

/** Locale-appropriate money: BRL is always "R$ 24,90" (pt-BR convention);
 *  EUR follows the UI language ("€7,99" in Portuguese, "€7.99" in English).
 *  Whole amounts drop the decimals ("€79", "R$ 249"). */
export function fmtMoney(amount, market = "EU", lang = "pt") {
  const whole = Number.isInteger(amount);
  if (market === "BR") {
    const n = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
    return `R$ ${n}`.replace(/ /g, " ");
  }
  const body = whole ? String(amount) : amount.toFixed(2);
  return `€${lang === "en" ? body : body.replace(".", ",")}`;
}

/** Default commercial market from what the app already knows: the UI
 *  locale (PT-BR → Brazil, everything else → Europe). No geo-detection. */
export const marketFromLang = (lang) => (lang === "pt-br" ? "BR" : "EU");

// ── Billing configuration (Stripe) ─────────────────────────
// Price ids are filled in when the Stripe products exist, and live ONLY here
// (never in a component). Secret keys never live in the client at all.
export const STRIPE_PRICE_IDS = Object.freeze({
  EU: { club: { monthly: null, annual: null }, club_ai: { monthly: null, annual: null }, player_plus: { monthly: null, annual: null }, largeGroupAddon: { monthly: null, annual: null } },
  BR: { club: { monthly: null, annual: null }, club_ai: { monthly: null, annual: null }, player_plus: { monthly: null, annual: null }, largeGroupAddon: { monthly: null, annual: null } },
});

// Flip to true ONLY when a real checkout exists behind startCheckout().
export const BILLING_ENABLED = false;

/**
 * The one entry point every upgrade CTA goes through.
 *   startCheckout({ planId, billingPeriod, market, groupId?, groupSize? })
 *     → { ok: true, url }                       (later: redirect to Stripe Checkout)
 *     → { ok: false, reason: "billing_unavailable" | "invalid_plan" | "group_required" }
 * Today billing is off: nothing is charged and no network call is made.
 */
export async function startCheckout({ planId, billingPeriod = "monthly", market = "EU", groupId = null, groupSize = "standard" } = {}) {
  if (!isPaidPlan(planId) || !BILLING_PERIODS.includes(billingPeriod) || !GROUP_SIZES.includes(groupSize) || !MARKETS[market]) {
    return { ok: false, reason: "invalid_plan" };
  }
  if (isGroupPlan(planId) && !groupId) return { ok: false, reason: "group_required" };
  if (!BILLING_ENABLED) return { ok: false, reason: "billing_unavailable" };
  // TODO(billing): look up STRIPE_PRICE_IDS[market][planId][billingPeriod] (+ the
  // large-group add-on) and POST to a Supabase Edge Function that creates the
  // Checkout Session; return its url.
  return { ok: false, reason: "billing_unavailable" };
}

/** "Manage subscription" (customer portal) — same seam, same story. */
export async function manageSubscription() {
  return { ok: false, reason: "billing_unavailable" };
}
