// End-to-end DM flows through the router with fake store/env/transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRouter } from "../src/adjunto/router.js";
import { makeWorld, makeStore, makeEnv, dm, NOW, ORG, ASSIST, GROUP_ID, GAME_ID } from "./adjunto-fakes.js";

const ORG_JID = "351912345678@s.whatsapp.net";
const ASSIST_JID = "351910000001@s.whatsapp.net";

function setup(opts = {}) {
  const world = makeWorld(opts.world);
  const store = makeStore(world, opts.store);
  const h = makeEnv(world, store, opts.env);
  const r = makeRouter(h.env);
  const say = (text, o) => r.onDirectMessage(dm(text, o));
  const last = () => h.sent.at(-1)?.text ?? "";
  return { world, store, ...h, r, say, last };
}

test("SILENCE: unlinked sender with ordinary text gets nothing (no reply, no typing)", async () => {
  const s = setup();
  await s.say("olá, tudo bem?", { jid: "351999999999@s.whatsapp.net" });
  await s.say("o adjunto do benfica é bom");
  await s.r.onDirectMessage({ key: { remoteJid: "status@broadcast", id: "x" }, message: { conversation: "Quero o Treinador Adjunto" } });
  await s.r.onDirectMessage({ key: { remoteJid: "120@newsletter", id: "y" }, message: { conversation: "Quero o Treinador Adjunto" } });
  assert.equal(s.sent.length, 0);
  assert.equal(s.store.db.links.length, 0);
  assert.equal(s.store.db.dmReplies.length, 0);
});

test("ACCEPTANCE: organizer writes 'Quero o Treinador Adjunto' → link + welcome + format onboarding", async () => {
  const s = setup();
  await s.say("Quero o Treinador Adjunto");
  assert.equal(s.store.db.links.length, 1);
  const link = s.store.db.links[0];
  assert.equal(link.player_id, ORG);
  assert.equal(link.active_group_id, GROUP_ID);
  assert.equal(link.wa_pn, "351912345678");
  assert.match(s.last(), /Olá João! Sou o teu \*Treinador Adjunto\* no Goodweather F\.C\./);
  assert.match(s.last(), /24h antes do jogo proponho equipas/);
  assert.match(s.last(), /tabela da noite \(recomeça todas as semanas\)/);
  assert.doesNotMatch(s.last(), /liga da época/);
  assert.equal(s.store.db.threads.get(link.id).mode, "onboarding");

  // ...and the onboarding writes groups.game_format on "sim"
  await s.say("2"); await s.say("3/1/0"); await s.say("ok");
  assert.match(s.last(), /Guardo assim\?/);
  await s.say("sim");
  assert.match(s.last(), /Formato guardado/);
  assert.deepEqual(s.store.db.writes.at(-1).op, "update groups.game_format");
  assert.equal(s.world.state.group.game_format.type, "campeonato");
  assert.equal(s.store.db.threads.get(link.id).mode, "idle");
});

test("activation via @lid with remoteJidAlt works; @lid without PN → one 'não encontrei' per day", async () => {
  const s = setup();
  await s.say("ativar adjunto", { jid: "8888@lid", alt: ORG_JID });
  assert.equal(s.store.db.links[0].wa_jid, "8888@lid");
  assert.equal(s.store.db.links[0].wa_lid, "8888@lid");

  const u = setup();
  await u.say("Quero o Treinador Adjunto", { jid: "9999@lid" });
  await u.say("Quero o Treinador Adjunto", { jid: "9999@lid" });
  assert.equal(u.sent.length, 1);
  assert.match(u.sent[0].text, /^Não encontrei nenhum grupo onde sejas organizador/);
  assert.equal(u.store.db.links.length, 0);
});

