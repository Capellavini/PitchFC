import { test } from "node:test";
import assert from "node:assert/strict";
import { usdMicros, budgetState, addUsage, DEFAULT_LIMITS } from "../src/adjunto/budget.js";

test("usdMicros at Sonnet 5.5 prices", () => {
  // 1M input = $2, 1M output = $10, 1M cache read = $0.20
  assert.equal(usdMicros({ input_tokens: 1_000_000 }, "claude-sonnet-5-5"), 2_000_000);
  assert.equal(usdMicros({ output_tokens: 1000 }, "claude-sonnet-5-5"), 10_000);
  assert.equal(usdMicros({ cache_read_input_tokens: 10_000, cache_creation_input_tokens: 4000 }, "claude-sonnet-5-5"), 2_000 + 10_000);
});

test("budgetState: ok → degraded (per player $, turns, global $) → ignore (msg flood)", () => {
  assert.equal(budgetState({ usage: null }).mode, "ok");
  assert.deepEqual(budgetState({ usage: { usd_micros: 500_000 } }), { mode: "degraded", reason: "daily_usd", warnGlobal: false });
  assert.equal(budgetState({ usage: { turns: 25 } }).reason, "daily_turns");
  assert.equal(budgetState({ usage: {}, globalUsdMicros: 10_000_000 }).reason, "global_usd");
  assert.equal(budgetState({ usage: {}, globalUsdMicros: 8_500_000 }).warnGlobal, true);
  assert.equal(budgetState({ usage: { msgs_in: DEFAULT_LIMITS.dailyMsgs + 1 } }).mode, "ignore");
});

test("addUsage accumulates", () => {
  let r = addUsage(null, { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 4000 }, "claude-sonnet-5-5");
  r = addUsage(r, { input_tokens: 50 }, "claude-sonnet-5-5");
  assert.equal(r.llm_requests, 2);
  assert.equal(r.input_tokens, 150);
  assert.equal(r.cache_read_tokens, 4000);
  assert.equal(r.usd_micros, 300 + 100 + 800);
});
