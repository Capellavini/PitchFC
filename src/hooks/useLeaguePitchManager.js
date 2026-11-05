import { useCallback, useEffect, useRef, useState } from "react";
import { leaguePmApi } from "../lib/leaguePitchManagerApi";

const REFRESH_MS = 30000;

/** The server side of a real league's Pitch Manager.
 *  phase  "loading" | "ready" | "off" (the Gestor switched the module off) | "error"
 *  board  what league_pm_board returned (my squad, locked lineups, ownership counts)
 *  save(squad, name) → { error } | {} — writes through league_pm_save_squad, then reloads the board
 *  Refreshes on its own while the tab is visible, so a round that locks shows up without a reload. */
export function useLeaguePitchManager({ workspaceId = null, enabled = true } = {}) {
  const [state, setState] = useState({ phase: "loading", board: null });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    const r = await leaguePmApi.board(workspaceId);
    if (!alive.current) return;
    if (r.error || !r.data) { if (!silent) setState((s) => ({ phase: "error", board: s.board })); return; }
    setState({ phase: r.data.enabled === false ? "off" : "ready", board: r.data });
  }, [workspaceId]);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => { if (document.visibilityState !== "hidden") load({ silent: true }); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  const save = useCallback(async (squad, name) => {
    const r = await leaguePmApi.save(workspaceId, squad, name);
    if (r.error) return { error: r.error };
    await load({ silent: true });
    return {};
  }, [workspaceId, load]);

  return { phase: state.phase, board: state.board, save, reload: () => load() };
}
