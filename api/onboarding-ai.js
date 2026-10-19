// Vercel serverless — AI fallback for the organizer's guided onboarding.
//
// The app parses every answer LOCALLY first (src/lib/onboardingAi.js). It
// only calls this endpoint when one free-text answer can't be parsed with
// confidence: one tiny structured extraction for ONE field
// (venue | when | format | price | name | sentence).
//
// Security:
//  • Caller must send their Supabase access token (Authorization: Bearer);
//    verified server-side with auth.getUser (public URL + anon key).
//  • ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY live in server env
//    only — never in the bundle.
//  • 600-char input cap; per-user daily limit (ai_onboarding_usage, written
//    with the service role through ai_onboarding_bump — fails CLOSED: no
//    counter, no model call); an account that already finished the AI
//    onboarding (user_metadata.pitch_ai_onboarding_done_at) is refused.
//  • Any missing env / API failure / timeout → 200 { fallback: true } and the
//    app carries on with its structured controls.
//  • Logs carry an error code only — never the organizer's text.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  FIELD_SCHEMAS, toolNameFor, buildSystemPrompt, buildUserContent, validateRequestBody,
  sanitizeFieldRaw, estCostMicros,
} from "../src/lib/onboardingAi.js";

export const DAILY_LIMIT = 15;
export const DEFAULT_MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 12000;
export const DONE_KEY = "pitch_ai_onboarding_done_at";

// Models that reject forced tool_choice (they get "auto" + the prompt's
// "call the tool exactly once" instead).
const NO_FORCED_TOOL = /^claude-(fable-5-1|mythos-5-1|opus-5-5|sonnet-5-5)/;

const defaultDeps = {
  env: process.env,
  createSupabase: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  createAnthropic: (apiKey) => new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 }),
  now: () => new Date(),
};

const fallback = (res, reason, status = 200) => res.status(status).json({ fallback: true, reason });

export function createHandler(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    const env = deps.env;
    const header = String(req.headers?.authorization || "");
    const token = /^Bearer \S+$/.test(header) ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthenticated" });

    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anon) return fallback(res, "not_configured");

    // 1. Who is calling?
    let user;
    try {
      const { data, error } = await deps.createSupabase(url, anon).auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: "unauthenticated" });
      user = data.user;
    } catch {
      console.error("onboarding-ai: auth_check_failed");
      return fallback(res, "auth_unavailable");
    }
    if (user.user_metadata?.[DONE_KEY]) return fallback(res, "already_done", 409);

    // 2. Input
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: "bad_json" }); }
    let input;
    try { input = validateRequestBody(body); } catch (e) { return res.status(400).json({ error: e.message }); }

    // 3. Server-only secrets
    const apiKey = env.ANTHROPIC_API_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!apiKey || !service) return fallback(res, "not_configured");
    const db = deps.createSupabase(url, service);

    // 4. Rate limit (fails closed)
    try {
      const limit = Number(env.ONBOARDING_AI_DAILY_LIMIT) > 0 ? Number(env.ONBOARDING_AI_DAILY_LIMIT) : DAILY_LIMIT;
      const { data, error } = await db.rpc("ai_onboarding_bump", { p_user: user.id, p_limit: limit });
      if (error) throw error;
      if (data == null) return fallback(res, "rate_limited", 429);
    } catch {
      console.error("onboarding-ai: usage_unavailable");
      return fallback(res, "usage_unavailable");
    }

    // 5. One small structured call
    const model = env.ONBOARDING_AI_MODEL || DEFAULT_MODEL;
    const name = toolNameFor(input.field);
    let message;
    try {
      message = await deps.createAnthropic(apiKey).messages.create({
        model,
        max_tokens: 400,
        system: buildSystemPrompt(),
        tools: [{
          name,
          description: `Record the ${input.field} extracted from the organizer's answer.`,
          strict: true,
          input_schema: FIELD_SCHEMAS[input.field],
        }],
        tool_choice: NO_FORCED_TOOL.test(model) ? { type: "auto" } : { type: "tool", name },
        messages: [{ role: "user", content: buildUserContent({ ...input, now: deps.now() }) }],
      });
    } catch (e) {
      const code = e instanceof Anthropic.RateLimitError ? "api_rate_limited"
        : e instanceof Anthropic.APIConnectionTimeoutError ? "api_timeout"
        : e instanceof Anthropic.APIError ? `api_${e.status ?? "error"}` : "api_error";
      console.error("onboarding-ai:", code);
      return fallback(res, "ai_unavailable");
    }

    // Best effort: cost bookkeeping never blocks the answer.
    try { await db.rpc("ai_onboarding_add_cost", { p_user: user.id, p_micros: estCostMicros(model, message.usage) }); } catch { /* ignore */ }

    if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") return fallback(res, "no_answer");
    const block = (message.content || []).find((b) => b.type === "tool_use" && b.name === name);
    if (!block) return fallback(res, "no_answer");
    return res.status(200).json({ field: input.field, raw: sanitizeFieldRaw(input.field, block.input) });
  };
}

export default createHandler();
