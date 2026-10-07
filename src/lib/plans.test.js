import test from "node:test";
import assert from "node:assert/strict";
import {
  planPrice, annualSavingMonths, fmtMoney, startCheckout, manageSubscription, isPaidPlan, isGroupPlan,
  activeCampaign, marketFromLang, largeGroupAddon, PLAN_IDS, PRICING, CAMPAIGNS, MARKETS,
} from "./plans.js";

test("Europe prices (EUR)", () => {
  assert.equal(planPrice("free"), 0);
  assert.equal(planPrice("club", "monthly", "standard", "EU"), 7.99);
  assert.equal(planPrice("club", "annual", "standard", "EU"), 79);
  assert.equal(planPrice("club_ai", "monthly", "standard", "EU"), 10.99);
  assert.equal(planPrice("club_ai", "annual", "standard", "EU"), 109);
  assert.equal(planPrice("player_plus", "monthly", "standard", "EU"), 2.99);
  assert.equal(planPrice("player_plus", "annual", "standard", "EU"), 29);
});

test("Brazil has its own price list (BRL), not a conversion", () => {
  assert.equal(planPrice("free", "monthly", "standard", "BR"), 0);
  assert.equal(planPrice("club", "monthly", "standard", "BR"), 24.9);
  assert.equal(planPrice("club", "annual", "standard", "BR"), 249);
  assert.equal(planPrice("club_ai", "monthly", "standard", "BR"), 34.9);
  assert.equal(planPrice("club_ai", "annual", "standard", "BR"), 349);
  assert.equal(planPrice("player_plus", "monthly", "standard", "BR"), 9.9);
  assert.equal(planPrice("player_plus", "annual", "standard", "BR"), 99);
  assert.equal(PRICING.BR.currency, "BRL");
  assert.equal(PRICING.EU.currency, "EUR");
  // No implied FX rate: 24.90 / 7.99 is not a "rate" anything in the code uses.
  assert.ok(!Object.keys(PRICING.BR).some((k) => /fx|rate|convert/i.test(k)));
});

test("large groups pay the market's add-on on Club and Club + AI only", () => {
  assert.equal(planPrice("club", "monthly", "large", "EU"), 12.99);
  assert.equal(planPrice("club_ai", "monthly", "large", "EU"), 15.99);
  assert.equal(planPrice("club", "monthly", "large", "BR"), 39.9);
  assert.equal(planPrice("club_ai", "monthly", "large", "BR"), 49.9);
  assert.equal(planPrice("free", "monthly", "large", "BR"), 0);
  assert.equal(planPrice("player_plus", "monthly", "large", "BR"), 9.9);
  assert.equal(largeGroupAddon("monthly", "EU"), 5);
  assert.equal(largeGroupAddon("monthly", "BR"), 15);
});

test("annual saves roughly two months in both markets", () => {
  for (const market of ["EU", "BR"]) {
    for (const id of ["club", "club_ai", "player_plus"]) assert.equal(annualSavingMonths(id, "standard", market), 2, `${market}/${id}`);
    assert.equal(annualSavingMonths("club", "large", market), 2, `${market}/club large`);
    assert.equal(annualSavingMonths("free", "standard", market), 0);
  }
});

test("money formatting follows the market and language", () => {
  assert.equal(fmtMoney(7.99, "EU", "en"), "€7.99");
  assert.equal(fmtMoney(7.99, "EU", "pt"), "€7,99");
  assert.equal(fmtMoney(79, "EU", "pt"), "€79");
  assert.equal(fmtMoney(0, "EU", "en"), "€0");
  assert.equal(fmtMoney(24.9, "BR", "pt-br"), "R$ 24,90");
  assert.equal(fmtMoney(24.9, "BR", "en"), "R$ 24,90");
  assert.equal(fmtMoney(249, "BR", "pt"), "R$ 249");
  assert.equal(fmtMoney(0, "BR", "pt"), "R$ 0");
});

test("default market comes from the UI locale", () => {
  assert.equal(marketFromLang("pt-br"), "BR");
  assert.equal(marketFromLang("pt"), "EU");
  assert.equal(marketFromLang("en"), "EU");
});

test("Founding Club (Brazil) exists but is OFF by default and only applies to standard monthly Club", () => {
  assert.equal(CAMPAIGNS.founding_club_br.enabled, false);
  assert.equal(activeCampaign("BR", "club", "monthly"), null);
  const on = { founding: { ...CAMPAIGNS.founding_club_br, enabled: true } };
  assert.equal(activeCampaign("BR", "club", "monthly", "standard", on).monthly, 19.9);
  assert.equal(activeCampaign("BR", "club", "monthly", "standard", on).lockMonths, 12);
  assert.equal(activeCampaign("EU", "club", "monthly", "standard", on), null);
  assert.equal(activeCampaign("BR", "club_ai", "monthly", "standard", on), null);
  assert.equal(activeCampaign("BR", "club", "annual", "standard", on), null);
  assert.equal(activeCampaign("BR", "club", "monthly", "large", on), null);
});

test("plan ids are stable, never prices", () => {
  assert.deepEqual([...PLAN_IDS], ["free", "club", "club_ai", "player_plus"]);
  assert.ok(isPaidPlan("club") && !isPaidPlan("free"));
  assert.ok(isGroupPlan("club_ai") && !isGroupPlan("player_plus"));
  assert.deepEqual(Object.keys(MARKETS), ["EU", "BR"]);
});

test("startCheckout never charges while billing is off", async () => {
  const off = { ok: false, reason: "billing_unavailable" };
  assert.deepEqual(await startCheckout({ planId: "club", billingPeriod: "monthly", market: "BR", groupId: "g1" }), off);
  assert.deepEqual(await startCheckout({ planId: "player_plus", billingPeriod: "annual", market: "EU" }), off);
  assert.deepEqual(await startCheckout({ planId: "club", market: "EU" }), { ok: false, reason: "group_required" });
  assert.deepEqual(await startCheckout({ planId: "nope" }), { ok: false, reason: "invalid_plan" });
  assert.deepEqual(await startCheckout({ planId: "free" }), { ok: false, reason: "invalid_plan" });
  assert.deepEqual(await startCheckout({ planId: "club", market: "US", groupId: "g" }), { ok: false, reason: "invalid_plan" });
  assert.deepEqual(await manageSubscription(), off);
});
