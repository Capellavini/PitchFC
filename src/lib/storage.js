import { useEffect, useState } from "react";
import { presentationMode } from "./presentation";

// v2: schema gained FUT attributes, session, settings and posts —
// bumping the prefix invalidates v1 demo data cleanly.
// Presentation mode keeps its own namespace so a demo run never touches (or
// inherits) a real browser's local data.
const PREFIX = presentationMode ? "pitch.demo.v1." : "pitch.v2.";

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
    .filter((k) => k.startsWith(presentationMode ? "pitch.demo." : "pitch.v2."))
    .forEach((k) => localStorage.removeItem(k));
}
