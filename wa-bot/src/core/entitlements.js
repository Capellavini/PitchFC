// GENERATED from src/lib/core — do not edit; run npm run sync:core
// Plan entitlements — the ONE place that says which plan unlocks what.
// Pure ESM, no i18n, no React: shared verbatim with the wa-bot
// (scripts/sync-core.mjs copies it to wa-bot/src/core/).
//
// Mirrors supabase/migrations/20261019092955_plan_entitlements.sql:
//   no row / canceled / ends_at in the past ⇒ free; past_due keeps the plan.
//
// Approved matrix (Vini, 2026-10-19). Free keeps the whole weekly game:
// slot grid, one-tap confirm, waitlist, team draw, live Matchday, results,
// MVP, PITCH ID/card, season stats & rankings, Golo da Semana, Pitch VAR,
// the bot's "Partida aberta" (game_open) post, manual paid tracking,
// 1 organizer, up to 20 players (SOFT cap — nobody is ever blocked from
// joining or confirming). Teams (Rivals) and Leagues are not gated.

export const PLAN_RANK = Object.freeze({ free: 0, club: 1, club_ai: 2 });
export const GROUP_PLANS = Object.freeze(Object.keys(PLAN_RANK));

/** feature id → minimum group plan. Anything not listed is free. */
export const FEATURES = Object.freeze({
  co_organizers: "club",        // more than one organizer / assistant (auxiliar)
  fantasy: "club",              // Pitch Manager / Fantasy league
  payment_reminders: "club",    // charge reminders over WhatsApp
  payment_history: "club",
  mbway_button: "club",         // in-app "Pagar · MB Way" button
  bot_automation: "club",       // every bot message except game_open
  advanced_stats: "club",       // player comparison, advanced group stats, export
  unlimited_history: "club",
  large_group: "club",          // more than 20 players (soft)
  adjunto: "club_ai",           // Treinador Adjunto (WhatsApp DM AI)
});
export const FEATURE_IDS = Object.freeze(Object.keys(FEATURES));

/** Player limits per plan. Free is a SOFT cap (banner, never a block). */
export const PLAYER_LIMITS = Object.freeze({ free: 20, club: 30, club_ai: 30, large: 60 });

/** Bot message kinds a Free group still gets. Everything else is Club automation. */
// game_open + cancelled: a Free group must always learn the game is on or off.
export const FREE_BOT_KINDS = Object.freeze(["game_open", "cancelled"]);

const DAY = 864e5;

/**
 * Effective entitlement from a stored plan row (group_plans shape, or the
 * group_entitlement() RPC result) at `now`.
 *   → { plan, status, source, endsAt, daysLeft, expired, storedPlan }
 * `plan` is the EFFECTIVE plan: expired / canceled ⇒ "free".
 */
export function effectivePlan(row, now = new Date()) {
  if (!row || !row.plan || !(row.plan in PLAN_RANK)) {
    return { plan: "free", status: "active", source: row?.source ?? null, endsAt: null, daysLeft: null, expired: false, storedPlan: row?.plan ?? null };
  }
  const endsAt = row.ends_at ?? row.endsAt ?? null;
  const end = endsAt ? new Date(endsAt) : null;
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const lapsed = row.status === "canceled" || row.status === "expired" || (end && end.getTime() <= t);
  const expired = Boolean(lapsed) && row.plan !== "free";
  return {
    plan: lapsed ? "free" : row.plan,
    status: expired ? "expired" : (row.status ?? "active"),
    source: row.source ?? null,
    endsAt: end ? end.toISOString() : null,
    daysLeft: end && !lapsed ? Math.max(0, Math.ceil((end.getTime() - t) / DAY)) : null,
    expired,
    storedPlan: row.stored_plan ?? row.storedPlan ?? row.plan,
  };
}

/** Normalises anything plan-like (entitlement object, row, plan id) to a plan id. */
export function planOf(ent) {
  const p = typeof ent === "string" ? ent : ent?.plan;
  return Object.hasOwn(PLAN_RANK, p ?? "") ? p : "free";
}

/** Minimum plan for a feature ("free" when the feature isn't gated). */
export const requiredPlan = (feature) => FEATURES[feature] ?? "free";

/** Does this entitlement unlock the feature? Unknown features are free. */
export const can = (feature, ent) => PLAN_RANK[planOf(ent)] >= PLAN_RANK[requiredPlan(feature)];

/** Soft player limit for the group's plan. */
export const playerLimit = (ent) => PLAYER_LIMITS[planOf(ent)] ?? PLAYER_LIMITS.free;

/** True when a Free group has gone past its soft cap (show the organizer a banner). */
export const overSoftCap = (playerCount, ent) => planOf(ent) === "free" && playerCount > PLAYER_LIMITS.free;

/** May the bot send this automated message kind to a group on this plan? */
export const botKindAllowed = (kind, ent) => FREE_BOT_KINDS.includes(kind) || can("bot_automation", ent);

/**
 * What the organizer chip should say (no copy here — ids + numbers only).
 * Takes an entitlement from effectivePlan().
 *   founder_forever                         → { kind: "forever", plan }
 *   founder (active)                        → { kind: "founder", plan, endsAt }
 *   trialing                                → { kind: "trial", plan, daysLeft }
 *   any other paid (manual/stripe)          → { kind: "paid", plan, endsAt }
 *   free / expired                          → { kind: "free", plan: "free", expired }
 */
export function planBadge(ent) {
  const e = ent ?? effectivePlan(null);
  if (e.plan === "free") return { kind: "free", plan: "free", expired: Boolean(e.expired) };
  if (e.source === "founder_forever" || (e.source === "founder" && !e.endsAt)) return { kind: "forever", plan: e.plan };
  if (e.source === "founder") return { kind: "founder", plan: e.plan, endsAt: e.endsAt, daysLeft: e.daysLeft };
  if (e.status === "trialing" || e.source === "trial") return { kind: "trial", plan: e.plan, daysLeft: e.daysLeft, endsAt: e.endsAt };
  return { kind: "paid", plan: e.plan, endsAt: e.endsAt, daysLeft: e.daysLeft };
}

/** Trial about to end (≤ `days` left) — the one-time gentle banner. */
export const trialEndingSoon = (ent, days = 3) => {
  const b = planBadge(ent);
  return b.kind === "trial" && b.daysLeft != null && b.daysLeft <= days;
};
