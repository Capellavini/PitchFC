// PITCH group bot — transport + poll loop.
// Sends only (a) state-change events and (b) replies to an explicit @mention /
// reply-to-bot. It posts a poll ONLY when an organizer asks ("@Pitch enquete"),
// and reads votes on attendance polls.
// Dry-run unless BOT_AUTOSEND=true.
try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

import crypto from "node:crypto";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { cfg } from "./config.js";
import { botGroups, upcomingGames, getPrev, setPrev, claim, markSent, unclaim, sentSince, recentMatchdays, groupMembers, confirmedRoster, setStatus } from "./db.js";
import { decide, decidePostGame } from "./events.js";
import { render, pollContent } from "./messages.js";
import { isQuietHour, lisbonDayKey } from "./time.js";
import { answer, classifyIntent, pollApplies } from "./ask.js";
import { parseIntent, parseCommand, phonesMatch, splitWaitlist, actionReplies } from "./roster.js";
import * as polls from "./polls.js";

const LIST_GROUPS = process.argv.includes("--list-groups");
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 2000 + Math.random() * 6000; // look human, not a burst

let sock;
let loopStarted = false;
let pairing = false;
const candidate = new Map();   // gameId -> {n}: debounce, a changed count must hold for 2 polls
const dryLogged = new Set();
const lastAsk = new Map();     // sender -> ts, 1 answer / 20s each
const windowWarned = new Set(); // poll|voter already told "confirmations not open yet"

const linkFor = (g) => `${cfg().appUrl}/?join=${g.invite_token}`;
// Generous (<=1h early) start of today in Lisbon, for the daily cap.
const startOfLisbonDayIso = () => new Date(new Date(lisbonDayKey() + "T00:00:00Z").getTime() - 36e5).toISOString();

// Enabled groups, cached briefly: every group message asks "is this one ours?".
let groupCache = { at: 0, list: [] };
async function enabledGroups() {
  if (Date.now() - groupCache.at > 30000) groupCache = { at: Date.now(), list: await botGroups() };
  return groupCache.list;
}
const groupByJid = async (jid) => (await enabledGroups()).find((g) => g.wa_group_jid === jid);

const ownJids = () => [sock.user?.id, sock.user?.lid].filter(Boolean).flatMap((j) => [j, jidNormalizedUser(j)]);
const uniq = (a) => [...new Set(a.filter(Boolean))];

async function typing(jid) {
  await sleep(jitter());
  await sock.sendPresenceUpdate("composing", jid);
  await sleep(600 + Math.random() * 1200);
}

async function send(jid, text, quoted) {
  await typing(jid);
  await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
}

/** The bot's own one-tap attendance poll. The bot authors it, so it holds the secret to read votes. */
async function sendPoll(group, game) {
  const { name, values } = pollContent(game, group.wa_bot_lang || "pt");
  const secret = crypto.randomBytes(32);
  await typing(group.wa_group_jid);
  const sent = await sock.sendMessage(group.wa_group_jid, { poll: { name, values, selectableCount: 1, messageSecret: secret } });
  polls.addPoll({ id: sent.key.id, jid: group.wa_group_jid, name, options: values, secret, creators: uniq(ownJids()), applies: true, fromMe: true });
}

// One announcement: guards -> claim -> send. Returns "sent" | "skipped" | "blocked".
// "blocked" means "not now, retry next poll" (quiet hours, daily cap, dry-run, send error).
async function dispatch(group, gameId, ev, ctx) {
  const now = new Date();
  const quiet = isQuietHour(cfg().quietStart, cfg().quietEnd, now);
  const spent = ev.urgent ? 0 : await sentSince(group.id, startOfLisbonDayIso());
  if (!ev.urgent && (quiet || spent >= cfg().maxPerDay)) return "blocked";

  const text = render(ev.kind, { ...ctx, link: linkFor(group) }, group.wa_bot_lang || "pt");
  if (!cfg().autosend) {
    if (!dryLogged.has(ev.key)) { dryLogged.add(ev.key); log(`[dry-run] ${group.name} · ${ev.kind}\n${text}\n`); }
    return "blocked"; // dry-run must not advance state, or the real run would miss it
  }
  const id = await claim(group.id, gameId, ev.kind, ev.key);
  if (!id) return "skipped"; // already announced
  try {
    await send(group.wa_group_jid, text);
    await markSent(id);
    log(`sent ${ev.kind} -> ${group.name}`);
    return "sent";
  } catch (e) {
    await unclaim(id); // retry next poll
    log("send failed, will retry:", e.message);
    return "blocked";
  }
}

