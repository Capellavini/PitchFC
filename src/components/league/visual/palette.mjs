/** Isolated preparation. No application imports or side effects. */
export const PITCH_BRAND = Object.freeze({
  background: '#0A0F18', surface: '#121A27', raised: '#1A2433',
  border: '#262E3D', accent: '#C8FF00', onAccent: '#0A0F18',
  text: '#FFFFFF', muted: '#A7B2C5', success: '#70D8AD',
  warning: '#F3CB86', danger: '#FF718B',
});

export const PITCH_LAYOUT = Object.freeze({
  spacing: Object.freeze([4, 8, 12, 16, 24, 32, 48, 64]),
  radius: Object.freeze({ control: 8, panel: 10, dialog: 14 }),
  type: Object.freeze({ caption: 12, body: 14, mobileBody: 16, section: 24, title: 40 }),
  touchTarget: 44,
  breakpoints: Object.freeze({ mobile: 640, compact: 1024, wide: 1440 }),
});

const DEFAULT_LEAGUE = '#355BC4';
const INK = '#151D2A';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const MUTED_ON_STRONG = '#CBD6E7';
const clamp = n => Math.min(255, Math.max(0, Math.round(n)));
const parse = color => color.slice(1).match(/../g).map(v => parseInt(v, 16));
const hex = values => '#' + values.map(v => clamp(v).toString(16).padStart(2, '0')).join('').toUpperCase();

export function normalizeHex(value, fallback = DEFAULT_LEAGUE) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(cleaned)) {
    return '#' + cleaned.slice(1).split('').map(c => c + c).join('').toUpperCase();
  }
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned.toUpperCase() : fallback;
}

export function mixHex(first, second, secondShare) {
  const a = parse(normalizeHex(first));
  const b = parse(normalizeHex(second));
  const share = Math.max(0, Math.min(1, secondShare));
  return hex(a.map((channel, index) => channel * (1 - share) + b[index] * share));
}

function luminance(color) {
  const channels = parse(normalizeHex(color)).map(channel => {
    const v = channel / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Tenant colors affect public league pages, independently of app branding. */
export function createLeaguePalette(input = DEFAULT_LEAGUE) {
  const primary = normalizeHex(input);
  const onPrimary = contrastRatio(primary, WHITE) >= 4.5 ? WHITE
    : contrastRatio(primary, INK) >= 4.5 ? INK : BLACK;
  let link = primary;
  for (let share = 0.05; contrastRatio(link, WHITE) < 4.5 && share <= 1; share += 0.05) {
    link = mixHex(primary, INK, share);
  }
  let deep = mixHex(primary, INK, 0.55);
  for (let share = 0.60; contrastRatio(deep, MUTED_ON_STRONG) < 4.5 && share <= 1; share += 0.05) {
    deep = mixHex(primary, INK, share);
  }
  return Object.freeze({
    '--pitch-league-primary': primary,
    '--pitch-league-on-primary': onPrimary,
    '--pitch-league-deep': deep,
    '--pitch-league-soft': mixHex(primary, WHITE, 0.92),
    '--pitch-league-link': link,
    '--pitch-league-stroke': mixHex(primary, WHITE, 0.70),
  });
}
