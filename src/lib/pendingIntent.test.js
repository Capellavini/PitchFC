import { test } from "node:test";
import assert from "node:assert/strict";
import {
  intentFromSearch, intentFromMetadata, intentMetadata, savePendingIntent, readPendingIntent,
  clearPendingIntent, readRivalsOptIn, saveRivalsOptIn, INTENT_KEY, INTENT_TTL_MS,
} from "./pendingIntent.js";

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

test("intent from the URL (tjoin wins, junk ignored)", () => {
  assert.deepEqual(intentFromSearch("?tjoin=abcd1234efgh&desafio=zzzz9999zzzz"), { kind: "tjoin", token: "abcd1234efgh" });
  assert.deepEqual(intentFromSearch("?desafio=zzzz9999zzzz"), { kind: "desafio", token: "zzzz9999zzzz" });
  assert.equal(intentFromSearch("?tjoin=<x>"), null);
  assert.equal(intentFromSearch(""), null);
});

test("intent ⇄ signUp metadata", () => {
  assert.deepEqual(intentMetadata({ kind: "tjoin", token: "abcd1234efgh" }), { tjoin_token: "abcd1234efgh" });
  assert.deepEqual(intentMetadata(null), {});
  assert.deepEqual(intentFromMetadata({ tjoin_token: "abcd1234efgh", lang: "pt" }), { kind: "tjoin", token: "abcd1234efgh" });
  assert.equal(intentFromMetadata({ join_token: "abc" }), null);
  assert.equal(intentFromMetadata(undefined), null);
});

test("save / read / expire / clear", () => {
  const storage = memStorage();
  const now = 1_000_000_000_000;
  savePendingIntent({ kind: "tjoin", token: "abcd1234efgh" }, { storage, now });
  assert.deepEqual(readPendingIntent({ storage, now: now + 1000 }), { kind: "tjoin", token: "abcd1234efgh" });
  assert.equal(readPendingIntent({ storage, now: now + INTENT_TTL_MS + 1 }), null);
  assert.equal(storage.getItem(INTENT_KEY), null, "expired intent is cleared on read");
  savePendingIntent({ kind: "tjoin", token: "abcd1234efgh" }, { storage, now });
  clearPendingIntent({ storage });
  assert.equal(readPendingIntent({ storage, now }), null);
  storage.setItem(INTENT_KEY, "{not json");
  assert.equal(readPendingIntent({ storage, now }), null);
  savePendingIntent({ kind: "nope", token: "abcd1234efgh" }, { storage, now });
  assert.equal(storage.getItem(INTENT_KEY), "{not json", "invalid intents are never written");
});

test("rivals opt-in flag", () => {
  const storage = memStorage();
  assert.equal(readRivalsOptIn({ storage }), false);
  saveRivalsOptIn(true, { storage });
  assert.equal(readRivalsOptIn({ storage }), true);
  saveRivalsOptIn(false, { storage });
  assert.equal(readRivalsOptIn({ storage }), false);
});
