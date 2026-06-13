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
      setData({ user, myPlayer, groupRow: g.data, players: p.data ?? [], game, attendances, events, bookings: bk.data ?? [] });
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
    setData((d) => ({ ...d, attendances: d.attendances.map((a) => (a.player_id === playerId ? { ...a, status: status_ } : a)) }));
    await supabase.from("attendances").update({ status: status_, responded_at: new Date().toISOString() })
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
    await supabase.from("groups").update(fields).eq("id", data.groupRow.id);
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

  return {
    status, ...data,
    isAdmin: isAdminEmail(data.user?.email),
    signUp, signIn, signOut,
    createPlayerProfile, createGroupAsOrganizer, joinGroupByToken,
    setMyStatus, setPaid, updatePlayer, updateGroupRow,
    createEvent, deleteEvent, addBooking, removeBooking,
    refetch,
  };
}
