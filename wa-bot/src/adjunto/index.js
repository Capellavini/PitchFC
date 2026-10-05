// Treinador Adjunto — wiring. Builds the production env (Supabase store,
// read model, Anthropic SDK client, WhatsApp transport callbacks from
// index.js) and returns { onDirectMessage, onOwnMessage, tick }.
// Nothing here runs unless ADJUNTO_ENABLED=true (index.js checks first).
import Anthropic from "@anthropic-ai/sdk";
import * as store from "./store.js";
import { loadGroupCtx } from "./data.js";
import { makeRouter } from "./router.js";
import { makeTicker } from "./tick.js";
import { Takeover } from "./takeover.js";
import { cfg } from "../config.js";

/**
 * deps (from index.js):
 *   log, getSock, sendDm(target, text, meta), postGroup(group, gameId, ev, ctx),
 *   claim, markSent, unclaim, logMessage, suppressAutoReminder(group, game)
 */
export function createAdjunto(deps) {
  const c = cfg();
  const takeover = deps.takeover ?? new Takeover();
  const anthropic = c.anthropicKey ? new Anthropic({ apiKey: c.anthropicKey, timeout: 60_000, maxRetries: 2 }) : null;
  const env = {
    store, loadGroupCtx, cfg: c, log: deps.log, now: () => new Date(), rng: Math.random,
    sendDm: deps.sendDm, postGroup: deps.postGroup, claim: deps.claim, markSent: deps.markSent, unclaim: deps.unclaim,
    logMessage: deps.logMessage, suppressAutoReminder: deps.suppressAutoReminder,
    takeover, anthropic, lidMapping: () => deps.getSock()?.signalRepository?.lidMapping ?? null,
  };
  const router = makeRouter(env);
  const tick = makeTicker(env);
  deps.log(`adjunto: enabled · autosend=${c.adjuntoAutosend} · model=${c.adjuntoModel}${anthropic ? "" : " · NO ANTHROPIC KEY (commands only)"}`);
  return { onDirectMessage: router.onDirectMessage, onOwnMessage: router.onOwnMessage, tick, takeover };
}
