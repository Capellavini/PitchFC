// PITCH Ligas on WhatsApp — wiring. Builds the production env (Supabase store,
// Anthropic client, the transport callbacks from index.js) and returns
// { onDirectMessage }. Nothing here runs unless LEAGUE_WA_ENABLED=true
// (index.js checks first), so with the flag off the bot behaves exactly as before.
import Anthropic from "@anthropic-ai/sdk";
import * as store from "./store.js";
import { makeLeagueHandler } from "./handler.js";
import { cfg } from "../config.js";

export const MAX_MEDIA_BYTES = 2_400_000;

/**
 * deps (from index.js): log, getSock(), send(jid, text), download(message) → Buffer
 */
export function createLeagueBot(deps) {
  const c = cfg();
  const anthropic = c.anthropicKey ? new Anthropic({ apiKey: c.anthropicKey, timeout: 90_000, maxRetries: 2 }) : null;
  const env = {
    store, cfg: c, log: deps.log, now: () => new Date(), anthropic, send: deps.send,
    lidMapping: () => deps.getSock()?.signalRepository?.lidMapping ?? null,
    /** The photo or PDF of a message as { media_type, data(base64), name }, or null when it is too big / not readable. */
    async downloadMedia(m, attach) {
      if (attach.bytes && attach.bytes > MAX_MEDIA_BYTES) return null;
      const buf = await deps.download(m);
      if (!buf?.length || buf.length > MAX_MEDIA_BYTES) return null;
      return { media_type: attach.mime === "image/jpg" ? "image/jpeg" : attach.mime, data: Buffer.from(buf).toString("base64"), name: attach.name };
    },
  };
  deps.log(`league wa: enabled · autosend=${c.leagueWaAutosend} · model=${c.leagueModel}${anthropic ? "" : " · NO ANTHROPIC KEY (links only)"}`);
  return makeLeagueHandler(env);
}
