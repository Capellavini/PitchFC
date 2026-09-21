import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent, phonesMatch, splitWaitlist, actionReplies } from "../src/roster.js";

const intent = (t) => parseIntent(t)?.intent ?? null;

test("confirm phrases (PT)", () => {
  for (const t of ["eu vou", "Vou", "vou sim", "conta comigo", "Estou dentro!", "confirmo", "bora", "ok eu vou"])
    assert.equal(intent(t), "confirm", t);
});
test("decline phrases (PT) — negation wins over 'vou'", () => {
  for (const t of ["não vou", "Nao vou", "não posso", "não vou poder ir", "desisto", "tou fora", "cancela minha presença", "não vou mais", "Não vou mais poder", "não posso mais", "nao da mais", "desisti"])
    assert.equal(intent(t), "decline", t);
});
test("confirm / decline phrases (EN)", () => {
  assert.deepEqual(parseIntent("I'm in"), { intent: "confirm", lang: "en" });
  assert.deepEqual(parseIntent("count me in"), { intent: "confirm", lang: "en" });
  assert.deepEqual(parseIntent("I'm out"), { intent: "decline", lang: "en" });
  assert.deepEqual(parseIntent("can't make it"), { intent: "decline", lang: "en" });
  assert.deepEqual(parseIntent("I'm not coming anymore"), { intent: "decline", lang: "en" });
});
test("PT phrases report lang pt", () => {
  assert.equal(parseIntent("eu vou").lang, "pt");
  assert.equal(parseIntent("não vou").lang, "pt");
});
test("questions and longer sentences never trigger an action", () => {
  for (const t of ["eu vou?", "quantas vagas faltam", "vou levar a bola", "será que eu vou", "quem vai?", "não sei se vou conseguir", "the game is in Porto", "who's out?", "não vou levar a bola", "não vou mais levar a bola"])
    assert.equal(intent(t), null, t);
});
test("empty / mention-only text is not an action", () => {
  assert.equal(parseIntent(""), null);
  assert.equal(parseIntent("   "), null);
});

test("phone matching ignores country code and formatting", () => {
  assert.ok(phonesMatch("912 345 678", "+351912345678"));
  assert.ok(phonesMatch("+351 912-345-678", "351912345678"));
  assert.ok(phonesMatch("5511987654321", "+55 11 98765-4321"));
  assert.ok(!phonesMatch("912345678", "912345679"));
  assert.ok(!phonesMatch("1234567", "1234567")); // too short = junk data
  assert.ok(!phonesMatch(null, "912345678"));
});

test("waitlist: mensalista outranks an earlier avulso; order by responded_at", () => {
  const r = splitWaitlist([
    { id: "a", playerType: "avulso", respondedAt: "2026-09-20T10:00:00Z" },
    { id: "m1", playerType: "mensalista", respondedAt: "2026-09-20T12:00:00Z" },
    { id: "m2", playerType: "mensalista", respondedAt: "2026-09-20T11:00:00Z" },
  ], 2);
  assert.deepEqual(r.playing.map((p) => p.id), ["m2", "m1"]);
  assert.deepEqual(r.waitlist.map((p) => p.id), ["a"]);
});
test("waitlist: a locked avulso competes on time", () => {
  const r = splitWaitlist([
    { id: "a", playerType: "avulso", priorityLocked: true, respondedAt: "2026-09-20T10:00:00Z" },
    { id: "m", playerType: "mensalista", respondedAt: "2026-09-20T12:00:00Z" },
  ], 1);
  assert.deepEqual(r.playing.map((p) => p.id), ["a"]);
});

test("replies exist in both languages for every case", () => {
  for (const [k, v] of Object.entries(actionReplies)) {
    assert.equal(typeof v.pt({ nick: "X", c: 1, s: 10, pos: 1, link: "L" }), "string", k);
    assert.equal(typeof v.en({ nick: "X", c: 1, s: 10, pos: 1, link: "L" }), "string", k);
  }
  assert.match(actionReplies.confirmed.pt({ nick: "Vini", c: 9, s: 10 }), /falta 1 vaga/);
  assert.match(actionReplies.confirmed.en({ nick: "Vini", c: 10, s: 10 }), /game full/);
});
