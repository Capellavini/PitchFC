// PITCH Ligas on WhatsApp — the DM handler, end to end with fakes (no network, no Baileys).
import test from "node:test";
import assert from "node:assert/strict";
import { makeLeagueHandler, LEAGUE_CODE, messageText, mediaOf } from "../src/league/handler.js";
import * as S from "../src/leaguelib/leagueSetup.js";
import { matchScore } from "../src/core/league.js";

const JID = "351911111111@s.whatsapp.net";
const USER = "00000000-0000-0000-0000-000000000001";
const msg = (text, extra = {}) => ({ key: { remoteJid: JID, fromMe: false, id: `m${Math.random()}` }, message: { conversation: text, ...extra } });
const imageMsg = (caption = "") => ({ key: { remoteJid: JID, fromMe: false, id: "img" }, message: { imageMessage: { mimetype: "image/jpeg", fileLength: 100_000, caption } } });

const league = () => {
  let s = { version: 5, data: { league: { id: "lg", name: "Liga do Porto", city: "Porto", timeZone: "Europe/Lisbon" }, competitions: [], teams: [], players: [] }, modules: {}, matches: [], logs: {}, fanVotes: {}, fantasy: {}, viewer: { role: "manager", entered: true }, prefs: {}, announcements: [] };
  s = S.addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 1, season: "2026/27" });
  const comp = s.data.competitions[0].id;
  for (const n of ["Porto FC", "Corinthians de Porto"]) s = S.addTeam(s, { name: n, competitionIds: [comp] });
  const [p, c] = s.data.teams.map((t) => t.id);
  s = S.addPlayers(s, p, "9;Vinicius Capella\n4;Bruno Barto");
  s = S.addPlayers(s, c, "7;Nuno Reis");
  s = S.addMatch(s, { competitionId: comp, homeId: p, awayId: c, date: "2026-10-27", time: "15:00", round: 1 });
  return s;
};

function setup({ link = true, state = league(), model = null, slotOk = true, writeErrors = [] } = {}) {
  const sent = []; const calls = { model: [], writes: [] };
  const db = { ws: state ? { version: 3, state } : null, links: link ? [{ user_id: USER, wa_jid: JID, enabled: true }] : [], pend: [], codes: new Set(["LIGA-ABC234"]) };
  let pid = 0;
  const store = {
    findLink: async () => db.links[0] ?? null,
    consumeCode: async (code) => (db.codes.delete(code) ? (db.links.push({ user_id: USER, wa_jid: JID, enabled: true }), USER) : null),
    touchLink: async () => {}, deleteLink: async () => { db.links = []; },
    workspaceOf: async () => (db.ws ? structuredClone(db.ws) : null),
    writeWorkspace: async (_u, st, exp) => {
      calls.writes.push({ st, exp });
      const e = writeErrors.shift(); if (e) { if (e === "version_conflict") db.ws = { ...db.ws, version: db.ws.version + 1 }; return { error: e }; }
      if (exp !== db.ws.version) return { error: "version_conflict" };
      db.ws = { version: exp + 1, state: st }; return { version: db.ws.version };
    },
    takeSlot: async () => slotOk,
    pendingFor: async () => db.pend.filter((p) => p.status === "pending").at(-1) ?? null,
    addPending: async (_u, items, summary) => { db.pend.forEach((p) => { p.status = "cancelled"; }); const row = { id: ++pid, items, summary, status: "pending", expires_at: new Date(Date.now() + 30 * 60e3).toISOString() }; db.pend.push(row); return row; },
    settlePending: async (id, status) => { const p = db.pend.find((x) => x.id === id); if (p) p.status = status; },
  };
  const anthropic = model ? { messages: { create: async (req) => { calls.model.push(req); const r = typeof model === "function" ? model(req) : model; if (r instanceof Error) throw r; return r; } } } : null;
  const env = { store, anthropic, cfg: { leagueModel: "test-model" }, log: () => {}, now: () => new Date(), send: async (jid, text) => { sent.push(text); }, lidMapping: () => null, downloadMedia: async () => ({ media_type: "image/jpeg", data: Buffer.from([255, 216, 255, 1, 2, 3]).toString("base64"), name: "sumula" }) };
  return { h: makeLeagueHandler(env), sent, db, calls, env };
}
const tool = (name, input) => ({ stop_reason: "tool_use", content: [{ type: "text", text: "Percebi o resultado." }, { type: "tool_use", id: "t1", name, input }] });
const sentenceInput = { home: "Porto FC", away: "Corinthians", home_goals: 2, away_goals: 0, date: "2026-10-27", scorers: [{ player: "Vini", goals: 2 }], cards: [{ player: "Barto", type: "yellow" }] };

