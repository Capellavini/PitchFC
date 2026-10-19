// Endpoint handler tests — mocked Supabase + mocked Anthropic, no network.
import test from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { createHandler, DEFAULT_MODEL, DONE_KEY } from "../api/onboarding-ai.js";

const ENV = { VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc", ANTHROPIC_API_KEY: "sk-test" };

function mkRes() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

function mkDeps({ env = ENV, user = { id: "u1", user_metadata: {} }, authError = null, bump = 1, bumpError = null, reply, anthropicError } = {}) {
  const calls = { anthropic: [], rpc: [], clients: [] };
  return {
    calls,
    deps: {
      env,
      now: () => new Date("2026-10-19T10:00:00Z"),
      createSupabase: (url, key) => {
        calls.clients.push(key);
        return {
          auth: { getUser: async () => (authError ? { data: null, error: authError } : { data: { user }, error: null }) },
          rpc: async (fn, args) => { calls.rpc.push([fn, args, key]); return fn === "ai_onboarding_bump" ? { data: bumpError ? null : bump, error: bumpError } : { data: null, error: null }; },
        };
      },
      createAnthropic: (apiKey) => ({
        messages: {
          create: async (params) => {
            calls.anthropic.push({ apiKey, params });
            if (anthropicError) throw anthropicError;
            return reply ?? {
              stop_reason: "tool_use", usage: { input_tokens: 500, output_tokens: 60 },
              content: [{ type: "tool_use", name: params.tools[0].name, input: { weekday: 4, time: "19h", recurring: true } }],
            };
          },
        },
      }),
    },
  };
}
const req = (body, auth = "Bearer tok") => ({ method: "POST", headers: auth ? { authorization: auth } : {}, body });
const WHEN = { field: "when", text: "às quintas depois do trabalho, tipo 19h", lang: "pt" };

test("rejects non-POST and unauthenticated callers before anything else", async () => {
  const { deps, calls } = mkDeps();
  const h = createHandler(deps);
  let res = mkRes(); await h({ method: "GET", headers: {} }, res); assert.equal(res.code, 405);
  res = mkRes(); await h(req(WHEN, ""), res); assert.equal(res.code, 401);
  res = mkRes(); await h(req(WHEN, "Basic abc"), res); assert.equal(res.code, 401);
  assert.equal(calls.anthropic.length, 0);
  const bad = mkDeps({ authError: { message: "invalid" } });
  res = mkRes(); await createHandler(bad.deps)(req(WHEN), res);
  assert.equal(res.code, 401); assert.equal(bad.calls.anthropic.length, 0); assert.equal(bad.calls.rpc.length, 0);
});

test("happy path: one strict tool call on Haiku 4.5, sanitised single-field answer, usage counted", async () => {
  const { deps, calls } = mkDeps();
  const res = mkRes();
  await createHandler(deps)(req(WHEN), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { field: "when", raw: { weekday: 4, time: "19:00", recurring: true } });
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(calls.anthropic.length, 1);
  const { apiKey, params } = calls.anthropic[0];
  assert.equal(apiKey, "sk-test");
  assert.equal(params.model, DEFAULT_MODEL);
  assert.equal(params.tools.length, 1);
  assert.equal(params.tools[0].strict, true);
  assert.deepEqual(params.tool_choice, { type: "tool", name: "extract_when" });
  assert.ok(params.messages[0].content.includes("<answer>às quintas depois do trabalho, tipo 19h</answer>"));
  assert.ok(params.messages[0].content.includes("Europe/Lisbon"));
  assert.deepEqual(calls.rpc.map((r) => r[0]), ["ai_onboarding_bump", "ai_onboarding_add_cost"]);
  assert.equal(calls.rpc[0][2], "svc"); // service role key, server-side
  assert.deepEqual(calls.rpc[0][1], { p_user: "u1", p_limit: 15 });
  assert.equal(calls.rpc[1][1].p_micros, 800);
});

test("model override via env; models without forced tool use get auto", async () => {
  const { deps, calls } = mkDeps({ env: { ...ENV, ONBOARDING_AI_MODEL: "claude-opus-5-5" } });
  await createHandler(deps)(req(WHEN), mkRes());
  assert.equal(calls.anthropic[0].params.model, "claude-opus-5-5");
  assert.deepEqual(calls.anthropic[0].params.tool_choice, { type: "auto" });
});

test("rate limit: bump returns NULL → 429 fallback, no model call", async () => {
  const { deps, calls } = mkDeps({ bump: null });
  const res = mkRes(); await createHandler(deps)(req(WHEN), res);
  assert.equal(res.code, 429); assert.deepEqual(res.body, { fallback: true, reason: "rate_limited" });
  assert.equal(calls.anthropic.length, 0);
});

test("usage table unavailable → fails closed (fallback, no model call)", async () => {
  const { deps, calls } = mkDeps({ bumpError: { message: "boom" } });
  const res = mkRes(); await createHandler(deps)(req(WHEN), res);
  assert.equal(res.body.fallback, true); assert.equal(calls.anthropic.length, 0);
});

test("missing secrets → fallback, never a model call", async () => {
  for (const drop of ["ANTHROPIC_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_URL"]) {
    const env = { ...ENV }; delete env[drop];
    const { deps, calls } = mkDeps({ env });
    const res = mkRes(); await createHandler(deps)(req(WHEN), res);
    assert.equal(res.code, 200, drop); assert.equal(res.body.fallback, true, drop); assert.equal(calls.anthropic.length, 0, drop);
  }
});

test("an account that already finished the AI onboarding is refused", async () => {
  const { deps, calls } = mkDeps({ user: { id: "u1", user_metadata: { [DONE_KEY]: "2026-10-19T10:00:00Z" } } });
  const res = mkRes(); await createHandler(deps)(req(WHEN), res);
  assert.equal(res.code, 409); assert.equal(res.body.reason, "already_done");
  assert.equal(calls.anthropic.length, 0); assert.equal(calls.rpc.length, 0);
});

test("input guardrails: length cap, unknown field, bad JSON", async () => {
  const h = createHandler(mkDeps().deps);
  let res = mkRes(); await h(req({ ...WHEN, text: "x".repeat(601) }), res); assert.equal(res.code, 400); assert.equal(res.body.error, "too_long");
  res = mkRes(); await h(req({ ...WHEN, field: "password" }), res); assert.equal(res.code, 400);
  res = mkRes(); await h(req("{not json"), res); assert.equal(res.code, 400);
});

test("API errors / timeouts / refusals → fallback; logs never contain the user's text", async () => {
  const logged = [];
  const orig = console.error; console.error = (...a) => logged.push(a.join(" "));
  try {
    const timeout = new Anthropic.APIConnectionTimeoutError({ message: "timeout" });
    for (const anthropicError of [timeout, new Error("boom")]) {
      const { deps } = mkDeps({ anthropicError });
      const res = mkRes(); await createHandler(deps)(req(WHEN), res);
      assert.equal(res.code, 200); assert.deepEqual(res.body, { fallback: true, reason: "ai_unavailable" });
    }
    const refusal = mkDeps({ reply: { stop_reason: "refusal", content: [], usage: {} } });
    const res = mkRes(); await createHandler(refusal.deps)(req(WHEN), res);
    assert.equal(res.body.fallback, true);
    const noTool = mkDeps({ reply: { stop_reason: "end_turn", content: [{ type: "text", text: "hi" }], usage: {} } });
    const res2 = mkRes(); await createHandler(noTool.deps)(req(WHEN), res2);
    assert.equal(res2.body.fallback, true);
  } finally { console.error = orig; }
  assert.ok(logged.length >= 2);
  assert.ok(logged.every((l) => !l.includes("quintas")));
});
