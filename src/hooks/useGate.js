import { useCallback, useState } from "react";
import { can, requiredPlan } from "../lib/entitlements";

/**
 * Soft paywall. `gate(feature, action)` returns a handler that runs
 * `action` when the group's plan includes the feature — or opens the
 * contextual upgrade prompt (`prompt`, rendered by the caller with
 * <UpgradeModal>) when it doesn't. While the entitlement isn't known yet
 * (`ent` null) everything runs: we inform, we never trap.
 *
 *   const { gate, open, prompt, close } = useGate(ent);
 *   <button onClick={gate("fantasy", createLeague)} />
 *   {prompt && <UpgradeModal planId={prompt.planId} feature={…} onClose={close} />}
 */
export function useGate(ent) {
  const [prompt, setPrompt] = useState(null); // { feature, planId }
  const allowed = useCallback((feature) => !ent || can(feature, ent), [ent]);
  const open = useCallback((feature) => setPrompt({ feature, planId: requiredPlan(feature) }), []);
  const gate = useCallback((feature, action) => (...args) => {
    if (allowed(feature)) return action?.(...args);
    open(feature);
    return undefined;
  }, [allowed, open]);
  const close = useCallback(() => setPrompt(null), []);
  return { gate, allowed, open, prompt, close };
}