test("activation: number not an organizer, or shared by two players → not found (throttled), no link", async () => {
  const s = setup();
  await s.say("Quero o Treinador Adjunto", { jid: "351910000005@s.whatsapp.net" }); // a plain member
  await s.say("olá adjunto", { jid: "351910000005@s.whatsapp.net" });
  assert.equal(s.sent.length, 1);
  assert.equal(s.store.db.links.length, 0);
  const d = setup({ store: { orgRows: () => [{ player_id: "a", group_id: GROUP_ID, group_name: "G" }, { player_id: "b", group_id: GROUP_ID, group_name: "G" }] } });
  await d.say("Quero o Treinador Adjunto");
  assert.equal(d.store.db.links.length, 0);
  assert.match(d.last(), /Não encontrei/);
  assert.ok(d.logs.some((l) => /dirty data/.test(l)));
});

test("activation in EN / PT-BR answers in that language when not found", async () => {
  const s = setup();
  await s.say("I want the assistant coach", { jid: "447700900123@s.whatsapp.net" });
  assert.match(s.last(), /^I couldn't find a group/);
  await s.say("Oi, quero o auxiliar técnico", { jid: "5511987654321@s.whatsapp.net" });
  assert.match(s.last(), /^Não encontrei nenhum grupo onde você seja/);
});

test("several groups → numbered choice (choose_group) → pick → welcome", async () => {
  const s = setup({ store: { orgRows: () => [{ player_id: ORG, group_id: GROUP_ID, group_name: "Goodweather F.C." }, { player_id: ORG, group_id: "g2", group_name: "Pitch Quarta" }] } });
  s.store.extraGroups = [{ id: "g2", name: "Pitch Quarta", lang: "pt", wa_bot_lang: "pt", adjunto_enabled: true, game_format: null }];
  await s.say("Quero o Treinador Adjunto");
  const menu = "És organizador de vários grupos:\n1) Goodweather F.C.\n2) Pitch Quarta\n\nQual queres ativar? Responde com o número.";
  assert.equal(s.last(), menu);
  const link = s.store.db.links[0];
  assert.equal(link.active_group_id, null);
  assert.equal(s.store.db.threads.get(link.id).mode, "choose_group");
  // Repeating the phrase re-shows the menu (2026-10-06 live bug).
  await s.say("Quero ativar o adjunto");
  assert.equal(s.last(), menu);
  await s.say("7");
  assert.match(s.last(), /Responde com o número/);
  await s.say("2");
  assert.equal(link.active_group_id, "g2");
  assert.match(s.last(), /no Pitch Quarta/);
  assert.match(s.last(), /Também és organizador do Goodweather F\.C\./);
});

test("phrase again while choosing → menu rebuilt from CURRENT groups (one created after the first message shows up)", async () => {
  const s = setup({ store: { orgRows: () => [{ player_id: ORG, group_id: GROUP_ID, group_name: "Goodweather F.C." }, { player_id: ORG, group_id: "g2", group_name: "Pitch Quarta" }] } });
  s.store.extraGroups = [{ id: "g2", name: "Pitch Quarta", lang: "pt", wa_bot_lang: "pt", adjunto_enabled: true, game_format: null }];
  await s.say("Quero o Treinador Adjunto");
  s.store.extraGroups.push({ id: "g3", name: "PITCH Teste Adjunto", lang: "pt", wa_bot_lang: "pt", adjunto_enabled: true, game_format: null });
  await s.say("Quero o Treinador Adjunto");
  assert.match(s.last(), /3\) PITCH Teste Adjunto/);
  await s.say("3");
  assert.equal(s.store.db.links[0].active_group_id, "g3");
});

test("activation code: valid → link (even if the number differs); expired → 'gera outro' max 3/hour", async () => {
  const s = setup();
  s.store.db.codes.push({ code: "ADJ-7K3QX9", player_id: ASSIST, group_id: GROUP_ID, expires_at: new Date(NOW.getTime() + 6e5).toISOString() });
  await s.say("Olá! Quero ativar o Treinador Adjunto do Goodweather 🧢 Código: ADJ-7K3QX9", { jid: "351930000000@s.whatsapp.net" });
  assert.equal(s.store.db.links[0].player_id, ASSIST);
  assert.match(s.last(), /Olá Zé!/);
  for (let i = 0; i < 4; i++) await s.say("Código: ADJ-ABCDEF", { jid: "351940000000@s.whatsapp.net" });
  assert.equal(s.sent.filter((m) => /já não é válido/.test(m.text)).length, 3);
});

