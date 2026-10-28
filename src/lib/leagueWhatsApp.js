// PITCH Ligas — linking a league manager's WhatsApp to the account (the bot is the
// same number as the weekly-groups Adjunto). The app only builds the message the
// manager sends; the code is checked, used once and expires in 15 minutes
// (league_wa_* RPCs, bot side in wa-bot/src/league).
import { PITCH_AI_NUMBER } from "./core/captainPhrase.js";

export const LINK_CODE = /^LIGA-[A-HJ-NP-Z2-9]{6}$/;

/** The text the manager sends the bot. The code is the proof; the sentence is for humans. */
export const linkMessage = (code) => `Quero ligar o Adjunto da minha liga. Código: ${code}`;

/** wa.me link with the message prefilled; null for anything that is not a code. */
export function linkUrl(code, number = PITCH_AI_NUMBER) {
  if (!LINK_CODE.test(String(code || ""))) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(linkMessage(code))}`;
}

/** What the RPC errors mean for the manager. */
export const LINK_ERROR = Object.freeze({
  rate_limited: "Já geraste muitos códigos. Espera uma hora e tenta outra vez.",
  not_authenticated: "A sessão terminou. Inicia sessão outra vez.",
});
