import test from "node:test";
import assert from "node:assert/strict";
import { planPrice, annualSavingMonths, fmtPlanPrice, startCheckout, isPaidPlan, isGroupPlan, PLAN_IDS } from "./plans.js";

test("base prices (EUR)", () => {
  assert.equal(planPrice("free"), 0);
  assert.equal(planPrice("club", "monthly"), 7.99);
  assert.equal(planPrice("club", "annual"), 79);
  assert.equal(planPrice("club_ai", "monthly"), 10.99);
  assert.equal(planPrice("club_ai", "annual"), 109);
  assert.equal(planPrice("player_plus", "monthly"), 2.99);
  assert.equal(planPrice("player_plus", "annual"), 29);
});

test("large groups pay +€5/month on Club and Club + AI only", () => {
  assert.equal(planPrice("club", "monthly", "large"), 12.99);
  assert.equal(planPrice("club_ai", "monthly", "large"), 15.99);
  assert.equal(planPrice("free", "monthly", "large"), 0);
  assert.equal(planPrice("player_plus", "monthly", "large"), 2.99);
});

test("annual saves roughly two months", () => {
  assert.equal(annualSavingMonths("club"), 2);
  assert.equal(annualSavingMonths("club_ai"), 2);
  assert.equal(annualSavingMonths("player_plus"), 2);
  assert.equal(annualSavingMonths("free"), 0);
  assert.equal(annualSavingMonths("club", "large"), 2);
});

test("price formatting follows the language", () => {
  assert.equal(fmtPlanPrice(7.99, "en"), "€7.99");
  assert.equal(fmtPlanPrice(7.99, "pt"), "€7,99");
  assert.equal(fmtPlanPrice(79, "pt"), "€79");
  assert.equal(fmtPlanPrice(0, "en"), "€0");
});

test("plan ids are stable, never prices", () => {
  assert.deepEqual([...PLAN_IDS], ["free", "club", "club_ai", "player_plus"]);
  assert.ok(isPaidPlan("club") && !isPaidPlan("free"));
  assert.ok(isGroupPlan("club_ai") && !isGroupPlan("player_plus"));
});

test("startCheckout never charges while billing is off", async () => {
  assert.deepEqual(await startCheckout({ planId: "club", billing: "monthly", groupId: "g1" }), { ok: false, reason: "billing_unavailable" });
  assert.deepEqual(await startCheckout({ planId: "player_plus", billing: "annual" }), { ok: false, reason: "billing_unavailable" });
  assert.deepEqual(await startCheckout({ planId: "club" }), { ok: false, reason: "group_required" });
  assert.deepEqual(await startCheckout({ planId: "nope" }), { ok: false, reason: "invalid_plan" });
  assert.deepEqual(await startCheckout({ planId: "free" }), { ok: false, reason: "invalid_plan" });
});
