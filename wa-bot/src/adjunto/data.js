// Treinador Adjunto — read model. Loads one group's current state from
// Supabase and maps it to the app's (core) shapes, so every number the
// Adjunto shows is computed by the same core code as the app.
import { db } from "../db.js";
import { hashId } from "../core/ids.js";
import { GK_OVERALL_WEIGHTS, OVERALL_WEIGHTS } from "../core/overall.js";
import { describeFormat, validateFormat } from "../core/format.js";
import { splitWaitlist } from "../roster.js";
import { formatGameWhen, lisbonDayKey } from "../time.js";

const ATTR_KEYS = Object.keys(OVERALL_WEIGHTS["Médio"]);
const GK_KEYS = Object.keys(GK_OVERALL_WEIGHTS);
const keysFor = (pos) => (pos === "Guarda-redes" ? GK_KEYS : ATTR_KEYS);
/** helpers.js defaultAttrsFor (70 everywhere). */
export const defaultAttrs = (pos) => Object.fromEntries(keysFor(pos).map((k) => [k, 70]));
/** helpers.js averageAttrs. */
export const averageAttrs = (list, pos) =>
  Object.fromEntries(keysFor(pos).map((k) => [k, Math.round(list.reduce((s, a) => s + (a?.[k] ?? 60), 0) / list.length)]));

/** Membership row (+ players join) → the app's player shape (PitchApp
 *  baseGroup/displayGroup): id = hashId(uuid), attrs = peer average once
 *  3+ ratings exist, season totals from the membership. */
export function toCorePlayer(m, ratings = []) {
  const p = m.players ?? {};
  const rs = ratings.filter((r) => r.player_id === p.id);
  const pos = p.position;
  return {
    id: hashId(p.id), uuid: p.id, nick: p.nick || p.name || "?", name: p.name || p.nick || "?",
    position: pos, attrs: rs.length >= 3 ? averageAttrs(rs.map((r) => r.attrs), pos) : (p.attrs ?? defaultAttrs(pos)),
    ratingsCount: rs.length, role: m.role, playerType: m.player_type || "mensalista", injured: Boolean(p.injured),
    phone: p.phone ?? null, magicToken: p.magic_token ?? null,
    goals: m.goals || 0, assists: m.assists || 0, mvps: m.mvps || 0, gamesPlayed: m.games_played || 0,
    wins: m.wins || 0, cleanSheets: m.clean_sheets || 0, epicSaves: m.epic_saves || 0,
  };
}

/** Attendance split exactly like the app (mensalistas outrank unlocked avulsos). */
export function splitAttendance(players, attendances, spots) {
  const byUuid = new Map(players.map((p) => [p.uuid, p]));
  const confirmed = attendances.filter((a) => a.status === "confirmed" && byUuid.has(a.player_id))
    .map((a) => ({ id: a.player_id, respondedAt: a.responded_at, priorityLocked: a.priority_locked, playerType: byUuid.get(a.player_id).playerType }));
  const { playing, waitlist } = splitWaitlist(confirmed, spots);
  const answered = new Set(attendances.filter((a) => a.status !== "pending").map((a) => a.player_id));
  return {
    playing: playing.map((x) => byUuid.get(x.id)),
    waitlist: waitlist.map((x) => byUuid.get(x.id)),
    declined: attendances.filter((a) => a.status === "declined" && byUuid.has(a.player_id)).map((a) => byUuid.get(a.player_id)),
    pending: players.filter((p) => !answered.has(p.uuid) && !p.injured),
  };
}

const q = async (query) => { const { data, error } = await query; if (error) throw error; return data; };

/** Everything the Adjunto needs about one group, right now. */
export async function loadGroupCtx(groupId) {
  const [group, games, members, matchdays] = await Promise.all([
    q(db().from("groups").select("*").eq("id", groupId).single()),
    q(db().from("games").select("*").eq("group_id", groupId).in("status", ["open", "full", "live"]).order("scheduled_at", { ascending: false }).limit(1)),
    q(db().from("player_group_memberships")
      .select("player_id, role, player_type, banned, goals, assists, mvps, games_played, wins, clean_sheets, epic_saves, players(id, nick, name, position, attrs, phone, magic_token, injured)")
      .eq("group_id", groupId).eq("banned", false)),
    q(db().from("matchdays").select("id, played_on, n_games, total_goals, summary, mvp_open, created_at")
      .eq("group_id", groupId).order("played_on", { ascending: false }).order("created_at", { ascending: false }).limit(12)),
  ]);
  const ids = (members ?? []).map((m) => m.player_id);
  const ratings = ids.length ? (await q(db().from("peer_ratings").select("player_id, attrs").in("player_id", ids))) ?? [] : [];
  const game = games?.[0] ?? null;
  const attendances = game ? (await q(db().from("attendances").select("player_id, status, paid, paid_at, responded_at, priority_locked").eq("game_id", game.id))) ?? [] : [];
  const { count } = await db().from("matchdays").select("id", { count: "exact", head: true }).eq("group_id", groupId);
  return { ...buildCtx({ group, game, members: members ?? [], ratings, attendances, matchdays: matchdays ?? [] }), matchdaysCount: count ?? (matchdays ?? []).length };
}

