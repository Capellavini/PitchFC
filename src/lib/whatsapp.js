import { GAME, GROUP_NAME, INVITE_URL } from "../data";

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

export const reminderMessage = (player) =>
  `Olá ${player.nick}! ⚽ Vais jogar no sábado? ${GAME.date} às ${GAME.time} · ${GAME.field}. Confirma na app PITCH!`;

export const groupReminderMessage = (pendingPlayers) =>
  `⚽ ${GAME.label} — ${GAME.date} às ${GAME.time} (${GAME.field}). Ainda faltam confirmar: ${pendingPlayers
    .map((p) => p.nick)
    .join(", ")}. Respondam na app PITCH!`;

export const chargeMessage = (debtors, priceEach, mbwayPhone) =>
  `💸 Jogo de ${GAME.date}: faltam pagar €${priceEach} — ${debtors
    .map((p) => p.nick)
    .join(", ")}. MB Way para ${mbwayPhone}. Obrigado!`;

export const inviteMessage = () =>
  `⚽ Junta-te ao ${GROUP_NAME} no PITCH! Jogamos ${GAME.recurring.toLowerCase()} no ${GAME.field}. Entra aqui: ${INVITE_URL}`;
