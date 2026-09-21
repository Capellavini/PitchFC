// Deterministic templates on purpose: structured facts (spots, dates, link)
// must never be paraphrased by a model. Each kind has a PT-PT and an EN
// version; a group's `wa_bot_lang` picks 'pt', 'en' or both ('pt+en').
import { formatGameWhen, formatGameTime } from "./time.js";

const spotsLeft = {
  pt: (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`),
  en: (n) => (n === 1 ? "1 spot left" : `${n} spots left`),
};
const at = (game) => (game.venue ? ` · ${game.venue}` : "");

const T = {
  game_open: {
    pt: ({ game, spots, link }) => `⚽ *Jogo aberto!*\n${formatGameWhen(game.scheduled_at, "pt")}${at(game)}\n${spots} vagas. Confirma aqui:\n${link}`,
    en: ({ game, spots, link }) => `⚽ *Game on!*\n${formatGameWhen(game.scheduled_at, "en")}${at(game)}\n${spots} spots. Sign up here:\n${link}`,
  },

  // Proportional milestones: the kind depends on where `confirmed` sits
  // relative to `spots`, so it works for any group size.
  milestone: {
    pt: ({ game, confirmed, spots, link }) =>
      confirmed < spots
        ? `🔥 Já são ${confirmed}/${spots} — ${spotsLeft.pt(spots - confirmed)}. Ainda dá tempo:\n${link}`
        : confirmed === spots
          ? `✅ *Jogo fechado!* ${confirmed}/${spots} confirmados para ${formatGameWhen(game.scheduled_at, "pt")}.\nQuem ainda quiser entra na lista de espera:\n${link}`
          : `📋 Já são ${confirmed} confirmados — ${confirmed - spots} na lista de espera. Se alguém cair, entra por ordem.`,
    en: ({ game, confirmed, spots, link }) =>
      confirmed < spots
        ? `🔥 ${confirmed}/${spots} in — ${spotsLeft.en(spots - confirmed)}. Still time to join:\n${link}`
        : confirmed === spots
          ? `✅ *Game full!* ${confirmed}/${spots} confirmed for ${formatGameWhen(game.scheduled_at, "en")}.\nJoin the waiting list:\n${link}`
          : `📋 ${confirmed} confirmed — ${confirmed - spots} on the waiting list. If someone drops out, they move up in order.`,
  },

  spot_opened: {
    pt: ({ game, confirmed, spots, link }) => `🔓 *Abriu vaga!* ${confirmed}/${spots} para ${formatGameWhen(game.scheduled_at, "pt")} — ${spotsLeft.pt(spots - confirmed)}.\n${link}`,
    en: ({ game, confirmed, spots, link }) => `🔓 *A spot just opened!* ${confirmed}/${spots} for ${formatGameWhen(game.scheduled_at, "en")} — ${spotsLeft.en(spots - confirmed)}.\n${link}`,
  },

  reminder: {
    pt: ({ game, confirmed, spots, link }) => `⏰ ${formatGameWhen(game.scheduled_at, "pt")}: ${spotsLeft.pt(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,
    en: ({ game, confirmed, spots, link }) => `⏰ ${formatGameWhen(game.scheduled_at, "en")}: ${spotsLeft.en(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,
  },

  matchday: {
    pt: ({ game, confirmed, spots, link }) =>
      `📅 *Hoje há jogo!* ${formatGameTime(game.scheduled_at)}${at(game)}\n${confirmed}/${spots} confirmados${confirmed < spots ? ` — ${spotsLeft.pt(spots - confirmed)}` : " — jogo fechado"}.\n${link}`,
    en: ({ game, confirmed, spots, link }) =>
      `📅 *Game day!* ${formatGameTime(game.scheduled_at)}${at(game)}\n${confirmed}/${spots} confirmed${confirmed < spots ? ` — ${spotsLeft.en(spots - confirmed)}` : " — game full"}.\n${link}`,
  },

  cancelled: {
    pt: ({ game }) => `🚫 *Jogo cancelado:* ${formatGameWhen(game.scheduled_at, "pt")}. Avisamos quando abrir o próximo.`,
    en: ({ game }) => `🚫 *Game cancelled:* ${formatGameWhen(game.scheduled_at, "en")}. We'll let you know when the next one opens.`,
  },

  // ctx.matchday = a `matchdays` row; summary.matches / summary.lines come from
  // the live-matchday finish (see PitchApp.jsx).
  postgame: {
    pt: ({ matchday, link }) => postgame(matchday, link, {
      title: "🏁 *Fim de jogo!*", game: "Jogo", top: "🎯 Mais golos", vote: "🗳️ Vota no MVP", goals: "golos",
    }),
    en: ({ matchday, link }) => postgame(matchday, link, {
      title: "🏁 *Full time!*", game: "Game", top: "🎯 Top scorer", vote: "🗳️ Vote for the MVP", goals: "goals",
    }),
  },
};

function postgame(md, link, L) {
  const matches = md.summary?.matches ?? [];
  const lines = [L.title];
  for (const m of matches.slice(0, 6)) lines.push(`${L.game} ${m.n}: ${m.homeName} ${m.homeGoals}-${m.awayGoals} ${m.awayName}`);
  const scorers = (md.summary?.lines ?? []).filter((l) => l.goals > 0).sort((a, b) => b.goals - a.goals);
  if (scorers.length) {
    const best = scorers.filter((s) => s.goals === scorers[0].goals).map((s) => s.nick).join(", ");
    lines.push(`${L.top}: ${best} (${scorers[0].goals} ${L.goals})`);
  }
  if (md.mvp_open) lines.push(`${L.vote}: ${link}`);
  return lines.join("\n");
}

/** Render a message for a group's language setting. */
export function render(kind, ctx, lang = "pt") {
  const t = T[kind];
  if (lang === "en") return t.en(ctx);
  if (lang === "pt+en") return `${t.pt(ctx)}\n\n${t.en(ctx)}`;
  return t.pt(ctx);
}
