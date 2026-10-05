// Treinador Adjunto — every Supabase read/write the Adjunto does, in one
// place (service role). Bot-private tables: adjunto_*, attendance_log.
// Shared app tables are written ONLY with the same columns/RPCs the app
// uses (plan §7.3), so the app reflects them through realtime.
import { db } from "../db.js";

const one = async (q) => { const { data, error } = await q; if (error) throw error; return data; };
const nowIso = () => new Date().toISOString();

// ── links / codes ─────────────────────────────────────────
export async function findLink({ jids = [], pn = null }) {
  if (jids.length) {
    const byJid = await one(db().from("adjunto_links").select("*").in("wa_jid", jids).limit(1));
    if (byJid?.length) return byJid[0];
    const byLid = await one(db().from("adjunto_links").select("*").in("wa_lid", jids).limit(1));
    if (byLid?.length) return byLid[0];
  }
  if (pn) {
    const byPn = await one(db().from("adjunto_links").select("*").eq("wa_pn", pn).limit(2));
    if (byPn?.length === 1) return byPn[0];
  }
  return null;
}

export const updateLink = (id, fields) => one(db().from("adjunto_links").update(fields).eq("id", id).select().single());

/** Create or move the link for a player (the code/phone is the proof). A jid
 *  already linked to ANOTHER player is released first (number changed hands). */
export async function upsertLink({ playerId, waJid, waLid, waPn, activeGroupId }) {
  const row = { player_id: playerId, wa_jid: waJid, wa_lid: waLid ?? null, wa_pn: waPn ?? null, active_group_id: activeGroupId ?? null, enabled: true, linked_at: nowIso() };
  await db().from("adjunto_links").delete().eq("wa_jid", waJid).neq("player_id", playerId);
  if (waLid) await db().from("adjunto_links").delete().eq("wa_lid", waLid).neq("player_id", playerId);
  return one(db().from("adjunto_links").upsert(row, { onConflict: "player_id" }).select().single());
}

/** Atomically consume a valid code. Returns the code row, or null if
 *  unknown/used/expired. `peek` tells expired/used apart for the reply. */
export async function consumeCode(code, jid) {
  const rows = await one(db().from("adjunto_link_codes").update({ used_at: nowIso(), used_jid: jid })
    .eq("code", code).is("used_at", null).gt("expires_at", nowIso()).select());
  return rows?.[0] ?? null;
}

export async function countDmReplies(jid, kind, sinceIso) {
  const { count } = await db().from("adjunto_dm_replies").select("id", { count: "exact", head: true })
    .eq("jid", jid).eq("kind", kind).gte("created_at", sinceIso);
  return count ?? 0;
}
export const noteDmReply = (jid, kind) => one(db().from("adjunto_dm_replies").insert({ jid, kind }));

export async function findOrganizerByPhone(digits) {
  const { data, error } = await db().rpc("adjunto_find_organizer_by_phone", { p_digits: digits });
  if (error) throw error;
  return data ?? [];
}

// ── groups / memberships ──────────────────────────────────
export async function membership(playerId, groupId) {
  return one(db().from("player_group_memberships").select("role, banned").eq("player_id", playerId).eq("group_id", groupId).maybeSingle());
}

/** Groups this player manages that have the Adjunto enabled. */
export async function managedGroups(playerId) {
  const rows = await one(db().from("player_group_memberships")
    .select("group_id, role, banned, groups(id, name, adjunto_enabled, wa_bot_lang)")
    .eq("player_id", playerId).in("role", ["organizer", "assistant"]).eq("banned", false));
  return (rows ?? []).filter((r) => r.groups?.adjunto_enabled).map((r) => ({ id: r.groups.id, name: r.groups.name, lang: r.groups.wa_bot_lang, role: r.role }));
}

export const groupRow = (id) => one(db().from("groups").select("*").eq("id", id).maybeSingle());
export const playerRow = (id) => one(db().from("players").select("id, nick, name, phone").eq("id", id).maybeSingle());

/** Every enabled link whose player manages ≥1 adjunto-enabled group. */
export async function activeLinks() {
  return (await one(db().from("adjunto_links").select("*").eq("enabled", true))) ?? [];
}

// ── threads (conversation state) ──────────────────────────
export async function getThread(linkId) {
  const row = await one(db().from("adjunto_threads").select("*").eq("link_id", linkId).maybeSingle());
  return row ?? { link_id: linkId, mode: "idle", step: null, draft: {}, version: -1 };
}

/** Optimistic write: returns false if someone else wrote first. */
export async function saveThread(thread, { mode, step = null, draft = {} }) {
  if (thread.version < 0) {
    const { error } = await db().from("adjunto_threads").insert({ link_id: thread.link_id, mode, step, draft, version: 0 });
    if (error?.code === "23505") return false;
    if (error) throw error;
    return true;
  }
  const rows = await one(db().from("adjunto_threads").update({ mode, step, draft, version: thread.version + 1, updated_at: nowIso() })
    .eq("link_id", thread.link_id).eq("version", thread.version).select("link_id"));
  return Boolean(rows?.length);
}

// ── conversation memory ───────────────────────────────────
export const appendMessage = (linkId, groupId, role, content) =>
  one(db().from("adjunto_messages").insert({ link_id: linkId, group_id: groupId ?? null, role, content: String(content).slice(0, 4000) }));

export async function recentMessages(linkId, { limit = 12, days = 7 } = {}) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = await one(db().from("adjunto_messages").select("role, content, created_at")
    .eq("link_id", linkId).gte("created_at", since).order("created_at", { ascending: false }).limit(limit));
  return (rows ?? []).reverse();
}

// ── proposals (two-phase writes) ──────────────────────────
/** New pending proposal; a pending one of the same kind/link/game is
 *  superseded first (the unique partial index enforces one). */
