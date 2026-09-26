// Pure helpers for "confirm / drop out from the chat": who is the sender,
// what did they ask for, and where do they land (playing vs waiting list).
// No I/O, so it is unit-tested.

/** Digits only, no leading 00. "+351 912 345 678" -> "351912345678". */
export const digits = (s) => String(s ?? "").replace(/\D/g, "").replace(/^00/, "");

/**
 * Same phone if the last 9 digits match. Players are stored with or without
 * country code ("912345678" vs "351912345678"); comparing the national part
 * handles both. Anything shorter than 8 digits never matches (junk data).
 */
export function phonesMatch(a, b) {
  const x = digits(a), y = digits(b);
  if (x.length < 8 || y.length < 8) return false;
  const n = Math.min(9, x.length, y.length);
  return x.slice(-n) === y.slice(-n);
}

/** Mirror of splitWaitlist in src/lib/helpers.js: mensalistas outrank unlocked avulsos, then responded_at. */
export function splitWaitlist(confirmed, spots) {
  const tier = (p) => (p.playerType === "avulso" && !p.priorityLocked ? 1 : 0);
  const ts = (p) => (p.respondedAt ? new Date(p.respondedAt).getTime() : 0);
  const ordered = [...confirmed].sort((a, b) => tier(a) - tier(b) || ts(a) - ts(b));
  return { playing: ordered.slice(0, spots), waitlist: ordered.slice(spots) };
}

// ── Intent ────────────────────────────────────────────────────────────────
// Deliberately strict: the whole (short) message must BE the intent. A side
// effect on someone's attendance must never come from a stray "vou levar a
// bola" or "eu vou?" — those fall through to the Q&A path.

const norm = (t) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

const FILLERS = /^(ok|okay|entao|sim|pitch|pode|hey|oi|ola|please|pf|por favor)\s+|\s+(sim|la|pitch|pf|por favor|please|tambem|ai|ok)$/;

