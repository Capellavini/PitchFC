// Weekly-cycle dedupe (migration 68) + per-group modes (wa_bot_kinds / wa_bot_interactive).
import test from "node:test";
import assert from "node:assert/strict";
import { decide, prevForCycle, reminderKey, kindAllowed, isInteractive } from "../src/events.js";
import { render } from "../src/messages.js";

const W1 = "2026-09-27T21:00:00Z"; // cycle opened (week 1)
const W2 = "2026-10-04T21:00:00Z"; // next weekly reset, same games row
const game = (o = {}) => ({
  id: "g1", status: "open", spots: 10, venue: "Campo 1",
  scheduled_at: "2026-10-10T19:00:00Z", created_at: "2026-08-01T10:00:00Z", cycle_opened_at: W2, ...o,
});

test("keys carry the weekly cycle (reminder / game_open / matchday / cancelled)", () => {
  assert.equal(reminderKey(game()), `reminder:g1:${W2}`);
  const open = decide({ game: game(), spots: 10, confirmed: 0, prev: null, now: new Date("2026-10-05T08:00:00Z") });
  assert.deepEqual(open.map((e) => [e.kind, e.key, e.legacyKey]), [["game_open", `game_open:g1:${W2}`, "game_open:g1"]]);
  const rem = decide({ game: game(), spots: 10, confirmed: 4, prev: 4, now: new Date("2026-10-09T21:00:00Z") });
  assert.ok(rem.some((e) => e.kind === "reminder" && e.key === `reminder:g1:${W2}` && e.legacyKey === "reminder:g1"));
  const day = decide({ game: game(), spots: 10, confirmed: 10, prev: 10, now: new Date("2026-10-10T09:00:00Z") });
  assert.ok(day.some((e) => e.kind === "matchday" && e.key === `matchday:g1:${W2}`));
  const c = decide({ game: game({ status: "cancelled" }), spots: 10, confirmed: 0, prev: 3, now: new Date() });
  assert.deepEqual(c.map((e) => e.key), [`cancelled:g1:${W2}`]);
});

test("game_open fires every week: freshness comes from cycle_opened_at, not the recycled created_at", () => {
  const ev = decide({ game: game(), spots: 10, confirmed: 0, prev: null, now: new Date("2026-10-05T06:00:00Z") });
  assert.deepEqual(ev.map((e) => e.kind), ["game_open"]);
  const stale = decide({ game: game(), spots: 10, confirmed: 0, prev: null, now: new Date("2026-10-06T06:00:00Z") });
  assert.ok(!stale.some((e) => e.kind === "game_open"));
});

test("prevForCycle: new cycle → null (no fake 'abriu vaga' on reset); same cycle → count; legacy row → count", () => {
  assert.equal(prevForCycle(null, game()), null);
  assert.equal(prevForCycle({ n: 10, cycle: W1 }, game()), null);
  assert.equal(prevForCycle({ n: 7, cycle: W2 }, game()), 7);
  assert.equal(prevForCycle({ n: 7, cycle: "2026-10-04T21:00:00+00:00" }, game()), 7); // same instant, other format
  assert.equal(prevForCycle({ n: 7, cycle: null }, game()), 7); // pre-migration state: no re-announce on deploy
  // After the reset (prev → null) a full→0 drop yields no spot_opened.
  const ev = decide({ game: game(), spots: 10, confirmed: 0, prev: prevForCycle({ n: 10, cycle: W1 }, game()), now: new Date("2026-10-06T06:00:00Z") });
  assert.ok(!ev.some((e) => e.kind === "spot_opened"));
});

test("wa_bot_kinds allowlist and wa_bot_interactive", () => {
  assert.equal(kindAllowed({ wa_bot_kinds: null }, "reminder"), true);
  assert.equal(kindAllowed({ wa_bot_kinds: [] }, "reminder"), true);
  assert.equal(kindAllowed({ wa_bot_kinds: ["game_open"] }, "game_open"), true);
  for (const k of ["reminder", "milestone", "matchday", "spot_opened", "promoted", "postgame", "match_awards", "cancelled", "adj_reminder"]) {
    assert.equal(kindAllowed({ wa_bot_kinds: ["game_open"] }, k), false, k);
  }
  assert.equal(isInteractive({}), true);
  assert.equal(isInteractive({ wa_bot_interactive: true }), true);
  assert.equal(isInteractive({ wa_bot_interactive: false }), false);
});

test("game_open in an app-only group says chat confirmations don't count (PT, PT-BR, EN)", () => {
  const ctx = { game: game(), spots: 10, link: "https://pitch-fc.com/?join=x" };
  assert.ok(!render("game_open", ctx, "pt").includes("só na app"));
  assert.match(render("game_open", { ...ctx, appOnly: true }, "pt"), /só na app.*"eu vou" ou "tô dentro"/s);
  assert.match(render("game_open", { ...ctx, appOnly: true }, "ptbr"), /só no app/);
  assert.match(render("game_open", { ...ctx, appOnly: true }, "en"), /in the app only/);
});
