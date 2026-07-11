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

// One-tap, no-login confirmation link for a specific player.
export const magicConfirmUrl = (token) => `${appUrl()}?confirm=${token}`;

export const reminderMessage = (player, game, url) =>
  `Olá ${player.nick}! ⚽ Vais jogar? ${game.date} às ${game.time} · ${game.venue}. Confirma num toque (sem registo): ${url || appUrl()}`;

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

export const waitlistNudgeMessage = (player, game, pos, url) =>
  `⚽ ${player.nick}! ${pos === 1 ? "És o PRÓXIMO a entrar" : `Estás em ${pos}º`} na lista de espera do ${game.label} (${game.date} às ${game.time}, ${game.venue}). Assim que abrir vaga entras logo — mantém-te disponível e confirma na app: ${url}`;

export const gameShareMessage = (game, url, spotsLeft) =>
  `⚽ ${game.label} — ${game.date} às ${game.time} no ${game.venue}.` +
  (spotsLeft > 0
    ? ` Faltam ${spotsLeft} ${spotsLeft === 1 ? "vaga" : "vagas"}! Entra e confirma`
    : " Equipa completa — entra para acompanhar") +
  `: ${url}`;

/** Full game sheet for the group chat: confirmed list, waitlist,
 *  venue, date/time and price per player. */
export const lineupShareMessage = (game, playing, waitlist, priceLabel, url) => {
  const lines = [
    `⚽ *${game.label}* — ${game.date} às ${game.time}`,
    `📍 ${game.venue}`,
    `💰 ${priceLabel}/jogador`,
    "",
    `✅ *Confirmados (${playing.length}/${game.spots}):*`,
    ...playing.map((p, i) => `${i + 1}. ${p.nick}${p.paid ? " 💸" : ""}`),
  ];
  if (waitlist.length > 0) {
    lines.push("", `⏳ Lista de espera: ${waitlist.map((p) => p.nick).join(", ")}`);
  }
  const left = game.spots - playing.length;
  lines.push("", left > 0
    ? `Faltam ${left} ${left === 1 ? "jogador" : "jogadores"} — confirma aqui: ${url}`
    : `Equipa completa! Vê tudo na app: ${url}`);
  return lines.join("\n");
};

export const sharePostMessage = (authorNick, text) =>
  `⚽ Vê isto no PITCH — ${authorNick}: "${text}" ${appUrl()}`;

export const accessLinkMessage = (nick, groupName, url) =>
  `⚽ ${nick}, o teu acesso pessoal ao PITCH (${groupName}): ${url} — abre, confirma o jogo de sábado e vê o teu cartão. Sem registo, sem password.`;

export const groupInviteMessage = (groupName, url) =>
  `⚽ Junta-te ao ${groupName} no PITCH! Cria a tua conta e entras logo no grupo: ${url}`;

export const rateRequestMessage = (nick, url) =>
  `⚽ Olá! Como achas que eu jogo? Avalia o meu cartão PITCH (demora 30 segundos, sem registo): ${url}`;

export const rateResultMessage = (nick, code) =>
  `⚽ Avaliei-te no PITCH, ${nick}! Cola este código na app em Perfil → "Inserir código": ${code}`;