async function tickGroup(group) {
  const now = new Date();
  for (const game of await upcomingGames(group.id)) {
    const spots = game.spots || group.max_players || 10;
    const prev = await getPrev(game.id);

    // Debounce count changes so a quick confirm+undo never reaches the group.
    if (prev !== null && game.confirmed !== prev) {
      const c = candidate.get(game.id);
      if (!c || c.n !== game.confirmed) { candidate.set(game.id, { n: game.confirmed }); continue; }
    }
    candidate.delete(game.id);

    let blocked = false;
    for (const ev of decide({ game, spots, confirmed: game.confirmed, prev, now })) {
      const r = await dispatch(group, game.id, ev, { game, spots, confirmed: game.confirmed });
      if (r === "blocked") { blocked = true; if (!ev.urgent) break; }
    }
    if (!blocked) await setPrev(game.id, game.confirmed);
  }

  // Post-game: one message per freshly finished matchday.
  for (const matchday of await recentMatchdays(group.id)) {
    for (const ev of decidePostGame({ matchday, now })) await dispatch(group, null, ev, { matchday });
  }
}

async function loop() {
  for (;;) {
    try {
      for (const g of await botGroups()) await tickGroup(g);
    } catch (e) { log("tick error:", e.message); }
    await sleep(cfg().pollMs);
  }
}

// -- who is this, and what may they do ---------------------------------------
const bare = (j) => j.split(":")[0].split("@")[0];

// Who wrote this? In groups WhatsApp may hand us a privacy id (@lid) instead of
// the phone number, so try every source and give up (safely) if none resolves.
async function senderPhone(m) {
  const cands = [m.key.participantAlt, m.key.participant, m.participant].filter(Boolean);
  const pn = cands.find((j) => j.endsWith("@s.whatsapp.net"));
  if (pn) return pn.split("@")[0].split(":")[0];
  const lid = cands.find((j) => j.endsWith("@lid"));
  if (lid) {
    try {
      const mapped = await sock.signalRepository?.lidMapping?.getPNForLID?.(lid);
      if (mapped) return String(mapped).split("@")[0].split(":")[0];
    } catch { /* fall through */ }
  }
  return null;
}

async function memberFor(group, m) {
  const phone = await senderPhone(m);
  if (!phone) { log("could not resolve sender phone (lid unmapped)"); return { members: [], me: null }; }
  const members = await groupMembers(group.id);
  const hits = members.filter((p) => phonesMatch(p.phone, phone));
  if (hits.length !== 1) log(`${hits.length} members match sender (phone ends …${String(phone).slice(-4)})`);
  return { members, me: hits.length === 1 ? hits[0] : null };
}

/**
 * Change ONLY the sender's own attendance, identified by phone, through the same
 * server rule as the magic link. Shared by chat commands and poll votes.
 * Returns { result, me?, pos?, c? }.
 */
async function applyAttendance({ group, game, spots, m, intent }) {
  if (!game || !["open", "full"].includes(game.status)) return { result: "no_game" };
  const { members, me } = await memberFor(group, m);
  if (!me) return { result: "not_found" };

  const before = splitWaitlist(await confirmedRoster(game.id, members), spots);
  const wasConfirmed = [...before.playing, ...before.waitlist].some((p) => p.id === me.id);
  if (intent === "confirm" && wasConfirmed) return { result: "already", me };

  if (!cfg().autosend) { log(`[dry-run] would ${intent} ${me.nick} on game ${game.id}`); return { result: "dry", me }; }
  try {
    await setStatus(me.token, intent === "confirm" ? "confirmed" : "declined", game.id);
  } catch (e) {
    if (/ainda n.o abriram/i.test(e.message)) return { result: "window", me };
    throw e;
  }
  log(`action: ${intent} ${me.nick} on game ${game.id}`);
  if (intent === "decline") return { result: "declined", me };
  const after = splitWaitlist(await confirmedRoster(game.id, members), spots);
  const pos = after.waitlist.findIndex((p) => p.id === me.id);
  return pos >= 0 ? { result: "waitlist", me, pos: pos + 1 } : { result: "confirmed", me, c: after.playing.length };
}

const nextGame = async (group) =>
  (await upcomingGames(group.id))
    .filter((g) => g.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] ?? null;

