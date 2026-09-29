// ── Light/dark mode ──────────────────────────────────────
// Dark is the brand default; the choice is explicit and sticky (never
// auto-follows the OS scheme), so an existing user's app never changes
// look without them asking for it. Applying a mode mutates theme.js's
// C object in place (see applyPalette there) — the caller is
// responsible for triggering a re-render afterwards (PitchApp.jsx does
// this by also updating its own themeMode React state).
import { applyPalette } from "../theme";

const KEY = "pitch.themeMode";
const THEME_COLOR = { dark: "#0A0F18", light: "#E7ECF5" };

export const getThemeMode = () => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

/** Applies the mode to C (colors), the <html> attribute (page background
 *  in index.css) and the PWA/browser-chrome meta color. Call once on
 *  boot with the saved mode, and again whenever the user toggles it. */
export function applyThemeMode(mode) {
  try {
    applyPalette(mode);
  } catch (e) {
    // Dev-mode-only: React's development build freezes element props
    // (incl. a shared style object passed by reference, like cardStyle)
    // to catch accidental mutation — this never happens in production,
    // where that freezing is stripped out. Once an object is frozen it
    // stays frozen for the page's lifetime, so this specific reload is
    // the only way back — but the attribute/meta updates below and the
    // localStorage write in setThemeMode still land, so a refresh (or
    // any full navigation) picks up the chosen mode correctly.
    console.warn("[theme] applyPalette couldn't update a frozen style object (dev-mode only) — reload to see the new theme.", e);
  }
  document.documentElement.setAttribute("data-theme", mode === "light" ? "light" : "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[mode] || THEME_COLOR.dark);
}

export function setThemeMode(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* private browsing, etc. */ }
  applyThemeMode(mode);
}
