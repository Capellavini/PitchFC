import { AVATAR_PALETTE } from "../theme";

export const ini = (n) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export const playerColor = (group, p) =>
  AVATAR_PALETTE[group.indexOf(p) % AVATAR_PALETTE.length];

// € formatting, PT style ("€5" / "€4,50")
export const fmtEUR = (n) =>
  n % 1 === 0 ? `€${n}` : `€${n.toFixed(2).replace(".", ",")}`;

// ── Dates ────────────────────────────────────────────────
export const WEEKDAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Next occurrence of a weekday (0=Sunday), formatted "Sábado, 14 Jun". */
export function nextGameDateLabel(weekday) {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + ((weekday - now.getDay() + 7) % 7));
  return `${WEEKDAYS_PT[weekday]}, ${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
}

/** Local-timezone ISO day (YYYY-MM-DD), offset in days from today. */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fromIso = (iso) => new Date(`${iso}T12:00:00`);

/** "Sex 13" — short chip label for a day picker. */
export const dayChipLabel = (iso) => {
  const d = fromIso(iso);
  return `${WEEKDAYS_PT[d.getDay()].slice(0, 3)} ${d.getDate()}`;
};

/** "13 Jun" */
export const fmtDayMonth = (iso) => {
  const d = fromIso(iso);
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
};

/** "Sexta, 13 Jun" */
export const fmtFullDay = (iso) => {
  const d = fromIso(iso);
  return `${WEEKDAYS_PT[d.getDay()]}, ${d.getDate()} ${MONTHS_PT[d.getMonth()]}`;
};

// ── FUT card overall ─────────────────────────────────────
export const ATTR_LABELS = { rit: "RIT", rem: "REM", pas: "PAS", dri: "DRI", def: "DEF", fis: "FIS" };

const OVERALL_WEIGHTS = {
  "Guarda-redes": { def: 0.40, fis: 0.25, pas: 0.15, rit: 0.10, dri: 0.05, rem: 0.05 },
  "Defesa":       { def: 0.35, fis: 0.25, rit: 0.15, pas: 0.15, dri: 0.05, rem: 0.05 },
  "Médio":        { pas: 0.30, dri: 0.20, rit: 0.15, fis: 0.15, rem: 0.10, def: 0.10 },
  "Avançado":     { rem: 0.35, rit: 0.25, dri: 0.20, pas: 0.10, fis: 0.05, def: 0.05 },
};

export function computeOverall(position, attrs) {
  const w = OVERALL_WEIGHTS[position] ?? OVERALL_WEIGHTS["Médio"];
  return Math.round(Object.keys(w).reduce((sum, k) => sum + (attrs?.[k] ?? 60) * w[k], 0));
}

export const POSITION_ABBR = { "Guarda-redes": "GR", "Defesa": "DEF", "Médio": "MED", "Avançado": "AVA" };

// ── Peer ratings ─────────────────────────────────────────
// URL-safe base64 payloads for the no-backend rating flow:
// request link carries the player's identity; the friend's
// answer comes back as a paste-able code. Replaced by real
// rows in Supabase later.
export const encodePayload = (obj) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(obj))));

export function decodePayload(s) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  } catch {
    return null;
  }
}

const ATTR_KEYS = ["rit", "rem", "pas", "dri", "def", "fis"];

/** Average a list of attrs objects, per attribute. */
export function averageAttrs(list) {
  if (!list.length) return null;
  const out = {};
  ATTR_KEYS.forEach((k) => {
    out[k] = Math.round(list.reduce((s, a) => s + (a?.[k] ?? 60), 0) / list.length);
  });
  return out;
}

/** Public card attrs: 50/50 between self-assessment and friends' average. */
export function blendAttrs(self, peerAttrsList) {
  const avg = averageAttrs(peerAttrsList);
  if (!avg) return self;
  const out = {};
  ATTR_KEYS.forEach((k) => {
    out[k] = Math.round(((self?.[k] ?? 60) + avg[k]) / 2);
  });
  return out;
}

// ── Image upload → small base64 (fits localStorage) ─────
export function fileToDataUrl(file, max = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}
