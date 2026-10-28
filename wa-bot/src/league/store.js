// PITCH Ligas on WhatsApp — every Supabase read/write, in one place (service
// role). Tables: league_wa_links / league_wa_pending (bot-private) and the
// league document through the league_wa_* RPCs (migration
// 20261028220000_league_whatsapp.sql). The league is written ONLY through
// league_workspace_write, the same path and version check the app uses.
import { db } from "../db.js";

const one = async (q) => { const { data, error } = await q; if (error) throw error; return data; };
const nowIso = () => new Date().toISOString();

// ── link ──────────────────────────────────────────────────
export async function findLink({ jids = [], pn = null }) {
  if (jids.length) {
    const byJid = await one(db().from("league_wa_links").select("*").in("wa_jid", jids).limit(1));
    if (byJid?.length) return byJid[0];
    const byLid = await one(db().from("league_wa_links").select("*").in("wa_lid", jids).limit(1));
    if (byLid?.length) return byLid[0];
  }
  if (pn) {
    const byPn = await one(db().from("league_wa_links").select("*").eq("wa_pn", pn).limit(2));
    if (byPn?.length === 1) return byPn[0];
  }
  return null;
}

/** Consumes a LIGA-XXXXXX code and links the sender → the account's user id, or null (invalid, used, expired). */
export async function consumeCode(code, { jid, lid = null, pn = null }) {
  const { data, error } = await db().rpc("league_wa_consume_code", { p_code: code, p_jid: jid, p_lid: lid, p_pn: pn });
  if (error) throw error;
  return data ?? null;
}

export const touchLink = (userId) => one(db().from("league_wa_links").update({ last_inbound_at: nowIso() }).eq("user_id", userId));
export const deleteLink = (userId) => one(db().from("league_wa_links").delete().eq("user_id", userId));

// ── the league ────────────────────────────────────────────
/** { version, state, slug, published } or null when the account has no league yet. */
export async function workspaceOf(userId) {
  const { data, error } = await db().rpc("league_wa_workspace_of", { p_user: userId });
  if (error) throw error;
  return data ?? null;
}

/** → { version } or { error: "version_conflict" | … }. */
export async function writeWorkspace(userId, state, expectedVersion) {
  const { data, error } = await db().rpc("league_workspace_write", { p_user: userId, p_state: state, p_expected: expectedVersion });
  if (error) return { error: /league:([a-z_]+)/.exec(error.message || "")?.[1] || "unknown" };
  return { version: data?.version };
}

/** One model call of the day for this account (cap in the function). */
export async function takeSlot(userId) {
  const { data, error } = await db().rpc("league_wa_take_slot", { p_user: userId });
  if (error) throw error;
  return data === true;
}

// ── proposals waiting for "sim" ───────────────────────────
export async function pendingFor(userId) {
  const rows = await one(db().from("league_wa_pending").select("*").eq("user_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(1));
  return rows?.[0] ?? null;
}

/** Replaces whatever was waiting: only the newest proposal can be confirmed. */
export async function addPending(userId, items, summary) {
  await one(db().from("league_wa_pending").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "pending"));
  const rows = await one(db().from("league_wa_pending").insert({ user_id: userId, items, summary }).select());
  return rows[0];
}

export const settlePending = (id, status) => one(db().from("league_wa_pending").update({ status }).eq("id", id).eq("status", "pending"));
