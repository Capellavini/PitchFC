// The tool loop with a FAKE Anthropic client (scripted responses, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgentTurn, windowMessages, systemPrompt } from "../src/adjunto/agent.js";
import { TOOL_DEFS } from "../src/adjunto/tools.js";

const U = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 };
const text = (t, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: t }], usage: U });
const tools = (...calls) => ({ stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "s2" }, ...calls.map(([name, input], i) => ({ type: "tool_use", id: `tu${i}`, name, input }))], usage: U });

function fakeClient(script) {
  const calls = [];
  const create = async (req) => { calls.push(structuredClone(req)); const r = script.shift(); if (r instanceof Error) throw r; return r; };
  return { calls, messages: { create }, beta: { messages: { create } } };
}

test("request shape: sonnet 5.5 rules (no thinking param, auto tool_choice, effort, caching, sorted strict tools)", async () => {
  const c = fakeClient([text("Olá!")]);
  const r = await runAgentTurn({ client: c, model: "claude-sonnet-5-5", tools: TOOL_DEFS, runTool: async () => ({}), snapshot: "today: x", userText: "olá" });
  assert.equal(r.text, "Olá!");
  const req = c.calls[0];
  assert.equal("thinking" in req, false);
  assert.deepEqual(req.tool_choice, { type: "auto" });
  assert.deepEqual(req.output_config, { effort: "low" });
  assert.deepEqual(req.cache_control, { type: "ephemeral" });
  assert.deepEqual(req.system.at(-1).cache_control, { type: "ephemeral" });
  assert.equal(req.max_tokens, 4000);
  const names = req.tools.map((t) => t.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(req.tools.every((t) => t.strict === true && t.input_schema.additionalProperties === false));
  // volatile snapshot only in the latest user turn; system is static
  assert.doesNotMatch(req.system[0].text, /today/);
  assert.match(req.messages.at(-1).content[0].text, /<snapshot>\ntoday: x/);
});

test("system prompt is identical across turns (cache-stable) and per language", () => {
  assert.equal(systemPrompt("pt"), systemPrompt("pt"));
  assert.match(systemPrompt("pt"), /Treinador Adjunto/);
  assert.match(systemPrompt("ptbr"), /Auxiliar Técnico/);
  assert.match(systemPrompt("en"), /Assistant Coach/);
});

test("parallel tool calls → ALL results in ONE user message; assistant content appended verbatim", async () => {
  const c = fakeClient([tools(["get_roster", {}], ["get_payments", {}]), text("Há 10 jogadores.")]);
  const ran = [];
  const r = await runAgentTurn({ client: c, model: "m", tools: TOOL_DEFS, userText: "quantos?",
    runTool: async (n) => { ran.push(n); return { content: JSON.stringify({ n: 10 }), is_error: n === "get_payments" }; } });
  assert.equal(r.stop, "end");
  assert.deepEqual(ran.sort(), ["get_payments", "get_roster"]);
  const second = c.calls[1].messages;
  const asst = second.at(-2), res = second.at(-1);
  assert.equal(asst.role, "assistant");
  assert.equal(asst.content[0].type, "thinking"); // thinking blocks kept for the next round
  assert.equal(res.role, "user");
  assert.deepEqual(res.content.map((b) => b.type), ["tool_result", "tool_result"]);
  assert.equal(res.content.find((b) => b.tool_use_id === "tu1").is_error, true);
});

test("effort rises to medium for analysis requests or ≥3 tool calls in round 1", async () => {
  const c1 = fakeClient([text("ok")]);
  await runAgentTurn({ client: c1, model: "m", tools: [], runTool: async () => ({}), userText: "analisa a forma do Zé" });
  assert.equal(c1.calls[0].output_config.effort, "medium");
  const c2 = fakeClient([tools(["get_roster", {}], ["get_form", { player: null }], ["get_payments", {}]), text("ok")]);
  await runAgentTurn({ client: c2, model: "m", tools: [], runTool: async () => ({ content: "{}" }), userText: "como está tudo" });
  assert.equal(c2.calls[0].output_config.effort, "low");
  assert.equal(c2.calls[1].output_config.effort, "medium");
});

test("loop stops at 6 tool rounds", async () => {
  const script = Array.from({ length: 10 }, () => tools(["get_roster", {}]));
  const c = fakeClient(script);
  const r = await runAgentTurn({ client: c, model: "m", tools: [], runTool: async () => ({ content: "{}" }), userText: "x", maxRounds: 6 });
  assert.equal(r.stop, "max_rounds");
  assert.equal(c.calls.length, 7); // 6 executed rounds + the 7th asking for more
  assert.match(r.text, /continue/);
});

test("refusal is checked before content", async () => {
  const c = fakeClient([{ stop_reason: "refusal", stop_details: { category: "general_harms" }, content: [{ type: "text", text: "SHOULD NOT LEAK" }], usage: U }]);
  const r = await runAgentTurn({ client: c, model: "m", tools: [], runTool: async () => ({}), userText: "x" });
  assert.equal(r.stop, "refusal");
  assert.equal(r.text, "Não consigo ajudar com isso.");
});

test("numbers guard: one correction round, then a deterministic fallback", async () => {
  const c = fakeClient([tools(["get_payments", {}]), text("Falta pagar 99 €."), text("Ainda 77 €."),]);
  const r = await runAgentTurn({ client: c, model: "m", tools: [], userText: "quem falta pagar?",
    runTool: async () => ({ content: JSON.stringify({ unpaid: ["Rui"], total_due_eur: "4,50" }) }) });
  assert.equal(r.stop, "guard");
  assert.match(c.calls[2].messages.at(-1).content, /Os números 99/);
  assert.match(r.text, /unpaid|total_due_eur: 4,50/);
  const ok = fakeClient([tools(["get_payments", {}]), text("O Rui deve 4,50 €.")]);
  const r2 = await runAgentTurn({ client: ok, model: "m", tools: [], userText: "?", runTool: async () => ({ content: JSON.stringify({ total_due_eur: "4,50" }) }) });
  assert.equal(r2.stop, "end");
});

test("API error → error template; server-side fallback uses the beta endpoint", async () => {
  const c = fakeClient([new Error("boom")]);
  const r = await runAgentTurn({ client: c, model: "m", tools: [], runTool: async () => ({}), userText: "x" });
  assert.equal(r.stop, "error");
  const c2 = fakeClient([text("ok")]);
  await runAgentTurn({ client: c2, model: "m", tools: [], runTool: async () => ({}), userText: "x", fallback: true });
  assert.deepEqual(c2.calls[0].betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(c2.calls[0].fallbacks, "default");
});

test("window is plain text only, starts with a user turn, events become user lines", () => {
  const w = windowMessages([{ role: "assistant", content: "orphan" }, { role: "user", content: "olá" }, { role: "event", content: "[#3 pendente]" }, { role: "assistant", content: "oi" }]);
  assert.deepEqual(w, [{ role: "user", content: "olá" }, { role: "user", content: "[evento] [#3 pendente]" }, { role: "assistant", content: "oi" }]);
});
