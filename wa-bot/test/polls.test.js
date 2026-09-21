import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { proto, aesEncryptGCM, hmacSign } from "@whiskeysockets/baileys";
import * as polls from "../src/polls.js";
import { pollContent } from "../src/messages.js";
import { parseCommand } from "../src/roster.js";
import { pollAppliesFallback, parseIntentJson } from "../src/ask.js";

const sha = (s) => crypto.createHash("sha256").update(Buffer.from(s)).digest();
const NUL = String.fromCharCode(0); // built at runtime: a literal NUL makes tools treat this file as binary

// Same scheme WhatsApp uses to encrypt a vote (mirror of decryptPollVote).
function encryptVote({ secret, pollId, creator, voter, options }) {
  const sign = Buffer.concat([Buffer.from(pollId), Buffer.from(creator), Buffer.from(voter), Buffer.from("Poll Vote"), new Uint8Array([1])]);
  const key0 = hmacSign(secret, new Uint8Array(32), "sha256");
  const encKey = hmacSign(sign, key0, "sha256");
  const iv = crypto.randomBytes(12);
  const plain = proto.Message.PollVoteMessage.encode({ selectedOptions: options.map(sha) }).finish();
  return { encPayload: aesEncryptGCM(plain, encKey, iv, Buffer.from(`${pollId}${NUL}${voter}`)), encIv: iv };
}

const OPTS = ["✅ Eu vou / I'm in", "❌ Não vou / I'm out", "🤔 Talvez"];
const poll = () => ({ id: "POLL1", secret: crypto.randomBytes(32), options: OPTS });

test("option labels map to attendance intents (bilingual, emoji, maybe)", () => {
  assert.equal(polls.optionIntent("✅ Eu vou"), "confirm");
  assert.equal(polls.optionIntent("❌ Não vou"), "decline");
  assert.equal(polls.optionIntent("✅ Eu vou / I'm in"), "confirm");
  assert.equal(polls.optionIntent("❌ Não vou / I'm out"), "decline");
  assert.equal(polls.optionIntent("I'm in"), "confirm");
  assert.equal(polls.optionIntent("🤔 Talvez"), null);
  assert.equal(polls.optionIntent("Churrasco às 20h"), null);
});

test("a vote's intent: one clear pick only", () => {
  assert.equal(polls.voteIntent(["✅ Eu vou / I'm in"]), "confirm");
  assert.equal(polls.voteIntent(["❌ Não vou / I'm out"]), "decline");
  assert.equal(polls.voteIntent(["🤔 Talvez"]), null);
  assert.equal(polls.voteIntent([]), null);                                   // vote removed
  assert.equal(polls.voteIntent(["✅ Eu vou / I'm in", "❌ Não vou / I'm out"]), null); // contradictory
});

test("encrypted vote round-trips and finds the chosen option", () => {
  const p = poll();
  const enc = encryptVote({ ...p, pollId: p.id, creator: "351911111111@s.whatsapp.net", voter: "5511975415506@s.whatsapp.net", options: [OPTS[0]] });
  const r = polls.decryptSelected(p, enc, { creators: ["351911111111@s.whatsapp.net"], voters: ["5511975415506@s.whatsapp.net"] });
  assert.deepEqual(r.names, [OPTS[0]]);
  assert.equal(polls.voteIntent(r.names), "confirm");
});

test("decrypt tries other jid forms (phone vs privacy id) until one fits", () => {
  const p = poll();
  const enc = encryptVote({ ...p, pollId: p.id, creator: "351911111111@s.whatsapp.net", voter: "1234567890@lid", options: [OPTS[1]] });
  const r = polls.decryptSelected(p, enc, {
    creators: ["999@lid", "351911111111@s.whatsapp.net"],
    voters: ["5511975415506@s.whatsapp.net", "1234567890@lid"],
  });
  assert.equal(r.voterJid, "1234567890@lid");
  assert.equal(polls.voteIntent(r.names), "decline");
});

test("a wrong secret never decrypts (no false votes)", () => {
  const p = poll();
  const enc = encryptVote({ ...p, pollId: p.id, creator: "c@s.whatsapp.net", voter: "v@s.whatsapp.net", options: [OPTS[0]] });
  const other = { ...p, secret: crypto.randomBytes(32) };
  assert.equal(polls.decryptSelected(other, enc, { creators: ["c@s.whatsapp.net"], voters: ["v@s.whatsapp.net"] }), null);
});

test("noteVote is idempotent per voter and fires again when the vote changes", () => {
  polls._reset();
  assert.equal(polls.noteVote("P", "v1", "confirm"), true);
  assert.equal(polls.noteVote("P", "v1", "confirm"), false);
  assert.equal(polls.noteVote("P", "v1", "decline"), true);
  assert.equal(polls.noteVote("P", "v2", "confirm"), true);
});

test("poll store keeps the secret as a buffer and remembers the applies flag", () => {
  polls._reset();
  const secret = crypto.randomBytes(32);
  polls.addPoll({ id: "S1", jid: "g@g.us", name: "Jogo?", options: OPTS, secret, creators: ["a"], applies: null });
  assert.ok(Buffer.from(polls.getPoll("S1").secret).equals(secret));
  polls.setApplies("S1", false);
  assert.equal(polls.getPoll("S1").applies, false);
});

test("extractPoll reads any wire version", () => {
  const v3 = { pollCreationMessageV3: { name: "Q", options: [{ optionName: "A" }, { optionName: "B" }] }, messageContextInfo: { messageSecret: Buffer.alloc(32, 1) } };
  const p = polls.extractPoll(v3);
  assert.equal(p.name, "Q"); assert.deepEqual(p.options, ["A", "B"]); assert.equal(p.secret.length, 32);
  assert.equal(polls.extractPoll({ conversation: "oi" }), null);
});

test("bot poll content: options are readable back as confirm / decline in every language", () => {
  const game = { scheduled_at: "2026-09-26T19:00:00Z" };
  for (const lang of ["pt", "en", "pt+en"]) {
    const { name, values } = pollContent(game, lang);
    assert.ok(name.length > 0 && name.length <= 255, lang);
    assert.deepEqual(values.map(polls.optionIntent), ["confirm", "decline"], lang);
    assert.ok(values.every((v) => v.length <= 100), lang);
  }
});

test("'@Pitch enquete' / 'post a poll' are commands; questions and chatter are not", () => {
  for (const t of ["enquete", "faz uma enquete", "Cria a enquete", "manda enquete do jogo"]) assert.equal(parseCommand(t)?.command, "poll", t);
  for (const t of ["post a poll", "poll", "make a poll for the game"]) assert.equal(parseCommand(t)?.command, "poll", t);
  for (const t of ["qual a enquete?", "eu vou", "a enquete está boa", ""]) assert.equal(parseCommand(t), null, t);
});

test("keyword fallback (used only when the model is unavailable)", () => {
  assert.ok(pollAppliesFallback("Quem vai jogar sábado?"));
  assert.ok(pollAppliesFallback("Are you playing the match on Saturday?"));
  assert.ok(!pollAppliesFallback("Vamos ao cinema?"));
});

test("classifier JSON is parsed strictly", () => {
  assert.deepEqual(parseIntentJson('{"intent":"decline","lang":"pt"}'), { intent: "decline", lang: "pt" });
  assert.equal(parseIntentJson('{"intent":"none","lang":"pt"}'), null);
  assert.equal(parseIntentJson("garbage"), null);
});
