// PT-PT copy. Deterministic templates on purpose: structured facts (spots,
// dates, link) must never be paraphrased by a model.
import { formatGameWhen } from "./time.js";

const falta = (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`);

export const messages = {
  game_open: ({ game, spots, link }) =>
    `⚽ *Jogo aberto!*\n${formatGameWhen(game.scheduled_at)}${game.venue ? ` · ${game.venue}` : ""}\n${spots} vagas — confirma aqui:\n${link}`,

  milestone: ({ game, confirmed, spots, link }) =>
    confirmed === spots
      ? `✅ *Jogo fechado!* ${confirmed}/${spots} confirmados para ${formatGameWhen(game.scheduled_at)}.\nQuem ainda quiser entra na lista de espera:\n${link}`
      : `📋 Já são ${confirmed} confirmados — ${confirmed - spots} na lista de espera. Se alguém cair, entra por ordem.`,

  spot_opened: ({ game, confirmed, spots, link }) =>
    `🔓 *Abriu vaga!* ${confirmed}/${spots} para ${formatGameWhen(game.scheduled_at)} — ${falta(spots - confirmed)}.\n${link}`,

  reminder: ({ game, confirmed, spots, link }) =>
    `⏰ Jogo amanhã (${formatGameWhen(game.scheduled_at)}) e ${falta(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,

  cancelled: ({ game }) =>
    `🚫 *Jogo cancelado:* ${formatGameWhen(game.scheduled_at)}. Avisamos quando abrir o próximo.`,
};