async function linked(opts) {
  const s = setup({ ...opts, world: { format: { v: 1, type: "avulso" }, ...(opts?.world ?? {}) } });
  await s.say("Quero o Treinador Adjunto");
  return s;
}

test("teams: card → swap → redraw → ok → 'publico no grupo?' → sim posts lineup only", async () => {
  const s = await linked();
  await s.say("equipas");
  assert.match(s.last(), /Jogo fechado \(10\/10\)! Proposta de equipas:/);
  assert.match(s.last(), /\d+\?/); // unrated OVR shows "?"
  const draftWrite = s.store.db.writes.find((w) => w.op === "rpc adjunto_apply_teams");
  assert.equal(draftWrite.p_confirm, false); // mirrored as a draft (game had no teams)
  await s.say("troca João com Nuno");
  assert.match(s.last(), /Proposta de equipas/);
  await s.say("sorteia de novo");
  assert.match(s.last(), /Proposta de equipas/);
  await s.say("ok");
  assert.match(s.last(), /Equipas confirmadas/);
  assert.match(s.last(), /Publico as equipas no grupo\?/);
  const confirmWrite = s.store.db.writes.at(-1);
  assert.equal(confirmWrite.op, "rpc adjunto_apply_teams");
  assert.equal(confirmWrite.p_confirm, true);
  assert.equal(confirmWrite.p_actor, ORG);
  assert.equal(s.world.state.game.teams_confirmed, true);
  await s.say("sim");
  assert.equal(s.posts.at(-1).ev.kind, "teams_confirmed");
  assert.deepEqual(Object.keys(s.posts.at(-1).ctx.teams[0]), ["name", "nicks"]);
  assert.match(s.last(), /Publicado no grupo/);
});

test("teams: app edited meanwhile → CAS fails → bot re-validates the app's version", async () => {
  const s = await linked();
  await s.say("equipas");
  const ctx = s.world.ctx();
  s.world.state.game.teams = [{ id: "t1", name: "A", players: ctx.playing.slice(0, 5).map((p) => p.id) }, { id: "t2", name: "B", players: ctx.playing.slice(5).map((p) => p.id) }];
  await s.say("ok");
  assert.match(s.last(), /Mexeste nas equipas na app/);
  assert.match(s.last(), /versão que está na app/);
  assert.equal(s.world.state.game.teams_confirmed, false);
});

test("teams short (7/10): 'proponho ou espero?' → espera → rejected(wait); propõe → card", async () => {
  const s = await linked({ world: { confirmed: 7 } });
  const { askShort } = await import("../src/adjunto/teamsflow.js");
  const link = s.store.db.links[0];
  const r = await askShort(s.env, { link, ctx: s.world.ctx(), lang: "pt" });
  assert.match(r.text, /7\/10 confirmados\. Proponho equipas com os 7 confirmados ou espero\?/);
  await s.say("espera");
  assert.match(s.last(), /espero/);
  assert.equal(s.store.db.proposals.at(-1).error, "wait");
  await askShort(s.env, { link, ctx: s.world.ctx(), lang: "pt" });
  await s.say("propõe");
  assert.match(s.last(), /Proposta de equipas \(7\/10 confirmados\)/);
});

