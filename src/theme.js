// ─────────────────────────────────────────────────────────
// DESIGN TOKENS — all colors live here, never hardcode hex
// in a component (see CLAUDE.md).
// ─────────────────────────────────────────────────────────
export const C = {
  bg:           "#07070A",
  surface:      "#111114",
  card:         "#18181E",
  border:       "#22222C",
  accent:       "#C8FF00",
  accentDim:    "rgba(200,255,0,0.07)",
  accentBorder: "rgba(200,255,0,0.20)",
  text1:        "#FFFFFF",
  text2:        "#7C7C8A",
  text3:        "#35353F",
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
  whatsapp:     "#25D366",
  // Football theming — pitch & FUT card tiers
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

export const AVATAR_PALETTE = [
  C.accent, C.blue, C.orange, C.green,
  "#A78BFA", "#FB923C", "#34D399", "#60A5FA",
];
