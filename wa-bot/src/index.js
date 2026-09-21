// PITCH group bot — transport + poll loop.
// Sends only (a) state-change events and (b) replies to an explicit @mention.
// Dry-run unless BOT_AUTOSEND=true.
try { process.loadEnvFile(); } catch { /* no .env: rely on real env */ }

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { cfg } from "./config.js";
import { botGroups, upcomingGames, getPrev, setPrev, claim, markSent, unclaim, sentSince, recentMatchdays } from "./db.js";
import { decide, decidePostGame } from "./events.js";
import { render } from "./messages.js";
import { isQuietHour, lisbonDayKey } from "./time.js";
import { answer } from "./ask.js";

const LIST_GROUPS = process.argv.includes("--list-groups");
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 2000 + Math.random() * 6000; // look human, not a burst

let sock;
let loopStarted = false;
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

async function onMessage(m) {
  try {
    const jid = m.key.remoteJid;
    if (!jid?.endsWith("@g.us") || m.key.fromMe) return;
    const inner = m.message?.ephemeralMessage?.message ?? m.message;
    const mentioned = inner?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(bare);
    if (!mentioned.some((j) => me.includes(bare(j)))) return;

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
    const reply = await answer({ question: text, game, spots: game?.spots || group.max_players || 10, link: linkFor(group), groupId: group.id });
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
    if (qr) { log("Scan this QR with the bot's phone (WhatsApp > Linked devices):"); qrcode.generate(qr, { small: true }); }
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