// "@Pitch eu vou" / "@Pitch I'm out"
async function handleAction({ group, game, spots, m, jid, intent, lang }) {
  const reply = (key, ctx = {}) => actionReplies[key][lang]({ link: linkFor(group), ...ctx });
  const say = async (text) => (cfg().autosend ? send(jid, text, m) : log(`[dry-run] @Pitch reply -> ${group.name}: ${text}`));

  const r = await applyAttendance({ group, game, spots, m, intent });
  switch (r.result) {
    case "no_game": return say(reply("no_game"));
    case "not_found": return say(reply("not_found"));
    case "already": return say(reply("already", { nick: r.me.nick }));
    case "window": return say(reply("window"));
    case "declined": return say(reply("declined", { nick: r.me.nick }));
    case "waitlist": return say(reply("waitlist", { nick: r.me.nick, pos: r.pos }));
    case "confirmed": return say(reply("confirmed", { nick: r.me.nick, c: r.c, s: spots }));
    default: return undefined; // dry-run
  }
}

// "@Pitch enquete": any registered member can ask the bot to post its attendance poll (max 1/hour).
async function handlePollCommand({ group, game, m, jid, lang }) {
  const reply = (key) => actionReplies[key][lang]({});
  const say = async (text) => (cfg().autosend ? send(jid, text, m) : log(`[dry-run] @Pitch reply -> ${group.name}: ${text}`));
  if (!game) return say(reply("no_game"));
  const { me } = await memberFor(group, m);
  if (!me) return say(actionReplies.not_found[lang]({ link: linkFor(group) }));
  if (!cfg().autosend) return log(`[dry-run] would post attendance poll for ${game.id} (asked by ${me.nick})`);
  const id = await claim(group.id, game.id, "game_poll", `game_poll:${game.id}:manual:${Math.floor(Date.now() / 36e5)}`);
  if (!id) return log("poll already posted this hour, ignoring");
  try { await sendPoll(group, game); await markSent(id); log(`sent game_poll (manual) -> ${group.name}`); }
  catch (e) { await unclaim(id); throw e; }
}

// -- polls: creation (learn the secret) and votes (attendance) ----------------
async function onPollMessage(m, inner) {
  const jid = m.key.remoteJid;
  if (!jid?.endsWith("@g.us")) return false;
  const created = polls.extractPoll(inner);
  const upd = inner?.pollUpdateMessage;
  if (!created && !upd) return false;
  const group = await groupByJid(jid);
  if (!group) return true;

  if (created && !m.key.fromMe) {
    const secret = created.secret ?? m.message?.messageContextInfo?.messageSecret;
    if (!secret) return log("poll seen without a secret, cannot read its votes"), true;
    polls.addPoll({ id: m.key.id, jid, name: created.name, options: created.options, secret, creators: uniq([m.key.participantAlt, m.key.participant, ...[m.key.participantAlt, m.key.participant].filter(Boolean).map(jidNormalizedUser)]), applies: null, fromMe: false });
    const applies = await pollApplies(created);
    polls.setApplies(m.key.id, applies);
    log(`poll seen in ${group.name}: "${created.name.slice(0, 60)}" -> ${applies ? "attendance poll (votes will count)" : "ignored (not about the game)"}`);
    return true;
  }

  if (upd) {
    const poll = polls.getPoll(upd.pollCreationMessageKey?.id);
    if (!poll) return log("vote on a poll the bot never saw created: cannot decrypt"), true;
    if (poll.applies === false) return true;
    const voters = uniq([m.key.participantAlt, m.key.participant, ...[m.key.participantAlt, m.key.participant].filter(Boolean).map(jidNormalizedUser)]);
    const sel = polls.decryptSelected(poll, upd.vote, { creators: poll.creators, voters });
    if (!sel) return log("could not decrypt a poll vote (jid form mismatch?)"), true;
    const intent = polls.voteIntent(sel.names);
    log(`vote in ${group.name}: [${sel.names.join(", ") || "none"}] -> ${intent ?? "no attendance meaning"}`);
    if (!intent) return true;
    if (cfg().autosend && !polls.noteVote(poll.id, sel.voterJid, intent)) return true; // unchanged vote

    const game = await nextGame(group);
    const spots = game?.spots || group.max_players || 10;
    const r = await applyAttendance({ group, game, spots, m, intent });
    const glang = group.wa_bot_lang || "pt";
    if (r.result === "window") {
      const k = `${poll.id}|${sel.voterJid}`;
      if (!windowWarned.has(k)) { windowWarned.add(k); await send(jid, actionReplies.window_named[glang]({ nick: r.me.nick })); }
    } else if (r.result === "not_found") {
      const k = `${poll.id}|${sel.voterJid}|nf`;
      if (!windowWarned.has(k)) {
        windowWarned.add(k);
        const who = m.key.participant || sel.voterJid;
        await typing(jid);
        await sock.sendMessage(jid, { text: actionReplies.vote_not_found[glang]({ tag: `@${bare(who)}`, link: linkFor(group) }), mentions: [who] });
      }
    }
    return true;
  }
  return true;
}

