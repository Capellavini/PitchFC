// ─────────────────────────────────────────────────────────
// Pending Rivals intent — "I opened a team invite (?tjoin=) and still
// have to sign up / log in / build my card before I can accept it".
//
// Survives the round trips that drop the URL: the auth form, the
// email-confirmation link (lands on the Site URL with no params) and a
// reload. Two copies, same as the group ?join= flow:
//   • localStorage `pitch.v2.pendingIntent` (7 days) — same browser;
//   • the account's user_metadata (`tjoin_token` / `desafio_token`, set at
//     signUp) — a different browser/device after the confirm email.
// Storage is injectable so the logic is unit-testable under node.
// ─────────────────────────────────────────────────────────

export const INTENT_KEY = "pitch.v2.pendingIntent";
export const OPT_IN_KEY = "pitch.v2.rivalsOptIn";
export const INTENT_TTL_MS = 7 * 864e5;
const KINDS = ["tjoin", "desafio"];
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

const store = (s) => s ?? (typeof localStorage !== "undefined" ? localStorage : null);
const valid = (kind, token) => KINDS.includes(kind) && TOKEN_RE.test(String(token || ""));

/** { kind, token } from a URL search string (?tjoin= wins over ?desafio=). */
export function intentFromSearch(search = "") {
  const q = new URLSearchParams(search);
  for (const kind of KINDS) {
    const token = (q.get(kind) || "").trim();
    if (valid(kind, token)) return { kind, token };
  }
  return null;
}

/** { kind, token } from Supabase user_metadata written at signUp. */
export function intentFromMetadata(meta) {
  if (!meta) return null;
  if (valid("tjoin", meta.tjoin_token)) return { kind: "tjoin", token: meta.tjoin_token };
  if (valid("desafio", meta.desafio_token)) return { kind: "desafio", token: meta.desafio_token };
  return null;
}

/** The signUp metadata for an intent ({} when there's none). */
export const intentMetadata = (intent) =>
  intent && valid(intent.kind, intent.token) ? { [`${intent.kind}_token`]: intent.token } : {};

export function savePendingIntent(intent, { storage, now = Date.now() } = {}) {
  const s = store(storage);
  if (!s || !intent || !valid(intent.kind, intent.token)) return;
  try { s.setItem(INTENT_KEY, JSON.stringify({ kind: intent.kind, token: intent.token, at: now })); } catch { /* storage full/blocked */ }
}

/** The saved intent, or null when missing / malformed / older than 7 days
 *  (an expired one is cleared on read). */
export function readPendingIntent({ storage, now = Date.now() } = {}) {
  const s = store(storage);
  if (!s) return null;
  try {
    const v = JSON.parse(s.getItem(INTENT_KEY));
    if (!v || !valid(v.kind, v.token) || !(now - Number(v.at) < INTENT_TTL_MS)) {
      if (v) s.removeItem(INTENT_KEY);
      return null;
    }
    return { kind: v.kind, token: v.token };
  } catch {
    return null;
  }
}

export function clearPendingIntent({ storage } = {}) {
  const s = store(storage);
  try { s?.removeItem(INTENT_KEY); } catch { /* ignore */ }
}

/** Pilot opt-in (?rivals=1): persisted until logout/reset. */
export function readRivalsOptIn({ storage } = {}) {
  try { return store(storage)?.getItem(OPT_IN_KEY) === "true"; } catch { return false; }
}
export function saveRivalsOptIn(on, { storage } = {}) {
  try {
    const s = store(storage);
    if (on) s?.setItem(OPT_IN_KEY, "true"); else s?.removeItem(OPT_IN_KEY);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────
// Pending "create my team" intent (decision 2026-10-13 a): the /rivals
// form signs the captain up and the team is created once the
// confirmation link brings them back logged in (and their quick player
// card exists). Kept apart from the tjoin/desafio intent (own key) so the
// two never overwrite each other. Two copies, like the tjoin flow:
//   • localStorage `pitch.v2.pendingCreateTeam` (7 days) — same browser;
//   • user_metadata.pending_intent (written at signUp) — other device.
// ─────────────────────────────────────────────────────────

export const CREATE_KEY = "pitch.v2.pendingCreateTeam";
const TEAM_FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "11v11"];
const str = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** LP format chip → team preferred_format. */
export const formatFromModality = (m) => ({ F5: "5v5", F7: "7v7", F11: "11v11" })[m] ?? null;
/** Market from the captain's WhatsApp (E.164): +55 → BR, anything else → PT. */
export const countryFromPhone = (phone) => (String(phone || "").replace(/[^\d+]/g, "").startsWith("+55") ? "BR" : "PT");

/** Only the create_team fields we accept from a draft (null if unusable). */
export function sanitizeTeamDraft(t) {
  if (!t || typeof t !== "object") return null;
  const name = str(t.name, 40);
  if (name.length < 2) return null;
  const out = { name, country: t.country === "BR" ? "BR" : "PT" };
  const city = str(t.city, 60);
  if (city) out.city = city;
  if (TEAM_FORMATS.includes(t.format)) out.format = t.format;
  return out;
}

const sanitizeCaptain = (c) => (c && typeof c === "object" ? { name: str(c.name, 60), phone: str(c.phone, 20) } : null);

/** { kind: "create_team", team, captain? } or null. */
export function makeCreateIntent(team, captain) {
  const t = sanitizeTeamDraft(team);
  if (!t) return null;
  const cap = sanitizeCaptain(captain);
  return cap && (cap.name || cap.phone) ? { kind: "create_team", team: t, captain: cap } : { kind: "create_team", team: t };
}

/** signUp metadata carrying the intent ({} when there's none). */
export const createIntentMetadata = (intent) => {
  const v = intent && makeCreateIntent(intent.team);
  return v ? { pending_intent: v } : {};
};

/** The intent stored on the account at signUp (null when absent/invalid). */
export function createIntentFromMetadata(meta) {
  const p = meta?.pending_intent;
  if (!p || p.kind !== "create_team") return null;
  return makeCreateIntent(p.team, { name: meta?.name, phone: meta?.phone });
}

export function saveCreateIntent(intent, { storage, now = Date.now() } = {}) {
  const s = store(storage);
  const v = intent && makeCreateIntent(intent.team, intent.captain);
  if (!s || !v) return;
  try { s.setItem(CREATE_KEY, JSON.stringify({ ...v, at: now })); } catch { /* storage full/blocked */ }
}

export function readCreateIntent({ storage, now = Date.now() } = {}) {
  const s = store(storage);
  if (!s) return null;
  try {
    const raw = JSON.parse(s.getItem(CREATE_KEY));
    const v = raw && raw.kind === "create_team" ? makeCreateIntent(raw.team, raw.captain) : null;
    if (!v || !(now - Number(raw.at) < INTENT_TTL_MS)) {
      if (raw) s.removeItem(CREATE_KEY);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function clearCreateIntent({ storage } = {}) {
  try { store(storage)?.removeItem(CREATE_KEY); } catch { /* ignore */ }
}
