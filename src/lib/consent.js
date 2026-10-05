// Cookie / analytics consent — the single source of truth for what the
// visitor allowed. Only ONE optional category exists today (analytics);
// everything else the app stores (session, language, theme, this choice
// itself) is strictly necessary and needs no consent.
//
// Stored as { analytics: boolean, ts } under KEY. `null` = never decided,
// which the banner treats as "ask" and analytics treats as "no".

const KEY = "pitch.consent.v1";

let memory = null;      // fallback when localStorage is unavailable (private mode)
let version = 0;        // bumped on every change — the snapshot for useSyncExternalStore
let prefsOpen = false;  // banner re-opened on purpose (Settings / legal page link)
const listeners = new Set();

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw.analytics === "boolean") return raw;
  } catch { /* no stored choice, or storage unavailable */ }
  return memory;
}

const notify = () => { version += 1; listeners.forEach((fn) => fn()); };

/** The stored choice, or null if the visitor never decided. */
export const getConsent = () => read();
export const hasAnalyticsConsent = () => read()?.analytics === true;

export function setAnalyticsConsent(granted) {
  const rec = { analytics: Boolean(granted), ts: Date.now() };
  memory = rec;
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* lasts this session only */ }
  prefsOpen = false;
  notify();
}

export const openPreferences = () => { prefsOpen = true; notify(); };
export const closePreferences = () => { prefsOpen = false; notify(); };
export const isPreferencesOpen = () => prefsOpen;

export const getVersion = () => version;
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// A choice made (or withdrawn) in another tab applies here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });
}
