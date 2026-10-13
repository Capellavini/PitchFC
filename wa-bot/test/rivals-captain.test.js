// PITCH Rivals — the captain's "help me build my team" DM (captain.js via router).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRouter } from "../src/adjunto/router.js";
import { pickTeam, CAPTAIN_TEXTS } from "../src/adjunto/captain.js";
import { captainHelpText } from "../src/core/captainPhrase.js";
import { makeWorld, makeStore, makeEnv, dm, ORG } from "./adjunto-fakes.js";

const CAP_JID = "351911111111@s.whatsapp.net";
const row = (o = {}) => ({ player_id: "p-cap", nick: "Rui", team_id: "t-coletes", team_name: "Coletes FC", team_slug: "coletes-fc", role: "captain", member_count: 1, ...o });

function setup({ rows = () => [row()], env = {} } = {}) {
  const world = makeWorld();
  const store = makeStore(world, { captainRows: rows });
  const h = makeEnv(world, store, env);
  const r = makeRouter(h.env);
  const say = (text, o = {}) => r.onDirectMessage(dm(text, { jid: CAP_JID, ...o }));
  return { world, store, ...h, r, say };
}

test("captain phrase from an unlinked number → guide with the team's ?tjoin link, no Adjunto link created", async () => {
  const s = setup();
  await s.say(captainHelpText("Coletes FC", "pt"));
  assert.equal(s.sent.length, 2, "guide + forward-ready message");
  const msg = s.sent[0].text;
  assert.equal(s.sent[0].to, CAP_JID);
  assert.match(msg, /^Olá Rui! ⚽ Sou o Pitch AI\. Vamos montar o plantel da \*Coletes FC\*/);
  assert.match(msg, /https:\/\/pitch-fc\.com\/\?tjoin=tokt-coletes/);
  assert.match(msg, /Descobrir/);
  assert.ok(msg.includes("4️⃣ *Quando tiveres 5 jogadores*, já podes lançar o primeiro desafio 🔥"));
  assert.ok(!/Dia de jogo/.test(msg));
  assert.ok(msg.endsWith("👇 Reencaminha a próxima mensagem para o grupo da equipa."));
  assert.equal(s.sent[1].to, CAP_JID);
  assert.equal(s.sent[1].text, "⚽ Entra no plantel da *Coletes FC* no PITCH: https://pitch-fc.com/?tjoin=tokt-coletes — leva 30 segundos!");
  assert.match(msg, /expira em 14 dias/);
  assert.deepEqual(s.store.db.writes.at(-1), { op: "rpc rivals_bot_team_invite", teamId: "t-coletes", playerId: "p-cap" });
  assert.equal(s.store.db.links.length, 0);
  assert.deepEqual(s.store.db.dmReplies, [{ jid: CAP_JID, kind: "rivals_captain_help" }]);
});

test("PT-BR and EN phrases answer in that language", async () => {
  const s = setup();
  await s.say(captainHelpText("Coletes FC", "pt-br"));
  assert.match(s.sent.at(-2).text, /^Olá Rui! ⚽ Sou o Pitch AI\. Vamos montar o elenco do \*Coletes FC\*/);
  assert.ok(s.sent.at(-2).text.includes("4️⃣ *Quando tiver 5 jogadores*, você já pode lançar o primeiro desafio 🔥"));
  assert.ok(s.sent.at(-2).text.endsWith("👇 Encaminhe a próxima mensagem para o grupo do time."));
  assert.equal(s.sent.at(-1).text, "⚽ Entra no elenco do *Coletes FC* no PITCH: https://pitch-fc.com/?tjoin=tokt-coletes — leva 30 segundos!");
  await s.say(captainHelpText("Coletes FC", "en"));
  assert.match(s.sent.at(-2).text, /^Hi Rui! ⚽ I'm Pitch AI\. Let's build the \*Coletes FC\* squad/);
  assert.ok(s.sent.at(-2).text.includes("4️⃣ *Once you have 5 players*, you can launch your first challenge 🔥"));
  assert.ok(s.sent.at(-2).text.endsWith("👇 Forward the next message to your team's group."));
  assert.equal(s.sent.at(-1).text, "⚽ Join the *Coletes FC* squad on PITCH: https://pitch-fc.com/?tjoin=tokt-coletes — takes 30 seconds!");
});

test("not a captain → one 'não encontrei' per 24h, then silence", async () => {
  const s = setup({ rows: () => [] });
  await s.say(captainHelpText("Coletes FC", "pt"));
  await s.say(captainHelpText("Coletes FC", "pt"));
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].text, CAPTAIN_TEXTS.pt.notFound);
  assert.ok(!s.store.db.writes.some((w) => w.op === "rpc rivals_bot_team_invite"));
});

test("@lid without a phone mapping → not found; with mapping → guide", async () => {
  const u = setup();
  await u.say(captainHelpText("Coletes FC", "pt"), { jid: "7777@lid" });
  assert.match(u.sent[0].text, /^Não encontrei nenhuma equipa/);
  const m = setup({ env: { lid: { "7777@lid": "351911111111" } } });
  await m.say(captainHelpText("Coletes FC", "pt"), { jid: "7777@lid" });
  assert.match(m.sent[0].text, /\?tjoin=/);
});

test("phone shared by two players (dirty data) → not found", async () => {
  const s = setup({ rows: () => [row(), row({ player_id: "p-other", team_id: "t2", team_name: "Outra" })] });
  await s.say(captainHelpText("Coletes FC", "pt"));
  assert.match(s.sent[0].text, /^Não encontrei/);
  assert.ok(s.logs.some((l) => /dirty data/.test(l)));
});

test("guide throttled at 3/hour per number", async () => {
  const s = setup();
  for (let i = 0; i < 5; i++) await s.say(captainHelpText("Coletes FC", "pt"));
  assert.equal(s.sent.length, 6, "3 guide replies × 2 messages; the throttle counts each pair once");
  assert.equal(s.store.db.dmReplies.length, 3);
});

test("several teams: the hinted one, others listed", async () => {
  const s = setup({ rows: () => [row({ team_id: "t-new", team_name: "Novos FC" }), row()] });
  await s.say(captainHelpText("Coletes FC", "pt"));
  assert.match(s.sent[0].text, /plantel da \*Coletes FC\*/);
  assert.match(s.sent[0].text, /Também lideras: Novos FC/);
  assert.equal(pickTeam([row({ team_name: "A" }), row({ team_name: "B" })], null).team_name, "A");
  assert.equal(pickTeam([row({ team_name: "Leões da Maia" }), row({ team_name: "B" })], "leoes").team_name, "Leões da Maia");
  assert.equal(pickTeam([], "x"), null);
});

test("lookup failure → silence (logged), human takeover → silence", async () => {
  const s = setup();
  s.store.captainLookupError = new Error("db down");
  await s.say(captainHelpText("Coletes FC", "pt"));
  assert.equal(s.sent.length, 0);
  assert.ok(s.logs.some((l) => /lookup failed/.test(l)));
  const t = setup();
  t.env.takeover.onOwnMessage(CAP_JID, "human-1");
  await t.say(captainHelpText("Coletes FC", "pt"));
  assert.equal(t.sent.length, 0);
});

test("ordinary DMs from unlinked numbers stay silent; an organizer's Adjunto phrase still works", async () => {
  const s = setup();
  await s.say("olá, criei uma equipa");
  await s.say("a equipa do benfica é boa");
  assert.equal(s.sent.length, 0);
  await s.r.onDirectMessage(dm("Quero o Treinador Adjunto"));
  assert.equal(s.store.db.links[0].player_id, ORG);
});
