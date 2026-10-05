// The proactive pass end-to-end with fakes: T-24h team card, claim-dedupe,
// dry-run, and a menu reply ("1") after a status DM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTicker } from "../src/adjunto/tick.js";
import { makeRouter } from "../src/adjunto/router.js";
import { makeWorld, makeStore, makeEnv, dm, ORG, GROUP_ID } from "./adjunto-fakes.js";

async function setup({ world: w = {}, env: e = {} } = {}) {
  const world = makeWorld({ format: { v: 1, type: "avulso" }, ...w });
  const store = makeStore(world);
  const h = makeEnv(world, store, e);
  const claimed = new Set();
  h.env.claim = async (gid, gameId, kind, key) => (claimed.has(key) ? null : (claimed.add(key), key));
  await store.upsertLink({ playerId: ORG, waJid: "351912345678@s.whatsapp.net", activeGroupId: GROUP_ID });
  return { world, store, ...h, tick: makeTicker(h.env), router: makeRouter(h.env), claimed };
}

test("T-24h: full game → validation card DM once (dedupe by claim)", async () => {
  const s = await setup({ world: { hoursToKickoff: 20, confirmed: 10 } }); // NOW = 19:00 Lisbon
  await s.tick();
  await s.tick();
  const cards = s.sent.filter((m) => /Proposta de equipas/.test(m.text));
  assert.equal(cards.length, 1);
  assert.ok([...s.claimed].some((k) => k.startsWith("adj:teams:")));
});

test("T-24h short game → 'proponho com os N ou espero?'", async () => {
  const s = await setup({ world: { hoursToKickoff: 20, confirmed: 7 } });
  await s.tick();
  assert.match(s.sent.at(-1).text, /Proponho equipas com os 7 confirmados ou espero\?/);
});

test("dry-run: logs the DM once, sends and claims nothing", async () => {
  const s = await setup({ world: { hoursToKickoff: 20, confirmed: 10 }, env: { autosend: false } });
  await s.tick(); await s.tick();
  assert.equal(s.sent.length, 0);
  assert.equal(s.claimed.size, 0);
  assert.equal(s.logs.filter((l) => /\[adjunto dry-run\] proactive adj_teams/.test(l)).length, 1);
});

test("status DM (T-30h, 5/10) → reply '1' → reminder proposal → 'sim' posts in the group", async () => {
  const s = await setup({ world: { hoursToKickoff: 30, confirmed: 5 } });
  await s.tick();
  assert.match(s.sent.at(-1).text, /Ponto de situação/);
  assert.match(s.sent.at(-1).text, /Ainda estou a aprender quem confirma tarde/);
  await s.router.onDirectMessage(dm("1"));
  assert.match(s.sent.at(-1).text, /lembrete no grupo .*Confirmas\? \(sim\/não\)/);
  await s.router.onDirectMessage(dm("sim"));
  assert.equal(s.posts.find((p) => p.ev.kind === "adj_reminder").ctx.pending.length, 7);
  assert.match(s.sent.at(-1).text, /Enviado no grupo/);
});
