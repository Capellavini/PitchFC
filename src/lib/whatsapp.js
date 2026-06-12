const digits = (phone) => (phone || "").replace(/\D/g, "");

/**
 * Open WhatsApp with a pre-filled message.
 * With a phone → direct chat; without → the user picks a chat
 * (useful for posting to the group conversation).
 */
export function openWhatsApp(text, phone) {
  const base = phone ? `https://wa.me/${digits(phone)}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

const appUrl = () => window.location.origin;

export const reminderMessage = (player, game) =>
  `Olá ${player.nick}! ⚽ Vais jogar? ${game.date} às ${game.time} · ${game.venue}. Confirma na app PITCH: ${appUrl()}`;

export const groupReminderMessage = (pendingPlayers, game) =>
  `⚽ ${game.label} — ${game.date} às ${game.time} (${game.venue}). Ainda faltam confirmar: ${pendingPlayers
    .map((p) => p.nick)
    .join(", ")}. Respondam na app PITCH: ${appUrl()}`;

export const chargeMessage = (debtors, priceLabel, game, mbwayPhone) =>
  `💸 ${game.label}: faltam pagar ${priceLabel} — ${debtors
    .map((p) => p.nick)
    .join(", ")}. MB Way para ${mbwayPhone}. Obrigado!`;

export const inviteMessage = (groupName, game) =>
  `⚽ Junta-te ao ${groupName} no PITCH! Jogamos ${game.date} às ${game.time} no ${game.venue}. Entra aqui: ${appUrl()}`;

export const sharePostMessage = (authorNick, text) =>
  `⚽ Vê isto no PITCH — ${authorNick}: "${text}" ${appUrl()}`;

export const accessLinkMessage = (nick, groupName, url) =>
  `⚽ ${nick}, o teu acesso pessoal ao PITCH (${groupName}): ${url} — abre, confirma o jogo de sábado e vê o teu cartão. Sem registo, sem password.`;

export const rateRequestMessage = (nick, url) =>
  `⚽ Olá! Como achas que eu jogo? Avalia o meu cartão PITCH (demora 30 segundos, sem registo): ${url}`;

export const rateResultMessage = (nick, code) =>
  `⚽ Avaliei-te no PITCH, ${nick}! Cola este código na app em Perfil → "Inserir código": ${code}`;
