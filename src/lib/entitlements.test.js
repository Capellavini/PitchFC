import test from "node:test";
import assert from "node:assert/strict";
import {
  FEATURES, PLAN_RANK, effectivePlan, can, requiredPlan, playerLimit, overSoftCap, botKindAllowed, planBadge, trialEndingSoon, planOf,
  planChipText, planChipBody, trialBannerText, capBannerText, shortDate, parseDemoPlan, demoPlanRow, demoEntitlement, upgradeInterestPayload,
} from "./entitlements.js";
import { PLAN_STATUS } from "./pricingCopy.js";

const NOW = new Date("2026-10-19T10:00:00Z");
const days = (n) => new Date(NOW.getTime() + n * 864e5).toISOString();

test("approved matrix: Club features, Club + AI only for the Adjunto", () => {
  for (const f of ["co_organizers", "fantasy", "payment_reminders", "payment_history", "mbway_button", "bot_automation", "advanced_stats", "unlimited_history", "large_group"]) {
    assert.equal(FEATURES[f], "club", f);
  }
  assert.equal(FEATURES.adjunto, "club_ai");
  // Free things are simply not in the map (and therefore never gated).
  for (const f of ["slot_grid", "confirm", "waitlist", "team_draw", "matchday", "mvp", "rankings", "season_stats", "goal_of_week", "var", "teams", "leagues"]) {
    assert.equal(requiredPlan(f), "free", f);
    assert.ok(can(f, "free"), f);
  }
});

test("can(): plan ranks are cumulative", () => {
  assert.ok(!can("fantasy", "free"));
  assert.ok(can("fantasy", "club"));
  assert.ok(can("fantasy", "club_ai"));
  assert.ok(!can("adjunto", "club"));
  assert.ok(can("adjunto", "club_ai"));
  assert.ok(can("adjunto", { plan: "club_ai" }));
  assert.ok(!can("fantasy", null), "no entitlement ⇒ free");
  assert.ok(!can("fantasy", { plan: "gold" }), "unknown plan ⇒ free");
  assert.deepEqual(Object.keys(PLAN_RANK), ["free", "club", "club_ai"]);
  assert.equal(planOf("toString"), "free");
});

test("effectivePlan: no row / canceled / expired ⇒ free; past_due keeps the plan", () => {
  assert.equal(effectivePlan(null, NOW).plan, "free");
  assert.equal(effectivePlan({ plan: "club", status: "canceled", ends_at: null }, NOW).plan, "free");
  const exp = effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(-0.01) }, NOW);
  assert.deepEqual([exp.plan, exp.status, exp.expired, exp.daysLeft, exp.storedPlan], ["free", "expired", true, null, "club"]);
  assert.equal(effectivePlan({ plan: "club_ai", status: "past_due", ends_at: null }, NOW).plan, "club_ai");
  const trial = effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(13.5) }, NOW);
  assert.deepEqual([trial.plan, trial.status, trial.daysLeft], ["club", "trialing", 14]);
  // RPC shape (group_entitlement) passes through too.
  const rpc = effectivePlan({ plan: "free", status: "expired", source: "trial", ends_at: days(-2), stored_plan: "club" }, NOW);
  assert.equal(rpc.plan, "free");
});

test("player limits are soft and plan-based", () => {
  assert.equal(playerLimit("free"), 20);
  assert.equal(playerLimit({ plan: "club" }), 30);
  assert.ok(overSoftCap(21, "free"));
  assert.ok(!overSoftCap(20, "free"));
  assert.ok(!overSoftCap(40, "club"));
});

test("bot: Free groups only get game_open + cancelled", () => {
  for (const k of ["reminder", "matchday", "milestone", "promoted", "spot_opened", "postgame", "match_awards"]) {
    assert.ok(!botKindAllowed(k, "free"), k);
    assert.ok(botKindAllowed(k, "club"), k);
  }
  assert.ok(botKindAllowed("game_open", "free"));
  assert.ok(botKindAllowed("cancelled", "free"));
});

