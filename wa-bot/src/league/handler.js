// PITCH Ligas on WhatsApp — the Adjunto of a league manager, in a DM.
//
// Same brain as the app chat: the proposal catalog, the request contract and
// the system prompt are the app's own files (src/leaguelib, synced from
// src/lib). The model only PROPOSES; names are resolved in code; the Gestor
// sees a summary and nothing touches the league until "sim". The league is the
// cloud document the app saves (written through league_workspace_write with
// its version, so the app and the bot never overwrite each other silently).
//
// Everything with side effects goes through `env` (see index.js), so this is
// tested end to end with fakes.
import { resolveDmIdentity, isDmJid, maskJid } from "../adjunto/identity.js";
import { parseYesNo } from "../adjunto/commands.js";
import { ADJUNTO_SYSTEM, adjuntoTools, modelMessages, parseAdjuntoReply, validateAdjuntoRequest } from "../leaguelib/leagueAdjuntoRequest.js";
import { prepareBatch, adjuntoContext } from "../leaguelib/leagueAdjuntoActions.js";
import { LEAGUE_TEXT as T } from "./texts.js";

export const LEAGUE_CODE = /\bLIGA-([A-HJ-NP-Z2-9]{6})\b/i;
const WHATSAPP_NOTE = "Estás no WhatsApp: respostas curtas (no máximo 5 linhas), sem tabelas nem markdown pesado. Quando propuseres algo, diz numa frase o que percebeste; o resumo e a confirmação são mostrados à parte pelo sistema. Se faltar um dado, faz UMA pergunta curta. Para ecrãs da app não uses open_screen: a pessoa usa pitch-fc.com/league/minhas.";

/** Text of a DM (plain, extended, captions; ephemeral unwrapped). */
export function messageText(m) {
  const inner = m?.message?.ephemeralMessage?.message ?? m?.message;
  return (inner?.conversation ?? inner?.extendedTextMessage?.text ?? inner?.imageMessage?.caption ?? inner?.documentMessage?.caption ?? inner?.videoMessage?.caption ?? "").trim();
}

/** The image or PDF attached to a message, if any (not downloaded yet). */
export function mediaOf(m) {
  const inner = m?.message?.ephemeralMessage?.message ?? m?.message;
  if (inner?.imageMessage) return { kind: "image", mime: inner.imageMessage.mimetype || "image/jpeg", bytes: Number(inner.imageMessage.fileLength) || 0 };
  const d = inner?.documentMessage;
  if (d && (d.mimetype === "application/pdf" || /^image\/(jpeg|png|webp)$/.test(d.mimetype || ""))) return { kind: "document", mime: d.mimetype, bytes: Number(d.fileLength) || 0, name: d.fileName };
  return null;
}

const sumLines = (items) => items.map((i) => (i.ok ? `✅ ${i.line}` : `❌ ${i.line} — ${i.error}`)).join("\n");

