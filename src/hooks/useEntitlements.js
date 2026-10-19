import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { effectivePlan, demoEntitlement, parseDemoPlan } from "../lib/entitlements";

const DEMO_KEY = "pitch.v2.demoPlan";

function readDemoPlan() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("demoPlan");
    if (fromUrl && parseDemoPlan(fromUrl)) {
      localStorage.setItem(DEMO_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (parseDemoPlan(stored)) return stored;
  } catch { /* storage blocked — default demo plan */ }
  return "trial";
}

/**
 * The active group's plan.
 *  - Cloud: group_entitlement(group_id) RPC (migration 20261019100000),
 *    refetched when the group changes. Until it answers — or if it fails
 *    (e.g. the migration isn't live yet) — `ent` is null and `ready` false,
 *    and gates fail OPEN: the paywall informs, it never traps.
 *  - Local demo: a simulated plan (default: Club trial with N days left),
 *    switchable with ?demoPlan=free|trial:2|founder|forever|club_ai or
 *    setDemoPlan() so the soft paywall can be demoed without a backend.
 * Returns { ent, ready, demoPlan, setDemoPlan, refresh }.
 */
// mode: "cloud" | "local" | "loading" (cloud status not settled yet → null).
export function useEntitlements({ mode, groupId }) {
  const cloudMode = mode === "cloud";
  const [cloudEnt, setCloudEnt] = useState(null);
  const [demoPlan, setDemoPlanState] = useState(readDemoPlan);

  const refresh = useCallback(async () => {
    if (!cloudMode || !groupId || !supabase) { setCloudEnt(null); return; }
    const { data, error } = await supabase.rpc("group_entitlement", { p_group_id: groupId });
    setCloudEnt(error || !data ? null : { groupId, ...effectivePlan(data) });
  }, [cloudMode, groupId]);

  useEffect(() => { refresh(); }, [refresh]);

  const setDemoPlan = useCallback((id) => {
    if (!parseDemoPlan(id)) return;
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(id)); } catch { /* in-memory only */ }
    setDemoPlanState(id);
  }, []);

  if (mode === "local") return { ent: { groupId: "local", ...demoEntitlement(demoPlan) }, ready: true, demoPlan, setDemoPlan, refresh };
  if (!cloudMode) return { ent: null, ready: false, demoPlan: null, setDemoPlan: null, refresh };
  const ent = cloudEnt && cloudEnt.groupId === groupId ? cloudEnt : null;
  return { ent, ready: Boolean(ent), demoPlan: null, setDemoPlan: null, refresh };
}
