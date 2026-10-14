// ─────────────────────────────────────────────────────────
// PITCH Rivals — "O Pitch AI ajuda-te a montar a equipa" (decision
// 2026-10-13 b). The app opens wa.me with a prefilled captain message;
// the WhatsApp bot recognises that SAME message (regex, never an LLM —
// the sender is usually unlinked) and replies with the team onboarding
// guide. Both sides import this file (the bot gets a generated copy via
// scripts/sync-core.mjs), so the text the app writes and the pattern the
// bot reads can never drift apart.
//
// Pure ESM, no imports.
// ─────────────────────────────────────────────────────────

/** The PITCH bot's WhatsApp number (E.164 digits, wa.me format). */
export const PITCH_AI_NUMBER = "351913813845";

const MAX_TEAM = 60;
const clean = (s) => String(s ?? "").replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_TEAM);

const TEMPLATES = {
  pt: (team) => `Olá PITCH! Criei a equipa «${team}» e quero ajuda para montar o plantel.`,
  "pt-br": (team) => `Olá PITCH! Criei o time «${team}» e quero ajuda para montar o elenco.`,
  en: (team) => `Hi PITCH! I created the team «${team}» and I want help building the squad.`,
};

/** Normalises an app language code ("pt" | "pt-br" | "en" | "ptbr"). */
export function phraseLangOf(lang) {
  const l = String(lang || "").toLowerCase();
  if (l === "pt-br" || l === "ptbr") return "pt-br";
  if (l.startsWith("en")) return "en";
  return "pt";
}

/** The prefilled captain message in the viewer's language. */
export function captainHelpText(team, lang = "pt") {
  return TEMPLATES[phraseLangOf(lang)](clean(team) || "?");
}

/** wa.me link that opens a chat with the PITCH bot, message prefilled. */
export function captainHelpUrl(team, lang = "pt") {
  return `https://wa.me/${PITCH_AI_NUMBER}?text=${encodeURIComponent(captainHelpText(team, lang))}`;
}

/** Lowercase, accents/punctuation/emoji stripped, single spaces. */
function normalize(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
}

// The WHOLE message must be the request (like the Adjunto activation
// phrase): a greeting and "PITCH" are optional, the team name is free text
// in the middle, and small wording variations a captain might type by
// hand are accepted. "a equipa do benfica é boa" never matches.
const PT_GREET = "(?:(?:ola|oi|ei|bom dia|boa tarde|boa noite) )?(?:(?:pitch|pitch ai|pitch fc) )?";
const PT_MADE = "(?:criei|acabei de criar|fiz|montei)";
const PT_TEAM = "(?:a (?:minha )?equipa|o (?:meu )?time|uma equipa|um time|a equipe|uma equipe)";
const PT_WANT = "(?:quero|queria|preciso de|precisava de|gostava de|gostaria de)";
const PT_SQUAD = "(?:o (?:meu |nosso )?plantel|o (?:meu |nosso )?elenco|a (?:minha |nossa )?equipa|o (?:meu |nosso )?time|a (?:minha |nossa )?equipe)";
const PT_RE = new RegExp(`^${PT_GREET}${PT_MADE} ${PT_TEAM}(?: (.{1,${MAX_TEAM}}?))? e ${PT_WANT} (?:uma )?ajuda (?:para|pra|a) montar ${PT_SQUAD}(?: (?:por favor|pf|pfv|obrigado|obrigada))?$`);

const EN_GREET = "(?:(?:hi|hello|hey|good morning|good afternoon|good evening) )?(?:(?:pitch|pitch ai|pitch fc) )?";
const EN_RE = new RegExp(`^${EN_GREET}i (?:just )?(?:created|made|set up) (?:the|my|a|our) team(?: (.{1,${MAX_TEAM}}?))? and i (?:want|would like|d like|need) (?:some )?help (?:building|to build|with|putting together) (?:the|my|our) (?:squad|team|roster)(?: please)?$`);

/**
 * Is this DM the captain's "help me build my team" message?
 * → { lang: "pt" | "pt-br" | "en", team: string | null } or null.
 * `team` is only a hint (the bot looks the captain up by phone number);
 * it comes from «…» / quotes when present, else from the free-text slot.
 */
export function parseCaptainPhrase(text) {
  const raw = String(text ?? "");
  if (!raw.trim() || raw.length > 240) return null;
  const n = normalize(raw);
  const quoted = raw.match(/[«"“]([^»"”]{1,60})[»"”]/)?.[1];
  let m = n.match(PT_RE);
  if (m) {
    const br = /\b(time|elenco|equipe|pra)\b/.test(n.replace(/\b(?:ola|oi)\b/, "")) && !/\b(equipa|plantel)\b/.test(n);
    return { lang: br ? "pt-br" : "pt", team: clean(quoted ?? m[1]) || null };
  }
  m = n.match(EN_RE);
  if (m) return { lang: "en", team: clean(quoted ?? m[1]) || null };
  return null;
}
