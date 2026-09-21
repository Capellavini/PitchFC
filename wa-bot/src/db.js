import { createClient } from "@supabase/supabase-js";
import { cfg } from "./config.js";

let client;
export const db = () =>
  (client ??= createClient(cfg().supabaseUrl, cfg().serviceKey, { auth: { persistSession: false } }));

/** Groups that opted in to the bot (jid set + enabled). Safe by default. */
export async function botGroups() {
  const { data, error } = await db().from("groups")
    .select("id, name, wa_group_jid, wa_bot_lang, invite_token, max_players")
    .eq("wa_bot_enabled", true).not("wa_group_jid", "is", null);
  if (error) throw error;
  return data ?? [];
}

/** Upcoming or cancelled-but-future games with their confirmed counts. */
export async function upcomingGames(groupId) {
  const since = new Date(Date.now() - 6 * 36e5).toISOString();
  const { data: games, error } = await db().from("games")
    .select("id, status, scheduled_at, venue, spots, created_at")
    .eq("group_id", groupId).gte("scheduled_at", since)
    .in("status", ["open", "full", "cancelled"]);
  if (error) throw error;
  if (!games?.length) return [];
  const { data: att, error: e2 } = await db().from("attendances")
    .select("game_id, status, player_id").in("game_id", games.map((g) => g.id)).eq("status", "confirmed");
  if (e2) throw e2;
  const count = {};
  for (const a of att ?? []) count[a.game_id] = (count[a.game_id] || 0) + 1;
  return games.map((g) => ({ ...g, confirmed: count[g.id] || 0 }));
}

export async function getPrev(gameId) {
  const { data } = await db().from("bot_game_state").select("last_confirmed").eq("game_id", gameId).maybeSingle();
  return data ? data.last_confirmed : null;
}
export const setPrev = (gameId, n) =>
  db().from("bot_game_state").upsert({ game_id: gameId, last_confirmed: n, updated_at: new Date().toISOString() });

/** Claim-before-send. Returns the row id, or null if this key was already announced. */
export async function claim(groupId, gameId, kind, key) {
  const { data, error } = await db().from("bot_announcements")
    .insert({ group_id: groupId, game_id: gameId, kind, dedupe_key: key }).select("id").single();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data.id;
}
export const markSent = (id) => db().from("bot_announcements").update({ status: "sent" }).eq("id", id);
export const unclaim = (id) => db().from("bot_announcements").delete().eq("id", id);

export async function sentSince(groupId, iso) {
  const { count } = await db().from("bot_announcements")
    .select("id", { count: "exact", head: true }).eq("group_id", groupId).gte("created_at", iso);
  return count ?? 0;
}

/** Names of the confirmed players, for @Pitch answers. */
export async function confirmedNames(gameId) {
  const { data } = await db().from("attendances")
    .select("players(nick, name)").eq("game_id", gameId).eq("status", "confirmed")
    .order("responded_at", { ascending: true, nullsFirst: true });
  return (data ?? []).map((r) => r.players?.nick || r.players?.name).filter(Boolean);
}

/** Matchdays finished recently (post-game message). */
export async function recentMatchdays(groupId, hours = 12) {
  const since = new Date(Date.now() - hours * 36e5).toISOString();
  const { data } = await db().from("matchdays")
    .select("id, played_on, n_games, total_goals, summary, mvp_open, created_at")
    .eq("group_id", groupId).gte("created_at", since).order("created_at", { ascending: false });
  return data ?? [];
}

/** Season leaderboard + last matchday, as plain data for @Pitch. */
export async function groupStats(groupId) {
  const { data: rows } = await db().from("player_group_memberships")
    .select("goals, assists, mvps, games_played, wins, clean_sheets, players(nick, name)")
    .eq("group_id", groupId);
  const players = (rows ?? []).map((r) => ({ nick: r.players?.nick || r.players?.name, ...r })).filter((p) => p.nick);
  const last = (await recentMatchdays(groupId, 24 * 30))[0] ?? null;
  return { players, last };
}

// ── Confirm / drop out from the chat ─────────────────────────────────────
/** Members of the group whose stored phone could match. Caller filters with phonesMatch. */
export async function groupMembers(groupId) {
  const { data, error } = await db().from("player_group_memberships")
    .select("player_id, player_type, banned, players(id, nick, name, phone, magic_token, is_organizer)")
    .eq("group_id", groupId).eq("banned", false);
  if (error) throw error;
  return (data ?? []).filter((m) => m.players).map((m) => ({
    id: m.players.id, nick: m.players.nick || m.players.name, phone: m.players.phone,
    token: m.players.magic_token, playerType: m.player_type, isOrganizer: !!m.players.is_organizer,
  }));
}

/** Confirmed roster of a game in the shape splitWaitlist expects. */
export async function confirmedRoster(gameId, members) {
  const { data } = await db().from("attendances")
    .select("player_id, responded_at, priority_locked").eq("game_id", gameId).eq("status", "confirmed");
  const type = Object.fromEntries(members.map((m) => [m.id, m.playerType]));
  return (data ?? []).map((a) => ({
    id: a.player_id, respondedAt: a.responded_at, priorityLocked: a.priority_locked, playerType: type[a.player_id],
  }));
}

/** Same server function the WhatsApp magic link uses: window check, ban check, paid reset. */
export async function setStatus(token, status, gameId) {
  const { error } = await db().rpc("magic_set_status", { token, new_status: status, p_game_id: gameId });
  if (error) throw error;
}
