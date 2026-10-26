// ── Pitch Manager money helpers ─────────────────────────────
// Scoring, prices by form, ownership cap and transfers moved to the
// server in v2 (migration 20261019180559_fantasy_v2_foundation) and are
// mirrored for previews/demo in src/lib/core/fantasyRules.js. What's left
// here is display + cost-basis bookkeeping for the bank previews.
import { getLang } from "./i18n.js";

/** Money display — everything in millions. PT-PT/PT-BR: "120,0 M" (no
 *  currency: it's a game budget, not money); EN keeps FPL-style "$120.0M". */
export const fmtM = (n, lang = getLang()) => {
  const v = (Number(n) || 0).toFixed(1);
  return String(lang || "pt").startsWith("en") ? `$${v}M` : `${v.replace(".", ",")} M`;
};

/** Next per-player cost basis for a squad moving to `newPlayerIds`: kept
 *  players keep what was actually paid; new picks cost today's price.
 *  Mirrors save_fantasy_squad's prices_paid. */
export function nextPricesPaid(prevPricesPaid, newPlayerIds, priceOf) {
  const next = {};
  (newPlayerIds || []).forEach((id) => {
    next[id] = prevPricesPaid?.[id] ?? priceOf(id);
  });
  return next;
}

/** Sum of a squad's per-player cost basis. */
export const squadCostBasis = (pricesPaid) =>
  Object.values(pricesPaid || {}).reduce((s, v) => s + (Number(v) || 0), 0);
