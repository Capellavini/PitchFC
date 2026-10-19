// Group plans for the bot (migration 20261019092955_plan_entitlements.sql).
// Reads group_plans with the service role, caches per group for a few
// minutes, and answers the two questions the bot asks:
//   allowsKind(groupId, kind)  → Free groups only get "game_open"
//   hasAdjunto(groupId)        → Treinador Adjunto needs Club + AI
// The plan rules themselves live in core/entitlements.js (shared with the app).
//
// FAIL OPEN: if the read fails (e.g. the migration isn't live yet, or a
// network blip) the group is treated as Club + AI — the bot behaves exactly
// as it did before plans existed. Logged once per group per TTL.
import { effectivePlan, botKindAllowed, can } from "./core/entitlements.js";

export const PLAN_TTL_MS = 5 * 60 * 1000;

/**
 * deps: fetchRow(groupId) → group_plans row | null (throws on error),
 *       now() → Date, log(...), ttlMs.
 */
export function makePlans({ fetchRow, now = () => new Date(), log = () => {}, ttlMs = PLAN_TTL_MS } = {}) {
  const cache = new Map(); // groupId -> { at, ent }

  async function entitlement(groupId) {
    const t = now();
    const hit = cache.get(groupId);
    if (hit && t.getTime() - hit.at < ttlMs) return hit.ent;
    let ent;
    try {
      ent = effectivePlan(await fetchRow(groupId), t);
    } catch (e) {
      log(`plans: could not read plan for ${String(groupId).slice(0, 8)} (${e?.message ?? e}) — failing open`);
      ent = { plan: "club_ai", status: "unknown", failOpen: true };
    }
    cache.set(groupId, { at: t.getTime(), ent });
    return ent;
  }

  return {
    entitlement,
    allowsKind: async (groupId, kind) => botKindAllowed(kind, await entitlement(groupId)),
    hasAdjunto: async (groupId) => can("adjunto", await entitlement(groupId)),
    clear: () => cache.clear(),
  };
}

/** Production fetcher: the group's group_plans row via the service role. */
export async function fetchGroupPlanRow(groupId) {
  const { db } = await import("./db.js");
  const { data, error } = await db().from("group_plans")
    .select("plan, status, source, ends_at").eq("group_id", groupId).maybeSingle();
  if (error) throw error;
  return data ?? null;
}
