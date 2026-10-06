import { createClient } from "@supabase/supabase-js";
import { cfg } from "./config.js";
import { lisbonWeekday } from "./time.js";

let client;
export const db = () =>
  (client ??= createClient(cfg().supabaseUrl, cfg().serviceKey, { auth: { persistSession: false } }));

/** Durable record of what @Pitch actually sent — full text, not just the
 *  event kind bot_announcements already tracks. Callers should catch: a
 *  logging failure must never block or retry the real send. */
export async function logMessage({ groupId, kind, answer, eventKind = null, question = null, askerId = null }) {
  const { error } = await db().from("bot_message_log")
    .insert({ group_id: groupId, kind, event_kind: eventKind, question, answer, asker_id: askerId });
  if (error) throw error;
}

/** Groups that opted in to the bot (jid set + enabled). Safe by default. */
export async function botGroups() {
  const { data, error } = await db().from("groups")
    .select("id, name, wa_group_jid, wa_bot_lang, wa_bot_kinds, wa_bot_interactive, invite_token, max_players, venue, monthly_price_cents")
    .eq("wa_bot_enabled", true).not("wa_group_jid", "is", null);
  if (error) throw error;
  return data ?? [];
}

/** Upcoming or cancelled-but-future games with their confirmed counts. */
export async function upcomingGames(groupId) {
  const since = new Date(Date.now() - 6 * 36e5).toISOString();
  const { data: games, error } = await db().from("games")
    .select("id, status, scheduled_at, venue, spots, created_at, cycle_opened_at")
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

/** Last confirmed count the bot saw, and the weekly cycle it saw it in
 *  (null state = never seen). See prevForCycle in events.js. */
export async function getPrev(gameId) {
  const { data } = await db().from("bot_game_state").select("last_confirmed, cycle_opened_at").eq("game_id", gameId).maybeSingle();
  return data ? { n: data.last_confirmed, cycle: data.cycle_opened_at } : null;
}
export const setPrev = (gameId, n, cycle = null) =>
  db().from("bot_game_state").upsert({ game_id: gameId, last_confirmed: n, cycle_opened_at: cycle, updated_at: new Date().toISOString() });

/** Transition guard for keys that gained a weekly-cycle suffix (migration
 *  68): true if the OLD-format key was already claimed in this cycle, so
 *  the deploy doesn't repeat a message already sent this week. */
export async function legacyClaimed(key, sinceIso) {
  let q = db().from("bot_announcements").select("id").eq("dedupe_key", key);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

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

// Group messages only: the Treinador Adjunto's private DMs are claimed in
// the same table with kind "dm_*" and must not eat the group's daily cap.
export async function sentSince(groupId, iso) {
  const { count } = await db().from("bot_announcements")
    .select("id", { count: "exact", head: true }).eq("group_id", groupId).gte("created_at", iso)
    .not("kind", "like", "dm_%");
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
    .select("player_id, player_type, banned, role, players(id, nick, name, phone, magic_token, is_organizer)")
    .eq("group_id", groupId).eq("banned", false);
  if (error) throw error;
  return (data ?? []).filter((m) => m.players).map((m) => ({
    id: m.players.id, nick: m.players.nick || m.players.name, phone: m.players.phone,
    token: m.players.magic_token, playerType: m.player_type, isOrganizer: !!m.players.is_organizer,
    // role is the single source of truth (organizer/assistant/member), kept
    // in sync with players.is_organizer/is_assistant by a DB trigger — see
    // supabase/migrations/20260101003600_player_group_memberships.sql.
    canManageGames: m.role === "organizer" || m.role === "assistant",
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

// ── Organizer/assistant-only actions ("@Pitch cria jogo" / "cancela o jogo") ──
/** True if the group already has a game on the calendar (open or full) —
 *  callers should refuse to create a second one on top of it, same as the
 *  app's own JogoTab (scheduleNextGame only shows up with no game.data yet). */
export async function hasOpenGame(groupId) {
  const { data } = await db().from("games").select("id")
    .eq("group_id", groupId).in("status", ["open", "full"]).limit(1);
  return Boolean(data?.length);
}

/** Mirrors the app's own scheduleNextGame (src/hooks/useCloud.js): sets the
 *  group's recurring weekday/time going forward AND opens the game itself,
 *  with every current member starting pending — this is the same "no game
 *  scheduled yet" flow the organizer would hit in the app, just reachable
 *  from the chat. `scheduledAt` is a real instant (already resolved to
 *  Lisbon wall-clock by the caller via time.js); `hhmm` is that SAME
 *  Lisbon wall-clock time as "HH:MM" — passed through rather than
 *  re-derived from scheduledAt, since reading UTC hours/minutes back off
 *  a real instant would silently drift from Lisbon time across DST. */
export async function createGame(group, scheduledAt, hhmm) {
  const weekday = lisbonWeekday(scheduledAt);
  await db().from("groups").update({ weekday, game_time: hhmm }).eq("id", group.id);
  const { data: game, error } = await db().from("games").insert({
    group_id: group.id, scheduled_at: scheduledAt.toISOString(),
    venue: group.venue, spots: group.max_players,
    total_cost_cents: group.monthly_price_cents,
    status: "open", recurring_rule: `weekly_${weekday}_${hhmm}`,
  }).select().single();
  if (error) throw error;

  const members = await groupMembers(group.id);
  if (members.length) {
    await db().from("attendances").insert(
      members.map((m) => ({ game_id: game.id, player_id: m.id, status: "pending" }))
    );
  }
  return game;
}

/** Soft-cancel the group's current game (same as the app's cancelGame) —
 *  the existing "cancelled" announcement in events.js/index.js then picks
 *  it up and tells the group, urgently, on the next poll. */
export async function cancelCurrentGame(groupId) {
  const { data } = await db().from("games").select("id")
    .eq("group_id", groupId).in("status", ["open", "full"]).order("scheduled_at", { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  const { error } = await db().from("games").update({ status: "cancelled" }).eq("id", data.id);
  if (error) throw error;
  return data.id;
}

// ── Personal stats ("quantos golos fiz no último jogo?") ──────────────────
/** This one player's own line from the group's most recent finished
 *  matchday, plus their season totals — kept separate from groupStats'
 *  leaderboard so @Pitch can answer "how did *I* do" without mixing up
 *  whose numbers are whose. */
export async function myStats(groupId, playerId) {
  const { data: season } = await db().from("player_group_memberships")
    .select("goals, assists, mvps, games_played, wins, clean_sheets")
    .eq("group_id", groupId).eq("player_id", playerId).maybeSingle();

  const last = (await recentMatchdays(groupId, 24 * 30))[0] ?? null;
  const myLine = last?.summary?.lines?.find((l) => l.id === playerId || l.key === playerId) ?? null;

  return { season: season ?? null, lastMatchday: last ? { playedOn: last.played_on, line: myLine } : null };
}