async function onMessage(m) {
  try {
    const jid = m.key.remoteJid;
    if (!jid?.endsWith("@g.us")) return;
    const inner = m.message?.ephemeralMessage?.message ?? m.message;
    if (await onPollMessage(m, inner)) return;
    if (m.key.fromMe) return;

    const ctx = inner?.extendedTextMessage?.contextInfo;
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(bare);
    // Addressed to the bot = an explicit @mention, or a reply to one of the bot's own messages.
    const mentionedMe = (ctx?.mentionedJid ?? []).some((j) => me.includes(bare(j)));
    const repliedToMe = !!ctx?.participant && me.includes(bare(ctx.participant));
    if (!mentionedMe && !repliedToMe) return;

    const group = await groupByJid(jid);
    if (!group) return;
    const sender = m.key.participant || jid;
    if (Date.now() - (lastAsk.get(sender) || 0) < 20000) return;
    lastAsk.set(sender, Date.now());

    const text = inner.extendedTextMessage.text.replace(/@\d+/g, "").trim() || "Como está o próximo jogo?";
    const game = await nextGame(group);
    const spots = game?.spots || group.max_players || 10;

    // parseIntent/parseCommand/classifyIntent only ever tell "pt" (not
    // specifically English) apart from "en" — they don't know about ptbr.
    // A non-English message must reply in the group's own base language
    // (pt or ptbr), not always Portugal Portuguese.
    const replyLang = (detected) => (detected === "en" ? "en" : (group.wa_bot_lang || "pt"));

    const cmd = parseCommand(text);
    if (cmd) return await handlePollCommand({ group, game, m, jid, lang: replyLang(cmd.lang) });

    // Strict phrases first (free, instant); otherwise let the model read natural wording.
    let action = parseIntent(text);
    if (!action) action = await classifyIntent(text).catch((e) => { log("intent classifier failed:", e.message); return null; });
    log(`addressed in ${group.name}: "${text.slice(0, 60)}" -> ${action ? action.intent : "question"}`);
    if (action) return await handleAction({ group, game, spots, m, jid, ...action, lang: replyLang(action.lang) });

    const reply = await answer({ question: text, game, spots, link: linkFor(group), groupId: group.id, lang: group.wa_bot_lang || "pt" });
    if (!reply) return;
    if (!cfg().autosend) return log(`[dry-run] @Pitch reply -> ${group.name}: ${reply}`);
    await send(jid, reply, m);
  } catch (e) { log("message error (ignored):", e.message); }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), markOnlineOnConnect: false, syncFullHistory: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", ({ messages: ms, type }) => { if (type === "notify") ms.forEach(onMessage); });
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const phone = (process.env.WA_PAIR_PHONE || "").replace(/\D/g, "");
      if (phone && !sock.authState.creds.registered) {
        // Pairing code instead of a QR: WhatsApp > Linked devices > Link with phone number.
        if (!pairing) { pairing = true; try { log(`PAIRING CODE: ${await sock.requestPairingCode(phone)}`); } catch (e) { pairing = false; log("pairing code failed:", e.message); } }
      } else {
        log("Scan this QR with the bot's phone (WhatsApp > Linked devices):"); qrcode.generate(qr, { small: true });
      }
    }
    if (connection === "open") {
      log(`connected as ${sock.user?.id} · autosend=${cfg().autosend}`);
      if (LIST_GROUPS) {
        const all = await sock.groupFetchAllParticipating();
        for (const g of Object.values(all)) console.log(`${g.id}  ${g.subject}`);
        process.exit(0);
      }
      if (!loopStarted) { loopStarted = true; loop(); }
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) { log("logged out - delete ./auth and re-scan. Not reconnecting."); process.exit(1); }
      log(`connection closed, reconnecting in 5s (code ${code})`);
      setTimeout(start, 5000);
    }
  });
}

start();
