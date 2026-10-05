// Treinador Adjunto — who is writing to the bot in a DM, and is it an
// activation request? Pure except resolveDmIdentity's optional LID lookup
// (injected), so it is unit-tested without a socket.
//
// Baileys v7 DMs can arrive as remoteJid=…@lid with remoteJidAlt=…@s.whatsapp.net
// (older builds used key.senderPn). Groups, broadcasts, status and
// newsletters are never DMs.

const uniq = (a) => [...new Set(a.filter(Boolean))];

/** "351912345678:12@s.whatsapp.net" → "351912345678@s.whatsapp.net" (device suffix dropped). */
export function bareJid(j) {
  if (typeof j !== "string" || !j.includes("@")) return null;
  const [user, server] = j.split("@");
  const s = server === "c.us" ? "s.whatsapp.net" : server;
  return `${user.split(":")[0]}@${s}`;
}

/** True only for 1:1 chats (phone-number or privacy-id form). */
export function isDmJid(jid) {
  if (typeof jid !== "string") return false;
  if (jid === "status@broadcast" || jid.endsWith("@broadcast") || jid.endsWith("@newsletter") || jid.endsWith("@g.us")) return false;
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid") || jid.endsWith("@c.us");
}

/** E.164 digits of a phone-number JID, else null (an @lid carries no phone). */
export function pnDigits(jid) {
  const b = bareJid(jid);
  if (!b || !b.endsWith("@s.whatsapp.net")) return null;
  const d = b.split("@")[0].replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

/** Every jid form we know for this DM + the sender's phone digits.
 *  lidMapping: Baileys' sock.signalRepository.lidMapping (optional). */
export async function resolveDmIdentity(key, lidMapping) {
  const chatJid = key?.remoteJid ?? null;
  const all = uniq([chatJid, key?.remoteJidAlt, key?.senderPn, key?.senderLid].map(bareJid));
  const lid = all.find((j) => j.endsWith("@lid")) ?? null;
  let pnJid = all.find((j) => j.endsWith("@s.whatsapp.net")) ?? null;
  if (!pnJid && lid && lidMapping?.getPNForLID) {
    try {
      const mapped = await lidMapping.getPNForLID(lid);
      if (mapped) pnJid = bareJid(String(mapped).includes("@") ? String(mapped) : `${mapped}@s.whatsapp.net`);
    } catch { /* unmapped: no phone */ }
  }
  return { chatJid, jids: uniq([...all, pnJid]), lid, pn: pnJid ? pnDigits(pnJid) : null };
}

/** "…7890" — never log a full phone/jid. */
export const maskJid = (j) => (j ? `…${String(j).split("@")[0].slice(-4)}` : "?");

/** Lowercase, accents and punctuation/emoji stripped, single spaces. */
export function normalize(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Activation code from the app's prefilled text ("… Código: ADJ-7K3QX9"). */
export function parseActivationCode(text) {
  const m = String(text ?? "").toUpperCase().match(/\bADJ-([A-HJ-NP-Z2-9]{6})\b/);
  return m ? `ADJ-${m[1]}` : null;
}

// Decision 11: regex only (no LLM for unlinked senders), on normalized text,
// and the WHOLE message must be the request — "o adjunto do benfica é bom"
// must not match. A verb/greeting is optional, but without a verb only the
// bare name (plus an article) is accepted.
const GREET = "(?:ola|oi|ei|hey|hi|hello|bom dia|boa tarde|boa noite)";
const VERB = "(?:(?:eu )?(?:quero|queria|gostava de|gostaria de|preciso(?: de| do| da)?|ativa|ativar|ative|activa|activar|liga|ligar|ligue)"
  + "(?: (?:ativar|activar|ligar|ter|o|a))?"
  + "|i (?:want|would like|d like)(?: to)?(?: (?:activate|enable|have|get))?|activate|enable|turn on|please activate)";
const ART = "(?:(?:o|a|do|da|meu|o meu|um|the|my|an|a) )?";
const NAME = "(?:treinador adjunto|adjunto|auxiliar tecnico|assistant coach)";
const TAIL = "(?: (?:do|da|de|dos|das|no|na|pro|pra|para|para o|para a|for|for the|in|of) [a-z0-9' .-]{1,40})?";
const POLITE = "(?: (?:por favor|pf|pfv|please|pls|obrigado|obrigada|thanks))?";
const WITH_VERB = new RegExp(`^(?:${GREET} )?${VERB} ${ART}${NAME}${TAIL}${POLITE}$`);
const GREET_ONLY = new RegExp(`^${GREET} ${ART}${NAME}${POLITE}$`);
const BARE = new RegExp(`^${ART}${NAME}$`);

export function isActivationPhrase(text) {
  const n = normalize(text);
  if (!n || n.length > 120) return false;
  return WITH_VERB.test(n) || GREET_ONLY.test(n) || BARE.test(n);
}

/** Best guess of an unlinked sender's language from the phrase itself. */
export function phraseLang(text) {
  const n = normalize(text);
  if (/assistant coach|\bi (want|would|d like)\b|\bactivate\b|\benable\b|\bhello\b|\bhi\b/.test(n)) return "en";
  if (/auxiliar tecnico|\boi\b/.test(n)) return "ptbr";
  return "pt";
}
