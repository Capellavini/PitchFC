import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseEnabled, isAdminEmail } from "../lib/supabase";

/**
 * PR 2 of the Supabase migration: real accounts (email + password),
 * groups created from scratch, invite links, and admin-created club
 * events. The logged-in user resolves to a player row → their group →
 * roster, current game, attendances, events and bookings, all live.
 *
 * status:
 *   'off'          no env keys → app runs in pure-local demo mode
 *   'loading'      checking the session / fetching
 *   'anon'         no logged-in user (show login / signup)
 *   'needsProfile' logged in, no player card yet (pick organizer/player)
 *   'needsGroup'   player exists but isn't in a group (join via invite)
 *   'ready'        player + group resolved → full app
 */

// Next occurrence of weekday (0=Sun) at HH:MM, as an ISO timestamp.
function nextGameISO(weekday, time) {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + ((weekday - now.getDay() + 7) % 7));
  const [h, m] = (time || "20:00").split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const EMPTY = {
  user: null, myPlayer: null, groupRow: null,
  players: [], game: null, attendances: [], events: [], bookings: [],
  matchdays: [], mvpVotes: [],
  posts: [], friendships: [], allPlayers: [],
};

export function useCloud() {
  const [status, setStatus] = useState(supabaseEnabled ? "loading" : "off");
  const [data, setData] = useState(EMPTY);
  const userRef = useRef(null);

  // ── Load everything for the current auth user ──────────
  const load = useCallback(async (user) => {
    if (!supabaseEnabled) return;
    if (!user) { setData(EMPTY); setStatus("anon"); return; }
    try {
      // Club-wide events are visible to everyone, even pre-group.
      const evq = await supabase.from("events").select("*").order("day");
      const events = evq.data ?? [];

      const meq = await supabase.from("players").select("*").eq("user_id", user.id).limit(1);
      if (meq.error) throw meq.error;
      const myPlayer = meq.data[0] ?? null;

      if (!myPlayer) { setData({ ...EMPTY, user, events }); setStatus("needsProfile"); return; }
      if (!myPlayer.group_id) { setData({ ...EMPTY, user, myPlayer, events }); setStatus("needsGroup"); return; }

      const gid = myPlayer.group_id;
      const [g, p, gm, bk] = await Promise.all([
        supabase.from("groups").select("*").eq("id", gid).single(),
        supabase.from("players").select("*").eq("group_id", gid).order("created_at"),
        supabase.from("games").select("*").eq("group_id", gid)
          .in("status", ["open", "full", "live"]).order("scheduled_at", { ascending: false }).limit(1),
        supabase.from("bookings").select("*, groups(name)").order("day"),
      ]);
      if (g.error || p.error) throw g.error || p.error;
      const game = gm.data?.[0] ?? null;
      let attendances = [];
      if (game) {
        const a = await supabase.from("attendances").select("*").eq("game_id", game.id);
        attendances = a.data ?? [];
      }

      // Matchday history + the latest day's MVP votes. The matchdays
      // table only exists after migration 3 — tolerate its absence.
      let matchdays = [], mvpVotes = [];
      const md = await supabase.from("matchdays").select("*").eq("group_id", gid)
        .order("played_on", { ascending: false }).order("created_at", { ascending: false }).limit(12);
      if (!md.error) {
        matchdays = md.data ?? [];
        if (matchdays[0]) {
          const v = await supabase.from("matchday_votes").select("*").eq("matchday_id", matchdays[0].id);
          mvpVotes = v.data ?? [];
        }
      }

      // Social: cloud feed (author + likes + comments), my friend graph,
      // and the club-wide roster (for "add friend").
      let posts = [], friendships = [], allPlayers = [];
      const pq = await supabase.from("posts")
        .select("*, author:players!author_id(id,nick,name,photo_url,group_id), post_likes(player_id), post_comments(id,author_id,body,created_at, author:players!author_id(nick,photo_url))")
        .order("created_at", { ascending: false }).limit(100);
      if (!pq.error) posts = pq.data ?? [];
      const fq = await supabase.from("friendships").select("*")
        .or(`requester_id.eq.${myPlayer.id},addressee_id.eq.${myPlayer.id}`);
      if (!fq.error) friendships = fq.data ?? [];
      const apq = await supabase.from("players").select("id,nick,name,photo_url,group_id,groups(name)").order("nick");
      if (!apq.error) allPlayers = apq.data ?? [];

      setData({ user, myPlayer, groupRow: g.data, players: p.data ?? [], game, attendances, events, bookings: bk.data ?? [], matchdays, mvpVotes, posts, friendships, allPlayers });
      setStatus("ready");
    } catch (err) {
      console.error("Supabase indisponível — modo local", err);
      setStatus("failed");
    }
  }, []);

  const refetch = useCallback(() => load(userRef.current), [load]);

  // ── Track the auth session ─────────────────────────────
  useEffect(() => {
    if (!supabaseEnabled) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      userRef.current = session?.user ?? null;
      load(userRef.current);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      userRef.current = session?.user ?? null;
      load(userRef.current);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // ── Realtime: refetch on relevant table changes ────────
  useEffect(() => {
    if (!supabaseEnabled) return;
    const ch = supabase
      .channel(`pitch-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendances" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "matchdays" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "matchday_votes" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refetch)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [refetch]);

  // ── Auth actions ───────────────────────────────────────
  const signUp = async (email, password, meta) => {
    const { data: res, error } = await supabase.auth.signUp({
      email, password, options: { data: meta },
    });
    if (error) return { error: error.message };
    // Confirmation OFF → session present, user is in. ON → needs email.
    return { needsConfirm: !res.session };
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  // ── Profile / group creation ───────────────────────────
  const playerFields = (form, extra = {}) => ({
    name: form.name, nick: form.nick, email: userRef.current?.email,
    phone: form.phone ?? userRef.current?.user_metadata?.phone ?? null,
    age: form.age, nationality: form.nationality, club: form.club,
    position: form.position, foot: form.foot, attrs: form.attrs,
    photo_url: form.photo ?? null, ...extra,
  });

  /** Player signs up cold: creates a card with no group yet. */
  const createPlayerProfile = async (form) => {
    const user = userRef.current;
    await supabase.from("players").insert(playerFields(form, { user_id: user.id, is_organizer: false }));
    await refetch();
  };

  /** Organizer creates the group + their own (organizer) card + the
   *  first recurring game, then lands straight in the app. */
  const createGroupAsOrganizer = async (groupForm, profileForm) => {
    const user = userRef.current;
    const grp = await supabase.from("groups").insert({
      name: groupForm.groupName, venue: groupForm.venue, weekday: groupForm.weekday,
      game_time: groupForm.time, monthly_price_cents: Math.round(groupForm.monthlyPrice * 100),
      max_players: groupForm.maxPlayers,
    }).select().single();
    if (grp.error) return { error: grp.error.message };
    const groupId = grp.data.id;

    const pl = await supabase.from("players")
      .insert(playerFields(profileForm, { user_id: user.id, group_id: groupId, is_organizer: true }))
      .select().single();

    const game = await supabase.from("games").insert({
      group_id: groupId, scheduled_at: nextGameISO(groupForm.weekday, groupForm.time),
      venue: groupForm.venue, spots: groupForm.maxPlayers,
      total_cost_cents: Math.round(groupForm.monthlyPrice * 100),
      status: "open", recurring_rule: `weekly_${groupForm.weekday}_${groupForm.time}`,
    }).select().single();

    if (pl.data && game.data) {
      await supabase.from("attendances").insert({ game_id: game.data.id, player_id: pl.data.id, status: "pending" });
    }
    await refetch();
    return { inviteToken: grp.data.invite_token };
  };

  /** Logged-in player joins a group via its invite token. */
  const joinGroupByToken = async (token) => {
    const user = userRef.current;
    const grp = await supabase.from("groups").select("id").eq("invite_token", token.trim()).limit(1);
    const groupId = grp.data?.[0]?.id;
    if (!groupId) return { error: "Convite inválido ou expirado." };

    let player = data.myPlayer;
    if (player) {
      await supabase.from("players").update({ group_id: groupId }).eq("id", player.id);
    } else {
      const ins = await supabase.from("players").insert({
        user_id: user.id, group_id: groupId,
        name: user.user_metadata?.name ?? user.email, nick: (user.user_metadata?.name ?? "Jogador").split(" ")[0],
        email: user.email, phone: user.user_metadata?.phone ?? null,
        position: "Médio", foot: "Direito",
      }).select().single();
      player = ins.data;
    }
    // Attendance for the group's current game.
    const gm = await supabase.from("games").select("id").eq("group_id", groupId)
      .in("status", ["open", "full", "live"]).order("scheduled_at", { ascending: false }).limit(1);
    if (gm.data?.[0] && player) {
      await supabase.from("attendances")
        .upsert({ game_id: gm.data[0].id, player_id: player.id, status: "pending" }, { onConflict: "game_id,player_id" });
    }
    await refetch();
    return {};
  };

  // ── In-app mutations (optimistic patch + write) ────────
  const setMyStatus = async (status_, playerId, gameId) => {
    const respondedAt = new Date().toISOString();
    setData((d) => ({ ...d, attendances: d.attendances.map((a) => (a.player_id === playerId ? { ...a, status: status_, responded_at: respondedAt } : a)) }));
    await supabase.from("attendances").update({ status: status_, responded_at: respondedAt })
      .eq("game_id", gameId).eq("player_id", playerId);
  };
  const setPaid = async (paid, playerId, gameId) => {
    setData((d) => ({ ...d, attendances: d.attendances.map((a) => (a.player_id === playerId ? { ...a, paid } : a)) }));
    await supabase.from("attendances").update({ paid, paid_at: paid ? new Date().toISOString() : null })
      .eq("game_id", gameId).eq("player_id", playerId);
  };
  const updatePlayer = async (playerId, fields) => {
    setData((d) => ({ ...d, players: d.players.map((p) => (p.id === playerId ? { ...p, ...fields } : p)) }));
    await supabase.from("players").update(fields).eq("id", playerId);
  };
  const updateGroupRow = async (fields) => {
    setData((d) => ({ ...d, groupRow: { ...d.groupRow, ...fields } }));
    const r = await supabase.from("groups").update(fields).eq("id", data.groupRow.id);
    if (r.error) {
      // Likely the recurring columns (migration 6) aren't applied yet —
      // retry with just the core columns so settings still save.
      const { recurring, open_weekday, open_time, ...core } = fields;
      if (recurring !== undefined || open_weekday !== undefined || open_time !== undefined) {
        await supabase.from("groups").update(core).eq("id", data.groupRow.id);
      }
    }
  };

  /** Organizer changes the number of players for this game. Keeps the
   *  group default (max_players) and the live game row (spots) in sync. */
  const setSpots = async (n) => {
    setData((d) => ({
      ...d,
      groupRow: d.groupRow ? { ...d.groupRow, max_players: n } : d.groupRow,
      game: d.game ? { ...d.game, spots: n } : d.game,
    }));
    if (data.groupRow) await supabase.from("groups").update({ max_players: n }).eq("id", data.groupRow.id);
    if (data.game) await supabase.from("games").update({ spots: n }).eq("id", data.game.id);
  };

  // ── Owner-only admin mutations (cross-group). RLS is permissive
  //    (open write v1), so the anon key can write across groups. These
  //    are gated client-side by the admin email; lock down via RLS/role
  //    before real users (see SUPABASE.md). ──
  const adminUpdateGroup = async (id, fields) => {
    const r = await supabase.from("groups").update(fields).eq("id", id);
    return r.error ? { error: r.error.message } : {};
  };
  const adminDeleteGroup = async (id) => {
    // players/games/attendances cascade via FK on delete.
    const r = await supabase.from("groups").delete().eq("id", id);
    return r.error ? { error: r.error.message } : {};
  };
  const adminUpdatePlayer = async (id, fields) => {
    const r = await supabase.from("players").update(fields).eq("id", id);
    return r.error ? { error: r.error.message } : {};
  };
  const adminDeletePlayer = async (id) => {
    // Removes the player card + their attendances/stats. The underlying
    // auth account (if any) needs the service role to delete — not here.
    const r = await supabase.from("players").delete().eq("id", id);
    return r.error ? { error: r.error.message } : {};
  };

  /** Owner-only: snapshot of every group for the admin overview. RLS is
   *  permissive (open read v1), so the anon key can read across groups. */
  const fetchAdminData = async () => {
    const [g, p, gm, at] = await Promise.all([
      supabase.from("groups").select("*").order("created_at"),
      supabase.from("players").select("*"),
      supabase.from("games").select("id,group_id,scheduled_at,status,spots").order("scheduled_at", { ascending: false }),
      supabase.from("attendances").select("game_id,player_id,status,paid"),
    ]);
    return {
      groups: g.data ?? [], players: p.data ?? [],
      games: gm.data ?? [], attendances: at.data ?? [],
      error: g.error?.message || p.error?.message || gm.error?.message || at.error?.message || null,
    };
  };

  // ── Club events (admin) + bookings ─────────────────────
  const createEvent = async (ev) => {
    await supabase.from("events").insert({
      title: ev.title, emoji: ev.emoji, day: ev.day, event_time: ev.time,
      description: ev.desc, kind: ev.kind || null, price_cents: Math.round((ev.price || 0) * 100),
      created_by: userRef.current?.id,
    });
    await refetch();
  };
  const deleteEvent = async (id) => { await supabase.from("events").delete().eq("id", id); await refetch(); };

  const addBooking = async (court, day, hour) => {
    await supabase.from("bookings").insert({ court, day, hour, group_id: data.groupRow?.id });
    await refetch();
  };
  const removeBooking = async (id) => { await supabase.from("bookings").delete().eq("id", id); await refetch(); };

  // ── Matchday close: bump season stats + record the day + MVP ──
  /** statsByUuid: { [playerUuid]: { goals, assists, cleanSheets, wins, played } }
   *  summary: { teamResults, matches, lines, candidates } (display-ready). */
  const commitMatchday = async ({ statsByUuid, summary, totalGoals, mode, nGames }) => {
    // Increment each affected player's season totals (read-modify-write;
    // the organizer is the only writer so races aren't a concern).
    const current = Object.fromEntries(data.players.map((p) => [p.id, p]));
    const updates = Object.entries(statsByUuid).map(([uuid, s]) => {
      const p = current[uuid];
      if (!p) return null;
      return supabase.from("players").update({
        goals: (p.goals || 0) + (s.goals || 0),
        assists: (p.assists || 0) + (s.assists || 0),
        clean_sheets: (p.clean_sheets || 0) + (s.cleanSheets || 0),
        wins: (p.wins || 0) + (s.wins || 0),
        games_played: (p.games_played || 0) + (s.played ? 1 : 0),
      }).eq("id", uuid);
    }).filter(Boolean);
    await Promise.all(updates);
    await supabase.from("matchdays").insert({
      group_id: data.groupRow.id, n_games: nGames, total_goals: totalGoals, mode,
      summary, mvp_open: true,
    });
    await refetch();
  };

  const castMvpVote = async (matchdayId, votedForId) => {
    if (!data.myPlayer) return;
    await supabase.from("matchday_votes").upsert(
      { matchday_id: matchdayId, voter_id: data.myPlayer.id, voted_for_id: votedForId },
      { onConflict: "matchday_id,voter_id" });
    await refetch();
  };

  /** Close voting: tally, store winner, +1 to their season MVPs. */
  const closeMvp = async (matchdayId) => {
    const votes = data.mvpVotes.filter((v) => v.matchday_id === matchdayId);
    if (votes.length) {
      const tally = {};
      votes.forEach((v) => { tally[v.voted_for_id] = (tally[v.voted_for_id] || 0) + 1; });
      const winnerId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      const winner = data.players.find((p) => p.id === winnerId);
      if (winner) await supabase.from("players").update({ mvps: (winner.mvps || 0) + 1 }).eq("id", winnerId);
      await supabase.from("matchdays").update({ mvp_open: false, mvp_id: winnerId }).eq("id", matchdayId);
    } else {
      await supabase.from("matchdays").update({ mvp_open: false }).eq("id", matchdayId);
    }
    await refetch();
  };

  // ── Permissions (organizer grants the assistant role) ──
  const toggleAssistant = async (playerId, value) => {
    setData((d) => ({ ...d, players: d.players.map((p) => (p.id === playerId ? { ...p, is_assistant: value } : p)) }));
    await supabase.from("players").update({ is_assistant: value }).eq("id", playerId);
  };

  /** Organizer adds a guest player (no account) — confirmed for the
   *  current game so they show up on the grid and in the draw. */
  const addManualPlayer = async ({ name, nick, position, attrs }) => {
    const ins = await supabase.from("players")
      .insert({ group_id: data.groupRow.id, name, nick, position, foot: "Direito", attrs })
      .select().single();
    if (data.game && ins.data) {
      await supabase.from("attendances")
        .upsert({ game_id: data.game.id, player_id: ins.data.id, status: "confirmed" }, { onConflict: "game_id,player_id" });
    }
    await refetch();
  };

  // ── Social: posts, likes, comments ─────────────────────
  /** Upload a photo/video to the public 'social' bucket; returns its URL.
   *  Keyed by the auth user id so it also works during onboarding, before
   *  a player row exists (used for the profile photo too). */
  const uploadMedia = async (file) => {
    const uid = userRef.current?.id;
    if (!uid) return { error: "Sem sessão." };
    const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
    const path = `${uid}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("social").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return { error: up.error.message };
    const { data: pub } = supabase.storage.from("social").getPublicUrl(path);
    return { url: pub.publicUrl };
  };

  const createPost = async ({ type, body, media_url }) => {
    if (!data.myPlayer) return;
    await supabase.from("posts").insert({ author_id: data.myPlayer.id, type, body, media_url });
    await refetch();
  };
  const deletePost = async (id) => { await supabase.from("posts").delete().eq("id", id); await refetch(); };
  const toggleLike = async (postId, liked) => {
    if (liked) await supabase.from("post_likes").delete().eq("post_id", postId).eq("player_id", data.myPlayer.id);
    else await supabase.from("post_likes").insert({ post_id: postId, player_id: data.myPlayer.id });
    await refetch();
  };
  const addComment = async (postId, body) => {
    await supabase.from("post_comments").insert({ post_id: postId, author_id: data.myPlayer.id, body });
    await refetch();
  };

  // ── Friends (request → accept) ─────────────────────────
  const sendFriendRequest = async (addresseeId) => {
    await supabase.from("friendships").insert({ requester_id: data.myPlayer.id, addressee_id: addresseeId, status: "pending" });
    await refetch();
  };
  const respondFriend = async (id, accept) => {
    if (accept) await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    else await supabase.from("friendships").delete().eq("id", id);
    await refetch();
  };
  const removeFriend = async (id) => { await supabase.from("friendships").delete().eq("id", id); await refetch(); };

  return {
    status, ...data,
    isAdmin: isAdminEmail(data.user?.email),
    signUp, signIn, signOut,
    createPlayerProfile, createGroupAsOrganizer, joinGroupByToken,
    setMyStatus, setPaid, updatePlayer, updateGroupRow, setSpots,
    fetchAdminData, adminUpdateGroup, adminDeleteGroup, adminUpdatePlayer, adminDeletePlayer,
    createEvent, deleteEvent, addBooking, removeBooking,
    commitMatchday, castMvpVote, closeMvp,
    toggleAssistant, addManualPlayer, uploadMedia, createPost, deletePost, toggleLike, addComment,
    sendFriendRequest, respondFriend, removeFriend,
    refetch,
  };
}