test("helpers: the link code, caption text and the attached media", () => {
  assert.equal(LEAGUE_CODE.exec("Quero ligar. Código: liga-abc234!")?.[0].toUpperCase(), "LIGA-ABC234");
  assert.equal(LEAGUE_CODE.exec("ADJ-ABC234"), null);
  assert.equal(messageText(imageMsg("súmula do Porto")), "súmula do Porto");
  assert.deepEqual(mediaOf(imageMsg()), { kind: "image", mime: "image/jpeg", bytes: 100_000 });
  assert.equal(mediaOf(msg("olá")), null);
  assert.equal(mediaOf({ message: { documentMessage: { mimetype: "application/pdf", fileLength: 5, fileName: "s.pdf" } } }).kind, "document");
  assert.equal(mediaOf({ message: { documentMessage: { mimetype: "application/zip" } } }), null);
});

test("someone who is not a league manager is not ours: the weekly-groups Adjunto keeps the message", async () => {
  const t = setup({ link: false });
  assert.equal(await t.h.onDirectMessage(msg("olá, tudo bem?")), false);
  assert.equal(t.sent.length, 0);
});

test("a valid code links the sender and welcomes them; a wrong one says how to get another", async () => {
  const t = setup({ link: false });
  assert.equal(await t.h.onDirectMessage(msg("Quero ligar o Adjunto da minha liga. Código: LIGA-ABC234")), true);
  assert.match(t.sent[0], /Adjunto de Ligas da Liga do Porto\. Ligado ✅/);
  assert.match(t.sent[0], /sim/);
  const t2 = setup({ link: false });
  assert.equal(await t2.h.onDirectMessage(msg("LIGA-ZZZZZ2")), true);
  assert.match(t2.sent[0], /não é válido ou já expirou/);
});

test("a linked account without a league yet is told to create it", async () => {
  const t = setup({ link: false, state: null });
  await t.h.onDirectMessage(msg("LIGA-ABC234"));
  assert.match(t.sent[0], /Ainda não tens liga/);
});

test("the sentence: a summary first, the league untouched until 'sim', then applied provisional", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  await t.h.onDirectMessage(msg("o Porto fc vs Corinthians jogou hoje, terminou 2x0, 2 gols do Vini, com cartão amarelo pro Barto"));
  assert.equal(t.calls.model.length, 1);
  assert.equal(t.calls.model[0].model, "test-model");
  assert.match(t.sent[0], /Entendi:\n✅ Porto FC 2–0 Corinthians de Porto · golos: Vini \(2\) · cartões: Barto \(amarelo\) — fica por homologar/);
  assert.match(t.sent[0], /\*sim\*/);
  assert.equal(t.calls.writes.length, 0, "nothing written before the confirmation");
  assert.equal(t.db.ws.version, 3);
  await t.h.onDirectMessage(msg("sim"));
  assert.equal(t.calls.writes.length, 1);
  assert.equal(t.calls.writes[0].exp, 3);
  const m = t.db.ws.state.matches[0];
  assert.equal(m.state, "ended_provisional");
  assert.deepEqual([matchScore(t.db.ws.state.logs[m.id], m).home, matchScore(t.db.ws.state.logs[m.id], m).away], [2, 0]);
  assert.match(t.sent[1], /Feito ✅.*por homologar/s);
  assert.equal(t.db.pend[0].status, "applied");
});

test("'não' cancels and writes nothing; a 'sim' with nothing pending is harmless", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  await t.h.onDirectMessage(msg("Porto FC 2-0 Corinthians"));
  await t.h.onDirectMessage(msg("não"));
  assert.match(t.sent[1], /Cancelado/);
  assert.equal(t.calls.writes.length, 0);
  await t.h.onDirectMessage(msg("sim"));
  assert.match(t.sent[2], /nada à espera/);
});

test("what cannot be applied is shown with its reason and never queued", async () => {
  const bad = { ...sentenceInput, scorers: [{ player: "Fulano Inexistente" }], cards: [] };
  const t = setup({ model: tool("propose_record_result", bad) });
  await t.h.onDirectMessage(msg("Porto 2-0 Corinthians, golo do Fulano"));
  assert.match(t.sent[0], /Não consegui aplicar nada:\n❌ .*Não encontrei esse atleta/s);
  assert.equal(t.db.pend.length, 0);
});

test("the league is re-read at 'sim': a change made in the app meanwhile is not overwritten", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  await t.h.onDirectMessage(msg("Porto FC 2-0 Corinthians"));
  // the app records the result first
  t.db.ws = { version: 4, state: S.setLeagueInfo(t.db.ws.state, { name: "Liga do Porto (renomeada)", city: "Porto" }) };
  await t.h.onDirectMessage(msg("sim"));
  assert.equal(t.calls.writes.at(-1).exp, 4);
  assert.equal(t.db.ws.state.data.league.name, "Liga do Porto (renomeada)");
  assert.equal(t.db.ws.state.matches[0].state, "ended_provisional");
});