test("planBadge + chip text for every launch case", () => {
  const founder = effectivePlan({ plan: "club_ai", status: "active", source: "founder", ends_at: "2026-12-31T23:59:00Z" }, NOW);
  assert.equal(planBadge(founder).kind, "founder");
  assert.equal(planChipText(founder, PLAN_STATUS), "Fundador · Club + AI até 31 dez");
  assert.equal(planChipText(founder, PLAN_STATUS, (s) => s, "en"), "Fundador · Club + AI até 31 Dec"); // tr is identity here
  const forever = effectivePlan({ plan: "club_ai", status: "active", source: "founder_forever", ends_at: null }, NOW);
  assert.equal(planChipText(forever, PLAN_STATUS), "Club + AI grátis para sempre");
  const trial = effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(8.5) }, NOW);
  assert.equal(planChipText(trial, PLAN_STATUS), "Teste do Club · faltam 9 dias");
  assert.equal(planChipText(effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(0.5) }, NOW), PLAN_STATUS), "Teste do Club · falta 1 dia");
  assert.equal(planChipText(effectivePlan(null, NOW), PLAN_STATUS), "Free");
  const manual = effectivePlan({ plan: "club", status: "active", source: "manual", ends_at: null }, NOW);
  assert.equal(planChipText(manual, PLAN_STATUS), "Club");
  assert.match(planChipBody(trial, PLAN_STATUS), /sem cobranças automáticas/);
  const expired = effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(-1) }, NOW);
  assert.match(planChipBody(expired, PLAN_STATUS), /terminou/);
});

test("trial banner: only trials with ≤ 3 days left", () => {
  const t = (d) => effectivePlan({ plan: "club", status: "trialing", source: "trial", ends_at: days(d) }, NOW);
  assert.ok(trialEndingSoon(t(2.5)));
  assert.ok(!trialEndingSoon(t(5)));
  assert.ok(!trialEndingSoon(effectivePlan({ plan: "club_ai", status: "active", source: "founder", ends_at: days(2) }, NOW)), "founders are not trials");
  assert.equal(trialBannerText(t(2.5), PLAN_STATUS), "O teste do Club acaba em 3 dias. Depois o grupo passa a Free — o jogo semanal continua igual e não é cobrado nada.");
  assert.equal(capBannerText(24, PLAN_STATUS).startsWith("O grupo tem 24 jogadores"), true);
});

test("shortDate uses Lisbon time", () => {
  assert.equal(shortDate("2026-12-31T23:59:00Z"), "31 dez");
  assert.equal(shortDate("2026-07-31T23:30:00Z"), "1 ago"); // 00:30 Lisbon (WEST) next day
  assert.equal(shortDate(null), "");
});

test("local demo plans", () => {
  assert.deepEqual(parseDemoPlan("trial:2"), { id: "trial", days: 2 });
  assert.deepEqual(parseDemoPlan("FREE"), { id: "free", days: null });
  assert.equal(parseDemoPlan("gold"), null);
  assert.equal(demoEntitlement("free", NOW).plan, "free");
  const tr = demoEntitlement("trial", NOW, 10);
  assert.deepEqual([tr.plan, tr.status, tr.daysLeft], ["club", "trialing", 10]);
  assert.equal(demoEntitlement("trial:2", NOW).daysLeft, 2);
  assert.equal(demoEntitlement("forever", NOW).source, "founder_forever");
  assert.equal(demoPlanRow({ id: "founder" }, NOW).plan, "club_ai");
});

test("every paywall / plan string is translated to EN", async () => {
  const { setLang, t } = await import("./i18n.js");
  const { GATE, UPGRADE } = await import("./pricingCopy.js");
  const same = new Set(["Free", "{plan}", "Pitch Manager / Fantasy", "Club + AI"]);
  const strings = [
    ...Object.values(GATE).flatMap((g) => [g.title, g.body]),
    ...Object.values(PLAN_STATUS).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))),
    UPGRADE.interestTitle, UPGRADE.interestBody, UPGRADE.notifyMe, UPGRADE.doneTitle, UPGRADE.doneBody, UPGRADE.askOrganizer, UPGRADE.gotIt,
  ];
  setLang("en");
  try {
    for (const s of strings) if (!same.has(s)) assert.notEqual(t(s), s, `missing EN for: ${s}`);
  } finally { setLang("pt"); }
});

test("upgrade interest → submit_lead payload with only known keys", () => {
  const p = upgradeInterestPayload({ feature: "fantasy", groupId: "g1", groupName: " FC Amigos ", name: "Ana", email: "a@b.pt" });
  const KNOWN = ["name", "whatsapp", "email", "city", "role", "has_team", "team_name", "players_count", "modality", "best_day", "best_time", "interest", "message", "source"];
  assert.ok(Object.keys(p).every((k) => KNOWN.includes(k)));
  assert.equal(p.source, "upgrade_interest");
  assert.equal(p.team_name, "FC Amigos");
  assert.equal(p.message, "group:g1 feature:fantasy plan:club");
  assert.deepEqual(p.interest, ["upgrade:club"]);
});