export function makeLeagueHandler(env) {
  const locks = new Map();
  const withLock = (key, fn) => {
    const prev = locks.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    locks.set(key, next);
    next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
    return next;
  };
  const lidMapping = () => env.lidMapping?.() ?? null;

  async function link(id, code) {
    const user = await env.store.consumeCode(code, { jid: id.chatJid, lid: id.lid, pn: id.pn });
    if (!user) { env.log(`league wa: invalid/expired code from ${maskJid(id.chatJid)}`); return env.send(id.chatJid, T.codeInvalid); }
    env.log(`league wa: linked account ${String(user).slice(0, 8)} (${maskJid(id.chatJid)})`);
    const ws = await env.store.workspaceOf(user);
    return env.send(id.chatJid, ws ? T.welcome(ws.state?.data?.league?.name) : T.noLeague);
  }

  async function decide(lk, id, yn) {
    const pend = await env.store.pendingFor(lk.user_id);
    if (!pend) return env.send(id.chatJid, T.nothingPending);
    if (Date.parse(pend.expires_at) < env.now().getTime()) { await env.store.settlePending(pend.id, "expired"); return env.send(id.chatJid, T.expired); }
    if (yn === "no") { await env.store.settlePending(pend.id, "cancelled"); return env.send(id.chatJid, T.cancelled); }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ws = await env.store.workspaceOf(lk.user_id);
      if (!ws) return env.send(id.chatJid, T.noLeague);
      // Re-run on the league as it is NOW: the app may have changed it since the summary.
      const batch = prepareBatch(ws.state, pend.items);
      if (!batch.applied) { await env.store.settlePending(pend.id, "cancelled"); return env.send(id.chatJid, T.nothingApplicable(sumLines(batch.items))); }
      const w = await env.store.writeWorkspace(lk.user_id, batch.state, ws.version);
      if (w.error === "version_conflict") continue;
      if (w.error) { env.log(`league wa: write failed (${w.error})`); return env.send(id.chatJid, T.writeFailed); }
      await env.store.settlePending(pend.id, "applied");
      const hasResult = batch.items.some((i) => i.ok && i.kind === "record_result");
      return env.send(id.chatJid, T.applied(batch.applied, sumLines(batch.items), hasResult));
    }
    return env.send(id.chatJid, T.conflict);
  }

  async function ask(lk, id, text, media) {
    if (!env.anthropic) return env.send(id.chatJid, T.aiOff);
    const ws = await env.store.workspaceOf(lk.user_id);
    if (!ws) return env.send(id.chatJid, T.noLeague);
    const state = ws.state;
    if (!state?.data || !Array.isArray(state.matches) || !state.logs) return env.send(id.chatJid, T.badState);
    let input;
    try {
      input = validateAdjuntoRequest({
        messages: [{ role: "user", text: (text || "Lê o documento e diz-me o que encontras.").slice(0, 1500) }],
        attachments: media ? [{ kind: "media", name: media.name || "sumula", media_type: media.media_type, data: media.data }] : [],
        context: adjuntoContext(state, { now: env.now().getTime() }),
      });
    } catch { return env.send(id.chatJid, T.invalidMedia); }
    if (!(await env.store.takeSlot(lk.user_id))) return env.send(id.chatJid, T.limit);
    let result;
    try {
      result = await env.anthropic.messages.create({
        model: env.cfg.leagueModel, max_tokens: 6000, system: `${ADJUNTO_SYSTEM}\n${WHATSAPP_NOTE}`,
        tools: adjuntoTools(), tool_choice: { type: "auto" }, messages: modelMessages(input),
      });
    } catch (e) { env.log("league wa: model error:", e?.message); return env.send(id.chatJid, T.modelDown); }
    if (result.stop_reason === "refusal") return env.send(id.chatJid, T.notUnderstood);
    const reply = parseAdjuntoReply(result.content);
    if (!reply.proposals.length) return env.send(id.chatJid, reply.text || T.notUnderstood);
    const batch = prepareBatch(state, reply.proposals);
    if (!batch.applied) return env.send(id.chatJid, `${reply.text ? `${reply.text}\n\n` : ""}${T.nothingApplicable(sumLines(batch.items))}`);
    // Only what works is kept for the "sim"; what doesn't is shown, with the reason, so it can be said again.
    const keep = reply.proposals.filter((_, i) => batch.items[i]?.ok);
    const summary = sumLines(batch.items);
    await env.store.addPending(lk.user_id, keep, summary);
    return env.send(id.chatJid, T.summary(summary, reply.text));
  }

  async function handleLinked(lk, id, text, m) {
    await env.store.touchLink(lk.user_id).catch(() => {});
    const yn = parseYesNo(text);
    if (yn) return decide(lk, id, yn);
    const n = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim();
    if (["ajuda", "help", "menu"].includes(n)) return env.send(id.chatJid, T.help);
    if (n === "desligar") { await env.store.deleteLink(lk.user_id); return env.send(id.chatJid, T.unlinked); }
    const attach = mediaOf(m);
    let media = null;
    if (attach) {
      media = await env.downloadMedia(m, attach).catch((e) => { env.log("league wa: media download failed:", e?.message); return null; });
      if (!media) return env.send(id.chatJid, T.invalidMedia);
    }
    if (!text && !media) return undefined;
    return ask(lk, id, text, media);
  }

  /** @returns {Promise<boolean>} true when the message belongs to the league Adjunto (so the weekly-groups one stays out of it). */
  async function onDirectMessage(m) {
    const jid = m?.key?.remoteJid;
    if (!isDmJid(jid) || m.key.fromMe) return false;
    const text = messageText(m);
    const id = await resolveDmIdentity(m.key, lidMapping());
    const code = LEAGUE_CODE.exec(text)?.[0]?.toUpperCase() ?? null;
    const lk = await env.store.findLink({ jids: id.jids, pn: id.pn });
    if (!lk) {
      if (!code) return false; // not ours: the weekly-groups Adjunto continues
      await withLock(id.chatJid, () => link(id, code));
      return true;
    }
    if (!lk.enabled) return true;
    await withLock(lk.user_id, async () => {
      try {
        if (code) return await link(id, code);
        return await handleLinked(lk, id, text, m);
      } catch (e) {
        env.log("league wa: error:", e?.message);
        return env.send(id.chatJid, T.modelDown).catch(() => {});
      }
    });
    return true;
  }

  return { onDirectMessage };
}
