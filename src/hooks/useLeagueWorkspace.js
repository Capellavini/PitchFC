import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { leagueErrorCode } from "../lib/leagueCloud";
import { createWorkspaceSync, SYNC_STATUS } from "../lib/leagueWorkspaceSync";

const rpc = async (name, args) => {
  try {
    const r = await supabase.rpc(name, args);
    return r.error ? { error: leagueErrorCode(r.error) } : { data: r.data };
  } catch (e) {
    return { error: leagueErrorCode(e) };
  }
};
const api = {
  get: () => rpc("league_workspace_get", {}),
  save: (state, expectedVersion) => rpc("league_workspace_save", { p_state: state, p_expected_version: expectedVersion }),
};

/**
 * PITCH Ligas workspace in the cloud (the bridge): the whole league as one
 * state document per account, saved through league_workspace_* RPCs.
 *
 * Returns the `store` LeagueContextApp runs on:
 *   phase    "loading" | "ready" | "error"  (error = the first load failed)
 *   raw      the persisted league state (null = a brand-new account)
 *   setRaw   same contract as the setter of usePersistentState (value or updater)
 *   sync     "idle" | "saving" | "saved" | "error" | "conflict"
 *   slug / published / publish(on)   the public page
 *   reload()  fetch the server copy again (also the way out of a conflict)
 *   retry()   try saving again after an error
 */
export function useLeagueWorkspace({ enabled = true, userId = null } = {}) {
  const [phase, setPhase] = useState("loading");
  const [raw, setRawState] = useState(null);
  const [sync, setSync] = useState(SYNC_STATUS.IDLE);
  const [meta, setMeta] = useState({ slug: null, published: false });
  const rawRef = useRef(null);
  const engine = useMemo(() => (enabled ? createWorkspaceSync({ api, onStatus: setSync }) : null), [enabled, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    if (!engine) return;
    setPhase("loading");
    const r = await engine.load();
    if (r.error) { setPhase("error"); return; }
    rawRef.current = r.state;
    setRawState(r.state);
    setMeta({ slug: r.slug, published: r.published });
    setSync(SYNC_STATUS.IDLE);
    setPhase("ready");
  }, [engine]);

  useEffect(() => { reload(); return () => engine?.stop(); }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRaw = useCallback((next) => {
    const value = typeof next === "function" ? next(rawRef.current) : next;
    rawRef.current = value;
    setRawState(value);
    engine?.change(value);
  }, [engine]);

  // Don't lose the last change when the tab closes: save now and warn if it isn't confirmed yet.
  useEffect(() => {
    if (!engine) return undefined;
    const onLeave = (e) => {
      if (!engine.hasPending()) return;
      engine.flush();
      e.preventDefault();
      e.returnValue = "";
    };
    const onHide = () => { if (document.visibilityState === "hidden" && engine.hasPending()) engine.flush(); };
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("beforeunload", onLeave); document.removeEventListener("visibilitychange", onHide); };
  }, [engine]);

  const publish = useCallback(async (on) => {
    // The page must exist on the server before it can be published.
    if (engine?.hasPending()) await engine.flush();
    const r = await rpc("league_workspace_set_published", { p_published: Boolean(on) });
    if (r.error) return { error: r.error };
    setMeta({ slug: r.data?.slug || null, published: Boolean(r.data?.published) });
    return { data: r.data };
  }, [engine]);

  return { phase, raw, setRaw, sync, slug: meta.slug, published: meta.published, publish, reload, retry: () => engine?.retry() };
}