export async function createProposal({ linkId, groupId, gameId = null, cycle = null, kind, payload, precondition = {}, expiresAt }) {
  let q = db().from("adjunto_proposals").update({ status: "superseded", decided_at: nowIso() })
    .eq("link_id", linkId).eq("kind", kind).eq("status", "pending");
  q = gameId ? q.eq("game_id", gameId) : q.is("game_id", null);
  await one(q);
  return one(db().from("adjunto_proposals").insert({ link_id: linkId, group_id: groupId, game_id: gameId, cycle, kind, payload, precondition, expires_at: expiresAt }).select().single());
}

export async function pendingProposals(linkId) {
  const rows = await one(db().from("adjunto_proposals").select("*").eq("link_id", linkId).eq("status", "pending").order("created_at", { ascending: false }));
  const now = Date.now(), live = [];
  for (const p of rows ?? []) {
    if (new Date(p.expires_at).getTime() < now) await setProposalStatus(p.id, "expired");
    else live.push(p);
  }
  return live;
}

export const pendingForGame = (gameId, kind) =>
  one(db().from("adjunto_proposals").select("*").eq("game_id", gameId).eq("kind", kind).eq("status", "pending"));

export const updateProposal = (id, fields) => one(db().from("adjunto_proposals").update(fields).eq("id", id).select().single());

/** Status change only if still pending (so two approvals can't both win). Returns the row or null. */
export async function setProposalStatus(id, status, { decidedBy = null, error = null } = {}) {
  const rows = await one(db().from("adjunto_proposals").update({ status, decided_at: nowIso(), decided_by: decidedBy, error })
    .eq("id", id).eq("status", "pending").select());
  return rows?.[0] ?? null;
}

/** This link's proposals for a game (any status), newest first. */
export const gameProposals = (linkId, gameId) =>
  one(db().from("adjunto_proposals").select("id, kind, status, error, cycle, decided_at, created_at, payload")
    .eq("link_id", linkId).eq("game_id", gameId).order("created_at", { ascending: false }).limit(50));

/** Non-urgent proactive DMs claimed for this link since `sinceIso`. */
export async function countProactiveSince(linkId, sinceIso, urgentKinds = []) {
  let q = db().from("bot_announcements").select("id", { count: "exact", head: true })
    .like("dedupe_key", `adj:%:${linkId}%`).gte("created_at", sinceIso);
  if (urgentKinds.length) q = q.not("kind", "in", `(${urgentKinds.join(",")})`);
  const { count } = await q;
  return count ?? 0;
}

// ── usage ─────────────────────────────────────────────────
export const getUsage = (day, playerId) =>
  one(db().from("adjunto_usage").select("*").eq("day", day).eq("player_id", playerId).maybeSingle());

export async function saveUsage(day, playerId, row) {
  const { day: _d, player_id: _p, ...rest } = row;
  return one(db().from("adjunto_usage").upsert({ day, player_id: playerId, ...rest }, { onConflict: "day,player_id" }));
}

export async function globalUsdMicros(day) {
  const rows = await one(db().from("adjunto_usage").select("usd_micros").eq("day", day));
  return (rows ?? []).reduce((s, r) => s + Number(r.usd_micros || 0), 0);
}

// ── data the tools read ───────────────────────────────────
export async function attendanceLog(groupId, sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  return (await one(db().from("attendance_log").select("player_id, cycle_opened_at, status, at, kickoff")
    .eq("group_id", groupId).gte("at", since).order("at", { ascending: true }).limit(5000))) ?? [];
}

export async function teamsMd5(gameId) {
  const { data, error } = await db().rpc("adjunto_teams_md5", { p_game_id: gameId });
  if (error) throw error;
  return data;
}

/** Same columns as the app's updateGameTeams/confirmGameTeams, with CAS. */
export async function applyTeams({ gameId, teams, expectedMd5, actor, confirm }) {
  const { data, error } = await db().rpc("adjunto_apply_teams", { p_game_id: gameId, p_teams: teams, p_expected_md5: expectedMd5, p_actor: actor, p_confirm: confirm });
  if (error) throw error;
  return data;
}

// ── shared app writes (mirror useCloud.js) ────────────────
/** useCloud.updateGroupRow({ game_format }) */
export const setGameFormat = (groupId, format) => one(db().from("groups").update({ game_format: format }).eq("id", groupId));

/** useCloud.setSpots: groups.max_players + games.spots */
export async function setSpots(groupId, gameId, n) {
  await one(db().from("groups").update({ max_players: n }).eq("id", groupId));
  if (gameId) await one(db().from("games").update({ spots: n }).eq("id", gameId));
}

/** useCloud.setPaid, for several players. */
export const setPaid = (gameId, playerIds, paid) =>
  one(db().from("attendances").update({ paid, paid_at: paid ? nowIso() : null }).eq("game_id", gameId).in("player_id", playerIds));

/** useCloud.cancelGame / db.cancelCurrentGame — only if still open/full. */
export async function cancelGame(gameId) {
  const rows = await one(db().from("games").update({ status: "cancelled" }).eq("id", gameId).in("status", ["open", "full"]).select("id"));
  return Boolean(rows?.length);
}

/** Migration 006700: same columns as useCloud.updateGroupRow. */
export async function rescheduleGame({ gameId, scheduledAt, thisWeekOnly, venue = null, expectedScheduledAt, actor }) {
  const { data, error } = await db().rpc("adjunto_reschedule_game", {
    p_game_id: gameId, p_scheduled_at: scheduledAt, p_this_week_only: thisWeekOnly, p_venue: venue,
    p_expected_scheduled_at: expectedScheduledAt, p_actor: actor,
  });
  if (error) throw error;
  return data;
}
