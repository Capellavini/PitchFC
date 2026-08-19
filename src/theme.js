// ─────────────────────────────────────────────────────────
// DESIGN TOKENS — all colors live here, never hardcode hex
// in a component (see CLAUDE.md).
// ─────────────────────────────────────────────────────────
// Navy palette anchored on the brand field artwork:
// surface = the field's background (#121A27 sampled),
// border  = the field's line color (#262E3D sampled).
const DARK = {
  bg:           "#0A0F18",
  surface:      "#121A27",
  card:         "#1A2433",
  border:       "#262E3D",
  accent:       "#C8FF00",
  accentDim:    "rgba(200,255,0,0.07)",
  accentBorder: "rgba(200,255,0,0.20)",
  text1:        "#FFFFFF",
  text2:        "#8A94A8",
  text3:        "#3D4659",
  green:        "#00D08A",
  greenDim:     "rgba(0,208,138,0.12)",
  greenBorder:  "rgba(0,208,138,0.30)",
  red:          "#FF3B5C",
  redDim:       "rgba(255,59,92,0.12)",
  orange:       "#FF9F0A",
  orangeDim:    "rgba(255,159,10,0.12)",
  blue:         "#4895FF",
  blueDim:      "rgba(72,149,255,0.10)",
  blueBorder:   "rgba(72,149,255,0.25)",
};

// "Dusk Light" — a light mode that stays kin to the navy brand instead of
// inverting to a generic white SaaS surface: bg/surface/card step up in
// the same layered-lightness pattern as DARK (bg < surface < card), all
// with a cool navy tint rather than neutral gray. Accent/green/orange/
// blue are all deepened a notch from their dark-mode values — the bright
// dark-mode lime, for instance, is nearly invisible as text on a light
// card — chosen against this cooler ground, not plain white.
const LIGHT = {
  bg:           "#E7ECF5",
  surface:      "#EEF2F9",
  card:         "#F6F8FC",
  border:       "#C9D1E3",
  accent:       "#2E9E3F",
  accentDim:    "rgba(46,158,63,0.10)",
  accentBorder: "rgba(46,158,63,0.30)",
  text1:        "#131C2E",
  text2:        "#5B6784",
  text3:        "#96A1BC",
  green:        "#0B7A56",
  greenDim:     "rgba(11,122,86,0.12)",
  greenBorder:  "rgba(11,122,86,0.30)",
  red:          "#D81E46",
  redDim:       "rgba(216,30,70,0.08)",
  orange:       "#8A5A00",
  orangeDim:    "rgba(138,90,0,0.12)",
  blue:         "#3466C8",
  blueDim:      "rgba(52,102,200,0.10)",
  blueBorder:   "rgba(52,102,200,0.28)",
};

// A plain, mutable object — every component reads C.xxx fresh at render
// time (never destructured/cached at module scope), so switching theme
// is just Object.assign(C, LIGHT|DARK) + a re-render (see applyPalette
// below and src/lib/themeMode.js). This is why C stays a plain object
// literal instead of CSS custom properties: half the app builds colors
// by string-concatenating a hex alpha suffix straight onto a C.xxx value
// (`${C.red}44`), which only works with a real hex string, not a
// var(--x) reference.
export const C = {
  ...DARK,
  // Fixed across both themes on purpose: a green pitch and gold/silver/
  // bronze card tiers should look the same regardless of app chrome.
  whatsapp:     "#25D366",
  grass:        "#0E5C36",
  grassDim:     "rgba(14,160,90,0.08)",
  grassLine:    "rgba(255,255,255,0.07)",
  gold:         "#E8C547",
  goldDim:      "rgba(232,197,71,0.10)",
  silver:       "#C0C8D0",
  bronze:       "#C9824F",
};

export const cardStyle = {
  background: C.card,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  padding: 16,
};

// FIFA-ish italic display style for headings / numbers
export const displayFont = {
  fontWeight: 900,
  fontStyle: "italic",
  letterSpacing: "-0.02em",
};

// Brand assets (public/brand/) — official logo + navy field artwork
export const BRAND = {
  logo:  "/brand/logo.png",   // PITCH Club wordmark, white on transparent
  field: "/brand/field.jpg",  // navy pitch illustration (presentation background)
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** Field-photo backdrop, faded into the CURRENT theme's background —
 *  reads C.bg fresh on every call, so it automatically fades to navy in
 *  dark mode or off-white in light mode (same navy field.jpg photo
 *  either way; only the fade color changes). Used for both the
 *  pre-login brand hero (landing, onboarding) and JogoTab's slot-grid
 *  card, so both need to match whatever theme is currently active.
 *
 *  The photo itself is always dark navy, so the light-mode fade can't
 *  just reuse whatever subtle top/bottom a caller tuned for dark-mode
 *  text staying white on a visible photo — light mode needs the wash
 *  strong enough, throughout, that dark C.text1 text stays legible even
 *  near the top where a dark-mode fade would deliberately stay sheer. */
export const fieldBackdrop = (top = 0.35, bottom = 0.85) => {
  const rgb = hexToRgb(C.bg);
  const isLight = C.bg !== DARK.bg;
  const t = isLight ? Math.max(top, 0.82) : top;
  const b = isLight ? Math.max(bottom, 0.95) : bottom;
  return {
    backgroundImage: `linear-gradient(180deg, rgba(${rgb},${t}) 0%, rgba(${rgb},${b}) 100%), url(${BRAND.field})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
};

export const AVATAR_PALETTE = [
  C.accent, C.blue, C.orange, C.green,
  "#A78BFA", "#FB923C", "#34D399", "#60A5FA",
];

/** Applies the light or dark palette by mutating C/cardStyle/
 *  AVATAR_PALETTE IN PLACE (never reassigning the export bindings, so
 *  every existing `import { C } from "../theme"` keeps working
 *  unchanged) — then a re-render (triggered by the caller) picks up the
 *  new values everywhere, since nothing in this app memoizes on C. */
export function applyPalette(mode) {
  const p = mode === "light" ? LIGHT : DARK;
  Object.assign(C, p);
  cardStyle.background = C.card;
  cardStyle.border = `1px solid ${C.border}`;
  AVATAR_PALETTE[0] = C.accent;
  AVATAR_PALETTE[1] = C.blue;
  AVATAR_PALETTE[2] = C.orange;
  AVATAR_PALETTE[3] = C.green;
}
