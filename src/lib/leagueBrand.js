// PITCH Ligas — a league's brand from its logo: the file is shrunk to a small
// PNG kept inside the league document, and the league colour is taken from the
// logo itself (the most present, clearly coloured shade; never the white or
// black background). dominantColor is pure; logoFromFile needs a browser.

export const LOGO_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
export const MAX_LOGO_FILE = 4 * 1024 * 1024;
const MAX_LOGO_DATA_URL = 140_000; // chars: a 256 px PNG is usually 10–40 KB

const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();

/** Dominant chromatic colour of RGBA pixels as "#RRGGBB", or null when the image has none (all grey/white/black/transparent). */
export function dominantColor(pixels) {
  const buckets = new Map();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 160) continue;
    const r = pixels[i]; const g = pixels[i + 1]; const b = pixels[i + 2];
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (l > 0.93 || l < 0.1 || s < 0.28) continue; // backgrounds, outlines, greys
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, w: 0 };
    cur.n += 1; cur.r += r; cur.g += g; cur.b += b; cur.w += 0.5 + s; // vivid shades win ties against muddy ones
    buckets.set(key, cur);
  }
  let best = null;
  for (const v of buckets.values()) if (!best || v.w > best.w) best = v;
  if (!best) return null;
  return `#${hex(Math.round(best.r / best.n))}${hex(Math.round(best.g / best.n))}${hex(Math.round(best.b / best.n))}`;
}

/** Readable text colour (black or white) on a background colour. */
export function onColor(bg) {
  const m = /^#([0-9a-f]{6})$/i.exec(bg || "");
  if (!m) return "#000000";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? "#000000" : "#FFFFFF";
}

/** An image File → { dataUrl, color } (square-fit PNG ≤ 256 px, colour or null) or { error }. */
export async function logoFromFile(file) {
  if (!file) return { error: "no_file" };
  if (!LOGO_TYPES.includes(file.type)) return { error: "unsupported" };
  if (file.size > MAX_LOGO_FILE) return { error: "too_large" };
  try {
    const bitmap = await createImageBitmap(file);
    for (const max of [256, 192, 128]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale)); const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/png");
      if (dataUrl.length <= MAX_LOGO_DATA_URL) return { dataUrl, color: dominantColor(ctx.getImageData(0, 0, w, h).data) };
    }
    return { error: "too_large" };
  } catch {
    return { error: "unreadable" };
  }
}

/** Only the small PNG data URLs this module makes (or https) may be drawn as a logo. */
export const safeLogo = (src) => (typeof src === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(src) && src.length <= MAX_LOGO_DATA_URL ? src : null);
