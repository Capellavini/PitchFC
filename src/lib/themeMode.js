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
  applyPalette(mode);
  document.documentElement.setAttribute("data-theme", mode === "light" ? "light" : "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[mode] || THEME_COLOR.dark);
}

export function setThemeMode(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* private browsing, etc. */ }
  applyThemeMode(mode);
}
