// PITCH group bot — transport + poll loop.
// Sends only (a) state-change events and (b) replies to an explicit @mention.
// Dry-run unless BOT_AUTOSEND=true.
try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { cfg } from "./config.js";
import { botGroups, upcomingGames, getPrev, setPrev, claim, markSent, unclaim, sentSince, recentMatchdays, groupMembers, confirmedRoster, setStatus } from "./db.js";
import { decide, decidePostGame } from "./events.js";
import { render } from "./messages.js";
import { isQuietHour, lisbonDayKey } from "./time.js";
import { answer, classifyIntent } from "./ask.js";
import { parseIntent, phonesMatch, splitWaitlist, actionReplies } from "./roster.js";

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

const linkFor = (g) => `${cfg().appUrl}/?join=${g.invite_token}`;
// Generous (<=1h early) start of today in Lisbon, for the daily cap.
const startOfLisbonDayIso = () => new Date(new Date(lisbonDayKey() + "T00:00:00Z").getTime() - 36e5).toISOString();

async function send(jid, text, quoted) {
  await sleep(jitter());
  await sock.sendPresenceUpdate("composing", jid);
  await sleep(600 + Math.random() * 1200);
  await sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
}

// One announcement: guards -> claim -> send. Returns "sent" | "skipped" | "blocked".
// "blocked" means "not now, retry next poll" (quiet hours, daily cap, dry-run, send error).
async function dispatch(group, gameId, ev, ctx) {
  const now = new Date();
  const quiet = isQuietHour(cfg().quietStart, cfg().quietEnd, now);
  const sentToday = ev.urgent ? 0 : await sentSince(group.id, startOfLisbonDayIso());
  if (!ev.urgent && (quiet || sentToday >= cfg().maxPerDay)) return "blocked";

  const text = render(ev.kind, { ...ctx, link: linkFor(group) }, group.wa_bot_lang || "pt");
  if (!cfg().autosend) {
    if (!dryLogged.has(ev.key)) { dryLogged.add(ev.key); log(`[dry-run] ${group.name} · ${ev.kind}
${text}
`); }
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

// -- @mention -> @Pitch answer -------------------------------------------
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

// "@Pitch eu vou" / "@Pitch I'm out": changes ONLY the sender's own attendance,
// identified by phone number, through the same server rule as the magic link.
async function handleAction({ group, game, spots, m, jid, intent, lang }) {
  const reply = (key, ctx = {}) => actionReplies[key][lang]({ link: linkFor(group), ...ctx });
  const say = async (text) => (cfg().autosend ? send(jid, text, m) : log(`[dry-run] @Pitch reply -> ${group.name}: ${text}`));

  if (!game || !["open", "full"].includes(game.status)) return say(reply("no_game"));

  const phone = await senderPhone(m);
  if (!phone) { log("action: could not resolve sender phone (lid unmapped)"); return say(reply("not_found")); }
  const members = await groupMembers(group.id);
  const hits = members.filter((p) => phonesMatch(p.phone, phone));
  if (hits.length !== 1) { log(`action: ${hits.length} members match sender`); return say(reply("not_found")); }
  const me = hits[0];

  const before = splitWaitlist(await confirmedRoster(game.id, members), spots);
  const wasConfirmed = [...before.playing, ...before.waitlist].some((p) => p.id === me.id);
  if (intent === "confirm" && wasConfirmed) return say(reply("already", { nick: me.nick }));

  if (!cfg().autosend) return log(`[dry-run] would ${intent} ${me.nick} on game ${game.id}`);
  try {
    await setStatus(me.token, intent === "confirm" ? "confirmed" : "declined", game.id);
  } catch (e) {
    if (/ainda n.o abriram/i.test(e.message)) return say(reply("window"));
    throw e;
  }

  log(`action: ${intent} ${me.nick} on game ${game.id}`);
  if (intent === "decline") return say(reply("declined", { nick: me.nick }));
  const after = splitWaitlist(await confirmedRoster(game.id, members), spots);
  const pos = after.waitlist.findIndex((p) => p.id === me.id);
  return say(pos >= 0
    ? reply("waitlist", { nick: me.nick, pos: pos + 1 })
    : reply("confirmed", { nick: me.nick, c: after.playing.length, s: spots }));
}


async function onMessage(m) {
  try {
    const jid = m.key.remoteJid;
    if (!jid?.endsWith("@g.us") || m.key.fromMe) return;
    const inner = m.message?.ephemeralMessage?.message ?? m.message;
    const ctx = inner?.extendedTextMessage?.contextInfo;
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(bare);
    // Addressed to the bot = an explicit @mention, or a reply to one of the bot's own messages.
    const mentionedMe = (ctx?.mentionedJid ?? []).some((j) => me.includes(bare(j)));
    const repliedToMe = !!ctx?.participant && me.includes(bare(ctx.participant));
    if (!mentionedMe && !repliedToMe) return;

    const group = (await botGroups()).find((g) => g.wa_group_jid === jid);
    if (!group) return;
    const sender = m.key.participant || jid;
    if (Date.now() - (lastAsk.get(sender) || 0) < 20000) return;
    lastAsk.set(sender, Date.now());

    const text = inner.extendedTextMessage.text.replace(/@\d+/g, "").trim() || "Como está o próximo jogo?";
    const games = (await upcomingGames(group.id))
      .filter((g) => g.status !== "cancelled")
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    const game = games[0] ?? null;
    const spots = game?.spots || group.max_players || 10;
    // Strict phrases first (free, instant); otherwise let the model read natural wording.
    let action = parseIntent(text);
    if (!action) action = await classifyIntent(text).catch((e) => { log("intent classifier failed:", e.message); return null; });
    log(`addressed in ${group.name}: "${text.slice(0, 60)}" -> ${action ? action.intent : "question"}`);
    if (action) return await handleAction({ group, game, spots, m, jid, ...action });

    const reply = await answer({ question: text, game, spots, link: linkFor(group), groupId: group.id });
    if (!reply) return;
    if (!cfg().autosend) return log(`[dry-run] @Pitch reply -> ${group.name}: ${reply}`);
    await send(jid, reply, m);
  } catch (e) { log("mention error (ignored):", e.message); }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), markOnlineOnConnect: false, syncFullHistory: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", ({ messages: ms, type }) => { if (type === "notify") ms.forEach(onMessage); });
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const phone = (process.env.WA_PAIR_PHONE || "").replace(/D/g, "");
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
