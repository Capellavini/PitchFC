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