test("a version conflict at write time is retried once on the fresh league, then reported", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput), writeErrors: ["version_conflict"] });
  await t.h.onDirectMessage(msg("Porto FC 2-0 Corinthians"));
  await t.h.onDirectMessage(msg("sim"));
  assert.equal(t.calls.writes.length, 2);
  assert.match(t.sent[1], /Feito ✅/);
  const t2 = setup({ model: tool("propose_record_result", sentenceInput), writeErrors: ["version_conflict", "version_conflict"] });
  await t2.h.onDirectMessage(msg("Porto FC 2-0 Corinthians"));
  await t2.h.onDirectMessage(msg("sim"));
  assert.match(t2.sent[1], /mudou entretanto/);
});

test("a result already entered in the app makes the 'sim' fail safely instead of duplicating", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  await t.h.onDirectMessage(msg("Porto FC 2-0 Corinthians"));
  const { recordResult } = await import("../src/leaguelib/leagueResults.js");
  t.db.ws = { version: 4, state: recordResult(t.db.ws.state, { matchId: t.db.ws.state.matches[0].id, score: { home: 1, away: 1 } }) };
  await t.h.onDirectMessage(msg("sim"));
  assert.match(t.sent[1], /Não consegui aplicar nada.*já tem resultado/s);
  assert.equal(t.calls.writes.length, 0);
});

test("a photo is downloaded, sent to the model as an image, and read like a sentence", async () => {
  const t = setup({ model: tool("propose_record_result", { ...sentenceInput, appeared: [{ team: "Porto FC", players: ["Vinicius Capella", "Bruno Barto"] }] }) });
  await t.h.onDirectMessage(imageMsg("súmula do Porto"));
  const sentToModel = t.calls.model[0].messages.at(-1).content;
  assert.ok(sentToModel.some((b) => b.type === "image" && b.source.media_type === "image/jpeg"));
  assert.match(t.sent[0], /Entendi:/);
  assert.match(t.calls.model[0].system, /Boletim de Participantes/);
  assert.match(t.calls.model[0].system, /WhatsApp/);
});

test("a file the validator rejects (wrong bytes) is refused before any model call", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  t.env.downloadMedia = async () => ({ media_type: "image/jpeg", data: Buffer.from("isto não é uma imagem").toString("base64"), name: "x" });
  const h = makeLeagueHandler(t.env);
  await h.onDirectMessage(imageMsg());
  assert.match(t.sent[0], /Não consegui usar esse ficheiro/);
  assert.equal(t.calls.model.length, 0);
});

test("guards: no AI key, daily cap, model error, no proposal", async () => {
  const off = setup({ model: null });
  await off.h.onDirectMessage(msg("Porto 2-0 Corinthians"));
  assert.match(off.sent[0], /não está disponível/);
  const cap = setup({ model: tool("propose_record_result", sentenceInput), slotOk: false });
  await cap.h.onDirectMessage(msg("Porto 2-0 Corinthians"));
  assert.match(cap.sent[0], /limite diário/);
  assert.equal(cap.calls.model.length, 0);
  const down = setup({ model: new Error("boom") });
  await down.h.onDirectMessage(msg("Porto 2-0 Corinthians"));
  assert.match(down.sent[0], /IA não respondeu/);
  const talk = setup({ model: { stop_reason: "end_turn", content: [{ type: "text", text: "Qual foi o resultado?" }] } });
  await talk.h.onDirectMessage(msg("o Porto jogou hoje"));
  assert.equal(talk.sent[0], "Qual foi o resultado?");
  assert.equal(talk.db.pend.length, 0);
});

test("help and unlink; an unreadable league state is explained", async () => {
  const t = setup({ model: tool("propose_record_result", sentenceInput) });
  await t.h.onDirectMessage(msg("ajuda"));
  assert.match(t.sent[0], /Não homologo/);
  await t.h.onDirectMessage(msg("desligar"));
  assert.match(t.sent[1], /Desligado/);
  assert.equal(await t.h.onDirectMessage(msg("olá")), false, "after unlinking the message is no longer ours");
  const bad = setup({ state: { not: "a league" }, model: tool("propose_record_result", sentenceInput) });
  await bad.h.onDirectMessage(msg("Porto 2-0 Corinthians"));
  assert.match(bad.sent[0], /formato que não consigo ler/);
});

test("the model is given today's pending results and never athlete names", async () => {
  const t = setup({ model: { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] } });
  await t.h.onDirectMessage(msg("o que falta?"));
  const ctx = t.calls.model[0].messages.at(-1).content[0].text;
  assert.match(ctx, /awaitingResult/);
  assert.doesNotMatch(ctx, /Vinicius|Barto|Nuno/);
});