/** Pure part of loadGroupCtx (tested with fixtures). */
export function buildCtx({ group, game, members, ratings, attendances, matchdays }) {
  const players = members.filter((m) => m.players).map((m) => toCorePlayer(m, ratings));
  const spots = game?.spots || group.max_players || 10;
  const split = game ? splitAttendance(players, attendances, spots) : { playing: [], waitlist: [], declined: [], pending: [] };
  const summaries = matchdays.map((md) => ({ id: md.id, date: md.played_on, created_at: md.created_at, summary: md.summary ?? {} }));
  return { group, game, players, attendances, spots, ...split, confirmedCount: split.playing.length + split.waitlist.length, matchdays, summaries };
}

export const hoursToKickoff = (game, now = new Date()) => (game ? (new Date(game.scheduled_at) - now) / 36e5 : null);
export const appLink = (appUrl) => appUrl;
export const formatSet = (group) => Boolean(group?.game_format) && validateFormat(group.game_format).ok;

/** Compact, volatile facts for the agent's last user turn (plan §7.4). */
export function snapshot({ ctx, link, me, lang, otherGroups = [], proposals = [], appUrl, now = new Date() }) {
  const g = ctx.group, game = ctx.game;
  const names = (xs) => xs.map((p) => p.nick).join(", ") || "—";
  const lines = [
    `today_lisbon: ${lisbonDayKey(now)} (${formatGameWhen(now.toISOString(), lang === "en" ? "en" : "pt")})`,
    `organizer: ${me?.nick ?? "?"} (${me?.role ?? "?"})`,
    `active_group: ${g.name} · lang ${lang} · format: ${formatSet(g) ? describeFormat(g.game_format, lang) : "not set"}`,
  ];
  if (otherGroups.length) lines.push(`other_managed_groups: ${otherGroups.map((x) => x.name).join(", ")}`);
  if (!game) lines.push("next_game: none");
  else {
    const h = hoursToKickoff(game, now);
    lines.push(
      `next_game: ${formatGameWhen(game.scheduled_at, lang === "en" ? "en" : "pt")} (${game.scheduled_at}) · venue ${game.venue ?? "—"} · status ${game.status}`,
      `spots ${ctx.spots} · confirmed ${ctx.confirmedCount} · playing ${ctx.playing.length} · waitlist ${ctx.waitlist.length} · pending ${ctx.pending.length} · declined ${ctx.declined.length} · hours_to_kickoff ${h == null ? "—" : Math.round(h)}`,
      `playing: ${names(ctx.playing)}`, `waitlist: ${names(ctx.waitlist)}`, `pending: ${names(ctx.pending)}`,
      `teams: ${!game.teams ? "none" : game.teams_confirmed ? "confirmed" : "draft"}`,
      `live_matchday: ${game.live_matchday ? `${game.live_matchday.mode ?? "?"}, ${(game.live_matchday.matches ?? []).length} matches, ${(game.live_matchday.matches ?? []).filter((m) => m.concluded).length} concluded` : "none"}`,
    );
  }
  const last = ctx.matchdays[0];
  if (last) {
    const ms = (last.summary?.matches ?? []).slice(0, 8).map((m) => `${m.homeName} ${m.homeGoals}-${m.awayGoals} ${m.awayName}`).join("; ");
    lines.push(`last_matchday: ${last.played_on} · ${ms || "no scores"}`);
  }
  if (proposals.length) lines.push(`open_proposals: ${proposals.map((p) => `#${p.id} ${p.kind} (expires ${p.expires_at})`).join("; ")}`);
  lines.push(`app_link: ${appUrl}`);
  return lines.join("\n");
}