const DECLINE = [
  /^nao (vou|posso|consigo|da|conto)( mais)?( poder)?( mais)?( ir| jogar| dar)?( mais)?$/,
  /^(desisto|desisti|desistir|vou desistir|to fora|tou fora|estou fora|fora|me tira|tira me|saio)( mais)?$/,
  /^cancela( a)?( minha)?( presenca| vaga)?$/,
  /^(i'?m|i am|im) out$/, /^(count me out|drop out|out|i'?ll pass|not coming)$/,
  /^(i'?m|i am|im) not (coming|going|playing)( anymore)?$/,
  /^(i )?(can't|cant|cannot) (make it|come|play)( anymore)?$/,
];
const CONFIRM = [
  /^(eu )?(vou|jogo|to dentro|tou dentro|estou dentro|dentro|confirmo|confirmado|presente|bora)$/,
  /^conta (comigo|com migo)$/,
  /^(i'?m|i am|im) (in|coming)$/, /^(count me in|in|coming|confirm|confirmed|i'?ll (be there|play))$/,
];

/** @returns {{intent:"confirm"|"decline", lang:"pt"|"en"}|null} */
export function parseIntent(text) {
  if (!text || text.includes("?")) return null;
  let t = norm(text);
  for (let i = 0; i < 2; i++) t = t.replace(FILLERS, "").trim();
  if (!t || t.split(" ").length > 6) return null;
  const isEn = (s) => /'|\b(in|out|count|coming|going|playing|make|drop|pass|confirm|confirmed|am|be|anymore|not)\b/.test(s);
  for (const re of DECLINE) if (re.test(t)) return { intent: "decline", lang: isEn(t) ? "en" : "pt" };
  for (const re of CONFIRM) if (re.test(t)) return { intent: "confirm", lang: isEn(t) ? "en" : "pt" };
  return null;
}

/** "@Pitch enquete" / "post a poll": ask the bot to post its attendance poll (organizers only). */
export function parseCommand(text) {
  if (!text) return null;
  const t = norm(text);
  if (t.split(" ").length > 14) return null;
  // A request = a "poll" word plus a create-verb ("crie uma enquete pro jogo dessa semana",
  // "pode criar uma enquete?"). A bare "enquete" also counts. Asking ABOUT polls ("qual a
  // enquete?", "a enquete esta boa") has no create-verb, so it is not a command.
  const ptPoll = /\benquete\b/.test(t), enPoll = /\bpoll\b/.test(t);
  if (ptPoll && (/\b(cri\w*|faz\w*|fac\w*|mand\w*|post\w*|abr\w*|lanc\w*|prepar\w*|gera\w*)\b/.test(t) || t === "enquete")) return { command: "poll", lang: "pt" };
  if (enPoll && (/\b(creat\w*|mak\w*|post\w*|send\w*|start\w*|open\w*|set\w*)\b/.test(t) || t === "poll")) return { command: "poll", lang: "en" };
  return null;
}

// ── Replies (PT-PT / PT-BR / EN) ────────────────────────────────────────────
const left = {
  pt: (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`),
  ptbr: (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`),
  en: (n) => (n === 1 ? "1 spot left" : `${n} spots left`),
};

export const actionReplies = {
  confirmed: {
    pt: ({ nick, c, s }) => `✅ ${nick}, estás dentro! ${c}/${s}${c < s ? ` — ${left.pt(s - c)}` : " — jogo fechado"}.`,
    ptbr: ({ nick, c, s }) => `✅ ${nick}, você tá dentro! ${c}/${s}${c < s ? ` — ${left.ptbr(s - c)}` : " — rachão fechado"}.`,
    en: ({ nick, c, s }) => `✅ ${nick}, you're in! ${c}/${s}${c < s ? ` — ${left.en(s - c)}` : " — game full"}.`,
  },
  waitlist: {
    pt: ({ nick, pos }) => `📋 ${nick}, ficas na lista de espera (posição ${pos}). Se alguém cair, entras por ordem.`,
    ptbr: ({ nick, pos }) => `📋 ${nick}, você fica na lista de espera (posição ${pos}). Se alguém sair, você entra por ordem.`,
    en: ({ nick, pos }) => `📋 ${nick}, you're on the waiting list (#${pos}). If someone drops out, you move up in order.`,
  },
  already: {
    pt: ({ nick }) => `👍 ${nick}, já estavas confirmado.`,
    ptbr: ({ nick }) => `👍 ${nick}, você já estava confirmado.`,
    en: ({ nick }) => `👍 ${nick}, you were already confirmed.`,
  },
  declined: {
    pt: ({ nick }) => `👋 ${nick}, ok, ficas de fora. Se mudares de ideias, diz "@Pitch eu vou".`,
    ptbr: ({ nick }) => `👋 ${nick}, ok, você fica de fora. Se mudar de ideia, é só falar "@Pitch eu vou".`,
    en: ({ nick }) => `👋 ${nick}, got it, you're out. Changed your mind? Say "@Pitch I'm in".`,
  },
  no_game: {
    pt: () => "Não há jogo aberto neste momento.",
    ptbr: () => "Não tem jogo aberto no momento.",
    en: () => "There's no open game right now.",
  },
  not_found: {
    pt: ({ link }) => `Não encontrei o teu número neste grupo. Confirma pelo link: ${link}`,
    ptbr: ({ link }) => `Não encontrei seu número neste grupo. Confirme pelo link: ${link}`,
    en: ({ link }) => `I couldn't match your number in this group. Use the link: ${link}`,
  },
  window: {
    pt: () => "As confirmações ainda não abriram.",
    ptbr: () => "As confirmações ainda não abriram.",
    en: () => "Confirmations haven't opened yet.",
  },
  window_named: {
    pt: ({ nick }) => `${nick}, as confirmações ainda não abriram — o teu voto não foi contado.`,
    ptbr: ({ nick }) => `${nick}, as confirmações ainda não abriram — seu voto não foi contado.`,
    en: ({ nick }) => `${nick}, confirmations haven't opened yet — your vote wasn't counted.`,
  },
  vote_not_found: {
    pt: ({ tag, link }) => `${tag} não consegui ligar o teu número a nenhum jogador do grupo, por isso o teu voto não foi contado. Confirma pelo link: ${link}`,
    ptbr: ({ tag, link }) => `${tag} não consegui ligar seu número a nenhum jogador do grupo, por isso seu voto não foi contado. Confirme pelo link: ${link}`,
    en: ({ tag, link }) => `${tag} I couldn't match your number to any player in this group, so your vote wasn't counted. Use the link: ${link}`,
  },
  organizer_only: {
    pt: () => "Só o organizador pode pedir a enquete.",
    ptbr: () => "Só o organizador pode pedir a enquete.",
    en: () => "Only the organizer can ask for the poll.",
  },
};
