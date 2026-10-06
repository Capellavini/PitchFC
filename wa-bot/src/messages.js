// Deterministic templates on purpose: structured facts (spots, dates, link)
// must never be paraphrased by a model. Each kind has a PT-PT, PT-BR and EN
// version; a group's `wa_bot_lang` picks 'pt', 'ptbr', 'en' or 'pt+en'.
import { formatGameWhen, formatGameTime } from "./time.js";

const spotsLeft = {
  pt: (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`),
  ptbr: (n) => (n === 1 ? "falta 1 vaga" : `faltam ${n} vagas`),
  en: (n) => (n === 1 ? "1 spot left" : `${n} spots left`),
};
const at = (game) => (game.venue ? ` · ${game.venue}` : "");

const T = {
  // appOnly (groups.wa_bot_interactive = false): the bot doesn't read the
  // chat there, so say plainly that "eu vou" in the group doesn't count.
  game_open: {
    pt: ({ game, spots, link, appOnly }) => `⚽ *Jogo aberto!*\n${formatGameWhen(game.scheduled_at, "pt")}${at(game)}\n${spots} vagas. Confirma aqui:\n${link}`
      + (appOnly ? `\n\n📲 A confirmação é feita *só na app* — "eu vou" ou "tô dentro" aqui no grupo não contam.` : ""),
    ptbr: ({ game, spots, link, appOnly }) => `⚽ *Rachão aberto!*\n${formatGameWhen(game.scheduled_at, "pt")}${at(game)}\n${spots} vagas. Confirme aqui:\n${link}`
      + (appOnly ? `\n\n📲 A confirmação é feita *só no app* — "eu vou" ou "tô dentro" aqui no grupo não valem.` : ""),
    en: ({ game, spots, link, appOnly }) => `⚽ *Game on!*\n${formatGameWhen(game.scheduled_at, "en")}${at(game)}\n${spots} spots. Sign up here:\n${link}`
      + (appOnly ? `\n\n📲 Sign-ups happen *in the app only* — "I'm in" here in the group doesn't count.` : ""),
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
    ptbr: ({ game, confirmed, spots, link }) =>
      confirmed < spots
        ? `🔥 Já são ${confirmed}/${spots} — ${spotsLeft.ptbr(spots - confirmed)}. Ainda dá tempo:\n${link}`
        : confirmed === spots
          ? `✅ *Rachão fechado!* ${confirmed}/${spots} confirmados para ${formatGameWhen(game.scheduled_at, "pt")}.\nQuem ainda quiser entra na lista de espera:\n${link}`
          : `📋 Já são ${confirmed} confirmados — ${confirmed - spots} na lista de espera. Se alguém sair, entra por ordem.`,
    en: ({ game, confirmed, spots, link }) =>
      confirmed < spots
        ? `🔥 ${confirmed}/${spots} in — ${spotsLeft.en(spots - confirmed)}. Still time to join:\n${link}`
        : confirmed === spots
          ? `✅ *Game full!* ${confirmed}/${spots} confirmed for ${formatGameWhen(game.scheduled_at, "en")}.\nJoin the waiting list:\n${link}`
          : `📋 ${confirmed} confirmed — ${confirmed - spots} on the waiting list. If someone drops out, they move up in order.`,
  },

  spot_opened: {
    pt: ({ game, confirmed, spots, link }) => `🔓 *Abriu vaga!* ${confirmed}/${spots} para ${formatGameWhen(game.scheduled_at, "pt")} — ${spotsLeft.pt(spots - confirmed)}.\n${link}`,
    ptbr: ({ game, confirmed, spots, link }) => `🔓 *Abriu vaga!* ${confirmed}/${spots} para ${formatGameWhen(game.scheduled_at, "pt")} — ${spotsLeft.ptbr(spots - confirmed)}.\n${link}`,
    en: ({ game, confirmed, spots, link }) => `🔓 *A spot just opened!* ${confirmed}/${spots} for ${formatGameWhen(game.scheduled_at, "en")} — ${spotsLeft.en(spots - confirmed)}.\n${link}`,
  },

  // Someone declined but the XI stayed full — a waitlister moved up
  // automatically. `promoted` is null when nobody could be resolved (e.g.
  // their phone didn't match any group member) — still worth announcing
  // the game's own count, just without a tag.
  promoted: {
    pt: ({ confirmed, spots, promoted }) =>
      promoted
        ? `🔁 @${promoted.phoneDigits} estás dentro! Uma vaga abriu e foste promovido automaticamente. ${confirmed}/${spots} confirmados.`
        : `🔁 Uma vaga abriu e já foi preenchida automaticamente pela lista de espera. ${confirmed}/${spots} confirmados.`,
    ptbr: ({ confirmed, spots, promoted }) =>
      promoted
        ? `🔁 @${promoted.phoneDigits} você tá dentro! Abriu uma vaga e você foi promovido automaticamente. ${confirmed}/${spots} confirmados.`
        : `🔁 Abriu uma vaga e já foi preenchida automaticamente pela lista de espera. ${confirmed}/${spots} confirmados.`,
    en: ({ confirmed, spots, promoted }) =>
      promoted
        ? `🔁 @${promoted.phoneDigits} you're in! A spot opened up and you were automatically promoted. ${confirmed}/${spots} confirmed.`
        : `🔁 A spot opened up and was automatically filled from the waiting list. ${confirmed}/${spots} confirmed.`,
  },

  reminder: {
    pt: ({ game, confirmed, spots, link }) => `⏰ ${formatGameWhen(game.scheduled_at, "pt")}: ${spotsLeft.pt(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,
    ptbr: ({ game, confirmed, spots, link }) => `⏰ ${formatGameWhen(game.scheduled_at, "pt")}: ${spotsLeft.ptbr(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,
    en: ({ game, confirmed, spots, link }) => `⏰ ${formatGameWhen(game.scheduled_at, "en")}: ${spotsLeft.en(spots - confirmed)} (${confirmed}/${spots}).\n${link}`,
  },

  matchday: {
    pt: ({ game, confirmed, spots, link }) =>
      `📅 *Hoje há jogo!* ${formatGameTime(game.scheduled_at)}${at(game)}\n${confirmed}/${spots} confirmados${confirmed < spots ? ` — ${spotsLeft.pt(spots - confirmed)}` : " — jogo fechado"}.\n${link}`,
    ptbr: ({ game, confirmed, spots, link }) =>
      `📅 *Hoje tem jogo!* ${formatGameTime(game.scheduled_at)}${at(game)}\n${confirmed}/${spots} confirmados${confirmed < spots ? ` — ${spotsLeft.ptbr(spots - confirmed)}` : " — rachão fechado"}.\n${link}`,
    en: ({ game, confirmed, spots, link }) =>
      `📅 *Game day!* ${formatGameTime(game.scheduled_at)}${at(game)}\n${confirmed}/${spots} confirmed${confirmed < spots ? ` — ${spotsLeft.en(spots - confirmed)}` : " — game full"}.\n${link}`,
  },

  cancelled: {
    pt: ({ game }) => `🚫 *Jogo cancelado:* ${formatGameWhen(game.scheduled_at, "pt")}. Avisamos quando abrir o próximo.`,
    ptbr: ({ game }) => `🚫 *Jogo cancelado:* ${formatGameWhen(game.scheduled_at, "pt")}. Avisamos quando abrir o próximo.`,
    en: ({ game }) => `🚫 *Game cancelled:* ${formatGameWhen(game.scheduled_at, "en")}. We'll let you know when the next one opens.`,
  },

  // ── Treinador Adjunto group kinds (organizer-approved in DM). Group-safe by
  // construction: ctx is sanitised by adjunto/groupsafe.js to names/nicks and
  // the game row only — never OVRs, insights or anything DM-only.
  adj_reminder: {
    pt: ({ game, confirmed, spots, pending = [], link }) =>
      `⏰ *Lembrete* — ${formatGameWhen(game.scheduled_at, "pt")}${at(game)}: ${spotsLeft.pt(spots - confirmed)} (${confirmed}/${spots}).${pending.length ? `\nAinda sem resposta: ${pending.join(", ")}` : ""}\n${link}`,
    ptbr: ({ game, confirmed, spots, pending = [], link }) =>
      `⏰ *Lembrete* — ${formatGameWhen(game.scheduled_at, "pt")}${at(game)}: ${spotsLeft.ptbr(spots - confirmed)} (${confirmed}/${spots}).${pending.length ? `\nAinda sem resposta: ${pending.join(", ")}` : ""}\n${link}`,
    en: ({ game, confirmed, spots, pending = [], link }) =>
      `⏰ *Reminder* — ${formatGameWhen(game.scheduled_at, "en")}${at(game)}: ${spotsLeft.en(spots - confirmed)} (${confirmed}/${spots}).${pending.length ? `\nNo answer yet: ${pending.join(", ")}` : ""}\n${link}`,
  },
  open_spots: {
    pt: ({ game, confirmed, spots, inviteLink, link }) => `🙋 *Vagas abertas* para ${formatGameWhen(game.scheduled_at, "pt")}${at(game)} — ${spotsLeft.pt(spots - confirmed)}. Conheces alguém? Partilha:\n${inviteLink || link}`,
    ptbr: ({ game, confirmed, spots, inviteLink, link }) => `🙋 *Vagas abertas* para ${formatGameWhen(game.scheduled_at, "pt")}${at(game)} — ${spotsLeft.ptbr(spots - confirmed)}. Conhece alguém? Compartilhe:\n${inviteLink || link}`,
    en: ({ game, confirmed, spots, inviteLink, link }) => `🙋 *Open spots* for ${formatGameWhen(game.scheduled_at, "en")}${at(game)} — ${spotsLeft.en(spots - confirmed)}. Know someone? Share:\n${inviteLink || link}`,
  },
  teams_confirmed: {
    pt: ({ teams }) => `👕 *Equipas*\n${teams.map((t) => `*${t.name}*: ${t.nicks.join(", ")}`).join("\n")}`,
    ptbr: ({ teams }) => `👕 *Times*\n${teams.map((t) => `*${t.name}*: ${t.nicks.join(", ")}`).join("\n")}`,
    en: ({ teams }) => `👕 *Teams*\n${teams.map((t) => `*${t.name}*: ${t.nicks.join(", ")}`).join("\n")}`,
  },
  rescheduled: {
    pt: ({ game, link }) => `📢 *Jogo alterado:* agora é ${formatGameWhen(game.scheduled_at, "pt")}${at(game)}.\n${link}`,
    ptbr: ({ game, link }) => `📢 *Jogo alterado:* agora é ${formatGameWhen(game.scheduled_at, "pt")}${at(game)}.\n${link}`,
    en: ({ game, link }) => `📢 *Game changed:* now ${formatGameWhen(game.scheduled_at, "en")}${at(game)}.\n${link}`,
  },

  // ctx.matchday = a `matchdays` row; summary.matches / summary.lines come from
  // the live-matchday finish (see PitchApp.jsx).
  postgame: {
    pt: ({ matchday, link }) => postgame(matchday, link, {
      title: "🏁 *Fim de jogo!*", game: "Jogo", top: "🎯 Mais golos", vote: "🗳️ Vota no MVP", goals: "golos",
    }),
    ptbr: ({ matchday, link }) => postgame(matchday, link, {
      title: "🏁 *Fim de jogo!*", game: "Jogo", top: "🎯 Mais gols", vote: "🗳️ Vote no MVP", goals: "gols",
    }),
    en: ({ matchday, link }) => postgame(matchday, link, {
      title: "🏁 *Full time!*", game: "Game", top: "🎯 Top scorer", vote: "🗳️ Vote for the MVP", goals: "goals",
    }),
  },

  match_awards: {
    pt: ({ matchday }) => matchAwards(matchday, {
      title: "🏆 *Destaques da partida*", top: "🎯 Artilheiro", assist: "🅰️ Maior assistente",
      goals: "golos", assists: "assistências", none: "Sem golos registados nesta partida.",
    }),
    ptbr: ({ matchday }) => matchAwards(matchday, {
      title: "🏆 *Destaques da partida*", top: "🎯 Artilheiro", assist: "🅰️ Maior assistente",
      goals: "gols", assists: "assistências", none: "Sem gols registados nessa partida.",
    }),
    en: ({ matchday }) => matchAwards(matchday, {
      title: "🏆 *Match standouts*", top: "🎯 Top scorer", assist: "🅰️ Most assists",
      goals: "goals", assists: "assists", none: "No goals logged for this match.",
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

// Top by goals and top by assists, independently — a playmaker with 0
// goals still deserves the assist line, so this never derives one list
// from the other the way postgame's single "top scorer" line can get away with.
function matchAwards(md, L) {
  const rows = md.summary?.lines ?? [];
  const lines = [L.title];
  const scorers = rows.filter((l) => l.goals > 0).sort((a, b) => b.goals - a.goals);
  const assisters = rows.filter((l) => l.assists > 0).sort((a, b) => b.assists - a.assists);
  if (!scorers.length && !assisters.length) return `${L.title}\n${L.none}`;
  if (scorers.length) {
    const best = scorers.filter((s) => s.goals === scorers[0].goals).map((s) => s.nick).join(", ");
    lines.push(`${L.top}: ${best} (${scorers[0].goals} ${L.goals})`);
  }
  if (assisters.length) {
    const best = assisters.filter((s) => s.assists === assisters[0].assists).map((s) => s.nick).join(", ");
    lines.push(`${L.assist}: ${best} (${assisters[0].assists} ${L.assists})`);
  }
  return lines.join("\n");
}

/**
 * The bot's own attendance poll. Option labels are what the vote reader maps
 * back to confirm/decline (see optionIntent in polls.js), so keep them explicit.
 */
export function pollContent(game, lang = "pt") {
  const pt = { q: `⚽ Vais jogar ${formatGameWhen(game.scheduled_at, "pt")}?`, yes: "✅ Eu vou", no: "❌ Não vou" };
  const ptbr = { q: `⚽ Vai jogar ${formatGameWhen(game.scheduled_at, "pt")}?`, yes: "✅ Eu vou", no: "❌ Não vou" };
  const en = { q: `⚽ Are you playing ${formatGameWhen(game.scheduled_at, "en")}?`, yes: "✅ I'm in", no: "❌ I'm out" };
  if (lang === "en") return { name: en.q, values: [en.yes, en.no] };
  if (lang === "ptbr") return { name: ptbr.q, values: [ptbr.yes, ptbr.no] };
  if (lang === "pt+en") return { name: `${pt.q} / ${en.q.replace("⚽ ", "")}`, values: [`${pt.yes} / ${en.yes.slice(2)}`, `${pt.no} / ${en.no.slice(2)}`] };
  return { name: pt.q, values: [pt.yes, pt.no] };
}

/** Render a message for a group's language setting. */
export function render(kind, ctx, lang = "pt") {
  const t = T[kind];
  if (lang === "en") return t.en(ctx);
  if (lang === "ptbr") return t.ptbr(ctx);
  if (lang === "pt+en") return `${t.pt(ctx)}\n\n${t.en(ctx)}`;
  return t.pt(ctx);
}
