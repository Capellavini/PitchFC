// Presentation mode (/demo): the whole app on seeded local data, no login,
// no Supabase — even on a production build that has the keys. Evaluated once
// at module load (supabase.js and storage.js read it before React mounts).
//
// Entry: /demo (launcher) or any URL with ?demo=1. The choice sticks for the
// tab via sessionStorage so in-app navigation (window.location.href jumps to
// /league/demo, /rivals…) stays in demo. "Sair da demo" clears it.
const FLAG = "pitch.presentation";

function detect() {
  if (typeof window === "undefined") return false;
  try {
    const { pathname, search } = window.location;
    if (/^\/demo\/?$/.test(pathname) || new URLSearchParams(search).get("demo") === "1") {
      sessionStorage.setItem(FLAG, "1");
      return true;
    }
    if (new URLSearchParams(search).get("demo") === "0") {
      sessionStorage.removeItem(FLAG);
      return false;
    }
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export const presentationMode = detect();

// Seeded dates are relative to "today" (game tonight, results last week…).
// Persisted copies would go stale on the next day, so once per calendar day
// the demo data is dropped and re-seeded; only the persona choice survives.
const KEEP = ["session", "homeContexts", "tourSeen_v1", "whatsNew_nav5_v1", "aiOnboardingDone", "lang", "seedDate"];
if (presentationMode) {
  try {
    const NS = "pitch.demo.v1.";
    const today = new Date().toDateString();
    if (localStorage.getItem(NS + "seedDate") !== JSON.stringify(today)) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(NS) && !KEEP.includes(k.slice(NS.length)))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(NS + "seedDate", JSON.stringify(today));
    }
  } catch { /* storage unavailable: in-memory only */ }
}

export function exitPresentation() {
  try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
  window.location.href = "/?demo=0";
}
