import { useEffect, useRef, useState } from "react";

/**
 * Run one PITCH Rivals read (useTeams: getMatchAvailability, scoutOpponent…)
 * and keep its latest answer. `fetcher` returns a Promise of { data } |
 * { error }. Re-runs when `deps` change (put `teams.revision` in them so a
 * realtime / mutation refresh re-reads). The previous data stays on screen
 * while it refetches (no flicker); `enabled: false` skips the call.
 * → { data, error, loading }
 */
export function useRivalsRead(fetcher, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) { setState((s) => (s.loading ? { ...s, loading: false } : s)); return undefined; }
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fetcherRef.current()).then((r) => {
      if (!live) return;
      setState(r?.error ? { data: null, error: r.error, loading: false } : { data: r?.data ?? null, error: null, loading: false });
    }, () => live && setState({ data: null, error: "unknown", loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return state;
}
