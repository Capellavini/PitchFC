// Treinador Adjunto — cost/abuse limits (plan §10; decision 9: free for
// now, only limits). Pure: callers pass today's adjunto_usage row(s).

// $ per million tokens. cache write = 5-minute TTL (1.25× input).
export const PRICES = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};
const priceOf = (model) => PRICES[model] ?? PRICES["claude-sonnet-5-5"];

/** API usage object → micro-dollars (integer). */
export function usdMicros(usage = {}, model) {
  const p = priceOf(model);
  const micros = (usage.input_tokens || 0) * p.input + (usage.output_tokens || 0) * p.output
    + (usage.cache_read_input_tokens || 0) * p.cacheRead + (usage.cache_creation_input_tokens || 0) * p.cacheWrite;
  return Math.round(micros); // tokens × $/MTok = micro-dollars
}

export const DEFAULT_LIMITS = { dailyMsgs: 40, dailyTurns: 25, dailyUsd: 0.5, globalDailyUsd: 10 };

/** usage: today's adjunto_usage row for this player (or null).
 *  globalUsdMicros: sum over every player today.
 *  Returns { mode: "ok" | "degraded" | "ignore", reason, warnGlobal }.
 *  "ignore" = past the inbound-message cap (abuse): no reply at all. */
export function budgetState({ usage, globalUsdMicros = 0, limits = DEFAULT_LIMITS }) {
  const u = usage ?? {};
  const g = globalUsdMicros / 1e6;
  const warnGlobal = g >= 0.8 * limits.globalDailyUsd;
  if ((u.msgs_in || 0) > limits.dailyMsgs) return { mode: "ignore", reason: "daily_msgs", warnGlobal };
  if (g >= limits.globalDailyUsd) return { mode: "degraded", reason: "global_usd", warnGlobal };
  if ((u.usd_micros || 0) / 1e6 >= limits.dailyUsd) return { mode: "degraded", reason: "daily_usd", warnGlobal };
  if ((u.turns || 0) >= limits.dailyTurns) return { mode: "degraded", reason: "daily_turns", warnGlobal };
  return { mode: "ok", reason: null, warnGlobal };
}

/** Add an API usage object into a usage row (pure; returns a new row). */
export function addUsage(row, usage, model) {
  const r = { turns: 0, llm_requests: 0, input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 0, usd_micros: 0, msgs_in: 0, msgs_out: 0, ...(row ?? {}) };
  return {
    ...r,
    llm_requests: r.llm_requests + 1,
    input_tokens: r.input_tokens + (usage?.input_tokens || 0),
    cache_read_tokens: r.cache_read_tokens + (usage?.cache_read_input_tokens || 0),
    cache_write_tokens: r.cache_write_tokens + (usage?.cache_creation_input_tokens || 0),
    output_tokens: r.output_tokens + (usage?.output_tokens || 0),
    usd_micros: r.usd_micros + usdMicros(usage, model),
  };
}