test("first approval wins: assistant approves, organizer's pending card is superseded + notified", async () => {
  const s = await linked();
  await s.say("Quero o Treinador Adjunto", { jid: ASSIST_JID });
  await s.say("equipas");                       // organizer's card
  await s.say("equipas", { jid: ASSIST_JID });  // assistant's card
  await s.say("ok", { jid: ASSIST_JID });
  const orgCard = s.store.db.proposals.find((p) => p.kind === "teams" && p.link_id === s.store.db.links[0].id && p.status !== "pending" && p.error === "approved_by_other");
  assert.ok(orgCard);
  assert.ok(s.sent.some((m) => m.to === ORG_JID && /O Zé já aprovou as equipas/.test(m.text)));
  await s.say("ok"); // organizer too late: nothing pending for teams
  assert.equal(s.store.db.writes.filter((w) => w.p_confirm === true).length, 1);
});

test("roster change after the proposal → superseded + 'saiu X, entrou Y, ajusto?' → sim → adjusted card", async () => {
  const s = await linked({ world: { confirmed: 10 } });
  await s.say("equipas");
  const p1 = s.store.db.proposals.at(-1);
  s.world.state.attendances[3].status = "declined";
  s.world.state.attendances[10].status = "confirmed";
  const { rosterCheck } = await import("../src/adjunto/teamsflow.js");
  const msg = await rosterCheck(s.env, { link: s.store.db.links[0], ctx: s.world.ctx(), proposal: (await s.store.pendingProposals(s.store.db.links[0].id))[0], lang: "pt" });
  assert.equal(msg, "🔄 Saiu Tiago e entrou Cris — ajusto as equipas? (sim/não)");
  assert.equal(p1.status, "superseded");
  await s.say("sim");
  assert.match(s.last(), /Proposta de equipas/);
  assert.match(s.last(), /Cris/);
  assert.doesNotMatch(s.last(), /Tiago/);
});

test("human takeover: a fromMe message typed on the phone silences the bot for 30 min", async () => {
  const s = await linked();
  const before = s.sent.length;
  s.r.onOwnMessage({ key: { remoteJid: ORG_JID, fromMe: true, id: "human1" }, message: { conversation: "Olá João, sou eu (Vini)" } });
  await s.say("estado");
  assert.equal(s.sent.length, before);
  s.env.takeover.noteBotSent("bot1");
  assert.equal(s.env.takeover.onOwnMessage("x@s.whatsapp.net", "bot1"), false); // the bot's own sends never count
});

test("quick commands + degraded mode without a model (one notice per day)", async () => {
  const s = await linked();
  await s.say("estado");
  assert.match(s.last(), /✅ 10\/10 confirmados/);
  await s.say("pausa");
  assert.equal(s.store.db.links[0].prefs.proactive, false);
  await s.say("quem devia ir à baliza?");
  assert.match(s.last(), /Hoje já pensei muito/);
  const n = s.sent.length;
  await s.say("e o Zé?");
  assert.equal(s.sent.length, n);
});

test("linked organizer free text goes to the agent; proposals need an explicit 'sim'", async () => {
  const script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "set_spots", input: { spots: 12 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Proponho passar para 12 vagas." }], usage: {} },
  ];
  const fake = { messages: { create: async () => script.shift() }, beta: { messages: { create: async () => script.shift() } } };
  const s = await linked({ env: { anthropic: fake } });
  await s.say("mete 12 vagas");
  assert.match(s.last(), /12 vagas[\s\S]*#\d+ vagas 10 → 12\. Confirmas\? \(sim\/não\)/);
  assert.equal(s.store.db.writes.filter((w) => /max_players/.test(w.op)).length, 0); // nothing written yet
  await s.say("sim");
  assert.deepEqual(s.store.db.writes.at(-1), { op: "update groups.max_players + games.spots", groupId: GROUP_ID, gameId: GAME_ID, n: 12 });
});

test("dry-run (ADJUNTO_AUTOSEND=false): no shared-table writes", async () => {
  const s = await linked({ env: { autosend: false } });
  await s.say("equipas");
  await s.say("ok");
  assert.equal(s.store.db.writes.length, 0);
  assert.match(s.last(), /Equipas confirmadas/);
});
