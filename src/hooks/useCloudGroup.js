import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, seedGroupId } from "../lib/supabase";

/**
 * PR 1 of the Supabase migration: roster, group settings and the
 * current game's attendances live in the cloud, updating in realtime
 * on every device. Everything else (posts, matchdays, bookings…)
 * stays in localStorage until later PRs.
 *
 * status: 'off' (no env keys) | 'loading' | 'ready' | 'failed'
 * — 'off'/'failed' make the app fall back to pure-local demo mode.
 */
export function useCloudGroup() {
  const [state, setState] = useState({
    status: supabaseEnabled ? "loading" : "off",
    groupRow: null, players: [], game: null, attendances: [],
  });

  const refetch = useCallback(async () => {
    if (!supabaseEnabled) return;
    try {
      const [g, p, gm] = await Promise.all([
        supabase.from("groups").select("*").eq("id", seedGroupId).single(),
        supabase.from("players").select("*").eq("group_id", seedGroupId).order("id"),
        supabase.from("games").select("*").eq("group_id", seedGroupId)
          .in("status", ["open", "full", "live"]).order("scheduled_at", { ascending: false }).limit(1),
      ]);
      if (g.error || p.error || gm.error) throw g.error || p.error || gm.error;
      const game = gm.data[0] ?? null;
      let attendances = [];
      if (game) {
        const a = await supabase.from("attendances").select("*").eq("game_id", game.id);
        if (a.error) throw a.error;
        attendances = a.data;
      }
      setState({ status: "ready", groupRow: g.data, players: p.data, game, attendances });
    } catch (err) {
      console.error("Supabase indisponível — modo local", err);
      setState((s) => ({ ...s, status: "failed" }));
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime: any change to attendances/players/groups re-syncs every
  // open device — this is what makes the slot grid live.
  useEffect(() => {
    if (!supabaseEnabled) return;
    // Unique topic per mount: StrictMode's mount→cleanup→remount would
    // otherwise kill the remounted channel (removeChannel is async and
    // tears down the same-named topic).
    // Only attendances is subscribed: it's the only table in the
    // realtime publication (binding a non-published table silently
    // breaks the whole channel). Profile/settings changes are rare and
    // covered by optimistic updates + the attendance-driven refetches.
    const channel = supabase
      .channel(`pitch-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendances" }, refetch)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refetch]);

  // Mutations: optimistic local patch + write; realtime confirms.
  const setMyStatus = async (playerUuid, status) => {
    if (!state.game) return;
    setState((s) => ({ ...s, attendances: s.attendances.map((a) => (a.player_id === playerUuid ? { ...a, status } : a)) }));
    await supabase.from("attendances")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("game_id", state.game.id).eq("player_id", playerUuid);
  };

  const setPaid = async (playerUuid, paid) => {
    if (!state.game) return;
    setState((s) => ({ ...s, attendances: s.attendances.map((a) => (a.player_id === playerUuid ? { ...a, paid } : a)) }));
    await supabase.from("attendances")
      .update({ paid, paid_at: paid ? new Date().toISOString() : null })
      .eq("game_id", state.game.id).eq("player_id", playerUuid);
  };

  const updatePlayer = async (playerUuid, fields) => {
    setState((s) => ({ ...s, players: s.players.map((p) => (p.id === playerUuid ? { ...p, ...fields } : p)) }));
    await supabase.from("players").update(fields).eq("id", playerUuid);
  };

  const updateGroupRow = async (fields) => {
    setState((s) => ({ ...s, groupRow: { ...s.groupRow, ...fields } }));
    await supabase.from("groups").update(fields).eq("id", seedGroupId);
  };

  return { ...state, setMyStatus, setPaid, updatePlayer, updateGroupRow };
}
