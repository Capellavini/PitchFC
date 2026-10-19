// Group plans in the bot: Free groups only get "game_open"; the Adjunto
// needs Club + AI (one polite DM a day otherwise); reads fail open.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlans } from "../src/plans.js";
import { makeRouter } from "../src/adjunto/router.js";
import { makeTicker } from "../src/adjunto/tick.js";
import { makeWorld, makeStore, makeEnv, dm, NOW, ORG, GROUP_ID } from "./adjunto-fakes.js";

const day = 864e5;
const rows = {
  free: { plan: "free", status: "active", source: "manual", ends_at: null },
  club: { plan: "club", status: "active", source: "manual", ends_at: null },
  ai: { plan: "club_ai", status: "active", source: "founder_forever", ends_at: null },
  trialOver: { plan: "club", status: "trialing", source: "trial", ends_at: new Date(NOW.getTime() - day).toISOString() },
  founder: { plan: "club_ai", status: "active", source: "founder", ends_at: "2026-12-31T23:59:00Z" },
};
const plansFor = (row, extra = {}) => makePlans({ fetchRow: async () => row, now: () => NOW, ...extra });

test("Free group: only game_open is sent; Club gets every kind", async () => {
  const free = plansFor(rows.free);
  assert.ok(await free.allowsKind("g", "game_open"));
  for (const k of ["reminder", "matchday", "milestone", "promoted", "spot_opened", "postgame", "match_awards", "cancelled"]) {
    assert.equal(await free.allowsKind("g", k), false, k);
  }
  const club = plansFor(rows.club);
  for (const k of ["game_open", "reminder", "postgame", "match_awards"]) assert.ok(await club.allowsKind("g", k), k);
});

test("expired trial ⇒ Free; founder until 31 Dec ⇒ Club + AI; no row ⇒ Free", async () => {
  assert.equal((await plansFor(rows.trialOver).entitlement("g")).plan, "free");
  assert.equal(await plansFor(rows.trialOver).allowsKind("g", "reminder"), false);
  assert.ok(await plansFor(rows.founder).hasAdjunto("g"));
  assert.equal(await plansFor(rows.club).hasAdjunto("g"), false);
  assert.equal((await plansFor(null).entitlement("g")).plan, "free");
});

test("cache: one read per group per TTL", async () => {
  let reads = 0;
  let t = NOW.getTime();
  const p = makePlans({ fetchRow: async () => { reads++; return rows.club; }, now: () => new Date(t), ttlMs: 1000 });
  await p.allowsKind("g", "reminder"); await p.hasAdjunto("g"); await p.entitlement("g");
  assert.equal(reads, 1);
  await p.entitlement("h");
  assert.equal(reads, 2);
  t += 1001;
  await p.entitlement("g");
  assert.equal(reads, 3);
});

test("fail open: a read error keeps the bot behaving as before plans", async () => {
  const logs = [];
  const p = makePlans({ fetchRow: async () => { throw new Error('relation "group_plans" does not exist'); }, now: () => NOW, log: (m) => logs.push(m) });
  assert.ok(await p.allowsKind("g", "reminder"));
  assert.ok(await p.hasAdjunto("g"));
  assert.equal(logs.length, 1);
});

// ── Treinador Adjunto ─────────────────────────────────────
function setup(row) {
  const world = makeWorld();
  const store = makeStore(world);
  const h = makeEnv(world, store, { plans: plansFor(row) });
  const r = makeRouter(h.env);
  const say = (text, o) => r.onDirectMessage(dm(text, o));
  return { world, store, ...h, r, say };
}

test("Adjunto on a group without Club + AI: activation links but answers with ONE /pricing DM a day", async () => {
  const s = setup(rows.club);
  await s.say("Quero o Treinador Adjunto");
  assert.equal(s.store.db.links.length, 1, "the link is kept so an upgrade works right away");
  assert.equal(s.sent.length, 1);
  assert.match(s.sent[0].text, /faz parte do \*Club \+ AI\*/);
  assert.match(s.sent[0].text, /https:\/\/pitch-fc\.com\/pricing/);
  assert.doesNotMatch(s.sent[0].text, /Sou o teu/);
  await s.say("estado");
  await s.say("quem falta pagar?");
  assert.equal(s.sent.length, 1, "silence after the daily notice");
});

test("Adjunto on Club + AI: unchanged welcome", async () => {
  const s = setup(rows.ai);
  await s.say("Quero o Treinador Adjunto");
  assert.match(s.sent.at(-1).text, /Sou o teu \*Treinador Adjunto\*/);
});

test("proactive tick skips groups without Club + AI", async () => {
  const world = makeWorld({ format: { v: 1, type: "avulso" }, hoursToKickoff: 20, confirmed: 10 });
  const store = makeStore(world);
  const mk = async (row) => {
    const h = makeEnv(world, store, { plans: plansFor(row) });
    h.env.claim = async (gid, gameId, kind, key) => key;
    await store.upsertLink({ playerId: ORG, waJid: "351912345678@s.whatsapp.net", activeGroupId: GROUP_ID });
    await makeTicker(h.env)();
    return h.sent.length;
  };
  assert.equal(await mk(rows.club), 0);
  assert.ok(await mk(rows.ai) > 0);
});
