import { useEffect, useState } from "react";

// v2: schema gained FUT attributes, session, settings and posts —
// bumping the prefix invalidates v1 demo data cleanly.
const PREFIX = "pitch.v2.";

/** useState that survives reloads via localStorage. */
export function usePersistentState(key, initial) {
  const fullKey = PREFIX + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // storage full or unavailable — app keeps working in memory
    }
  }, [fullKey, value]);

  return [value, setValue];
}

/** Drop all persisted app state (used by "repor dados de demonstração"). */
export function clearAppStorage() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("pitch."))
    .forEach((k) => localStorage.removeItem(k));
}
