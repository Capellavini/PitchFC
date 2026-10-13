// PITCH Rivals — "O Pitch AI ajuda-te a montar a equipa" (decision
// 2026-10-13 b, docs/TEAMS-CHALLENGES-SPEC.md). A captain taps the CTA in
// the app → wa.me opens with the prefilled message from
// core/captainPhrase.js → this module answers it with a short team
// onboarding guide and the team's ?tjoin= link, followed by a second short
// message ready to forward to the team's WhatsApp group.
//
// Rules (same spirit as the Adjunto silence rule):
//   • only ever a REPLY to that exact phrase (regex, no LLM) — the bot never
//     starts a DM;
//   • the sender is looked up by phone (LID → PN via Baileys' mapping) with
//     the service-role RPC rivals_find_captain_by_phone;
//   • not a captain/vice → ONE "não encontrei" per number per 24h;
//     guide → at most 3 per number per hour (adjunto_dm_replies);
//   • a human takeover of that chat keeps the bot quiet.
// Side effects go through `env` (see index.js) so it is unit-tested with fakes.
import { maskJid } from "./identity.js";

const H = 36e5;
const LANG = { pt: "pt", "pt-br": "ptbr", en: "en" };

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const CAPTAIN_TEXTS = {
  pt: {
    guide: ({ nick, team, url, days, others }) => [
      `Olá${nick ? ` ${nick}` : ""}! ⚽ Sou o Pitch AI. Vamos montar o plantel da *${team}*:`,
      "",
      `1️⃣ *Convida o plantel* — partilha este link no grupo de WhatsApp da malta:\n${url}`,
      "2️⃣ *Quem abre o link* cria conta (ou entra) e fica logo no plantel como jogador. Tu e o vice gerem quem fica.",
      "3️⃣ *Desafiar rivais* — na app, abre a tua equipa → Descobrir, escolhe o rival e toca em Desafiar.",
      "4️⃣ *Quando tiveres 5 jogadores*, já podes lançar o primeiro desafio 🔥",
      "",
      `O link expira ${days <= 1 ? "amanhã" : `em ${days} dias`}; geras outro em «Convidar jogadores».${others.length ? `\n(Também lideras: ${others.join(", ")} — os links estão na app.)` : ""}`,
      "",
      "👇 Reencaminha a próxima mensagem para o grupo da equipa.",
    ].join("\n"),
    forward: ({ team, url }) => `⚽ Entra no plantel da *${team}* no PITCH: ${url} — leva 30 segundos!`,
    notFound: "Não encontrei nenhuma equipa onde sejas capitão ou vice com este número. Confirma o teu telemóvel no Perfil da app (com indicativo, ex.: +351…) e volta a mandar a mensagem.",
  },
  ptbr: {
    guide: ({ nick, team, url, days, others }) => [
      `Olá${nick ? ` ${nick}` : ""}! ⚽ Sou o Pitch AI. Vamos montar o elenco do *${team}*:`,
      "",
      `1️⃣ *Convide o elenco* — compartilhe este link no grupo de WhatsApp da galera:\n${url}`,
      "2️⃣ *Quem abre o link* cria a conta (ou entra) e já fica no elenco como jogador. Você e o vice gerenciam quem fica.",
      "3️⃣ *Desafiar rivais* — no app, abra o seu time → Descobrir, escolha o rival e toque em Desafiar.",
      "4️⃣ *Quando tiver 5 jogadores*, você já pode lançar o primeiro desafio 🔥",
      "",
      `O link expira ${days <= 1 ? "amanhã" : `em ${days} dias`}; você gera outro em «Convidar jogadores».${others.length ? `\n(Você também lidera: ${others.join(", ")} — os links estão no app.)` : ""}`,
      "",
      "👇 Encaminhe a próxima mensagem para o grupo do time.",
    ].join("\n"),
    forward: ({ team, url }) => `⚽ Entra no elenco do *${team}* no PITCH: ${url} — leva 30 segundos!`,
    notFound: "Não encontrei nenhum time onde você seja capitão ou vice com este número. Confira seu celular no Perfil do app (com DDI, ex.: +55…) e mande a mensagem de novo.",
  },
  en: {
    guide: ({ nick, team, url, days, others }) => [
      `Hi${nick ? ` ${nick}` : ""}! ⚽ I'm Pitch AI. Let's build the *${team}* squad:`,
      "",
      `1️⃣ *Invite your squad* — share this link in your football WhatsApp group:\n${url}`,
      "2️⃣ *Whoever opens the link* signs up (or logs in) and joins the squad as a player. You and the vice manage who stays.",
      "3️⃣ *Challenge rivals* — in the app, open your team → Discover, pick the rival and tap Challenge.",
      "4️⃣ *Once you have 5 players*, you can launch your first challenge 🔥",
      "",
      `The link expires ${days <= 1 ? "tomorrow" : `in ${days} days`}; create a new one in «Invite players».${others.length ? `\n(You also lead: ${others.join(", ")} — their links are in the app.)` : ""}`,
      "",
      "👇 Forward the next message to your team's group.",
    ].join("\n"),
    forward: ({ team, url }) => `⚽ Join the *${team}* squad on PITCH: ${url} — takes 30 seconds!`,
    notFound: "I couldn't find a team where you're captain or vice with this number. Check your phone in the app's Profile (with country code, e.g. +351…) and send the message again.",
  },
};

/** Which of the sender's teams the message is about: the hinted name
 *  (exact, then partial), else the newest. rows: rivals_find_captain_by_phone. */
export function pickTeam(rows, hint) {
  if (!rows?.length) return null;
  const h = norm(hint);
  if (h) {
    const exact = rows.find((r) => norm(r.team_name) === h);
    if (exact) return exact;
    const part = rows.filter((r) => norm(r.team_name).includes(h) || h.includes(norm(r.team_name)));
    if (part.length === 1) return part[0];
  }
  return rows[0];
}

export function makeCaptainHandler(env) {
  async function throttled(jid, kind, windowH, max) {
    const since = new Date(env.now().getTime() - windowH * H).toISOString();
    if ((await env.store.countDmReplies(jid, kind, since)) >= max) return true;
    await env.store.noteDmReply(jid, kind);
    return false;
  }

  /** id: resolveDmIdentity(...); parsed: parseCaptainPhrase(text). */
  return async function handleCaptain(id, parsed) {
    const lang = LANG[parsed?.lang] ?? "pt";
    const t = CAPTAIN_TEXTS[lang];
    if (env.takeover?.isActive?.([id.chatJid, ...(id.jids ?? [])])) {
      return env.log(`rivals captain: human takeover active, not replying (${maskJid(id.chatJid)})`);
    }
    const notFound = async (why) => {
      env.log(`rivals captain: phrase from ${maskJid(id.chatJid)} not matched (${why})`);
      if (await throttled(id.chatJid, "rivals_captain_not_found", 24, 1)) return;
      return env.sendDm(id.chatJid, t.notFound, { unlinked: true, eventKind: "rivals_captain_not_found" });
    };
    if (!id.pn) return notFound("no phone number (unmapped @lid)");
    try {
      const rows = await env.store.findCaptainByPhone(id.pn);
      const players = [...new Set(rows.map((r) => r.player_id))];
      if (!rows.length) return notFound("no captain/vice with this phone");
      if (players.length > 1) return notFound(`phone shared by ${players.length} players (dirty data)`);
      if (await throttled(id.chatJid, "rivals_captain_help", 1, 3)) {
        return env.log(`rivals captain: guide throttled for ${maskJid(id.chatJid)}`);
      }
      const team = pickTeam(rows, parsed?.team);
      const inv = await env.store.botTeamInvite(team.team_id, team.player_id);
      const url = `${env.cfg.appUrl}/?tjoin=${encodeURIComponent(inv.token)}`;
      const days = Math.max(1, Math.ceil((new Date(inv.expires_at).getTime() - env.now().getTime()) / (24 * H)));
      const others = rows.filter((r) => r.team_id !== team.team_id).map((r) => r.team_name);
      env.log(`rivals captain: guide for team ${String(team.team_id).slice(0, 8)} → ${maskJid(id.chatJid)}${inv.created ? " (new invite)" : ""}`);
      await env.sendDm(id.chatJid, t.guide({ nick: team.nick, team: team.team_name, url, days, others }), { unlinked: true, eventKind: "rivals_captain_help" });
      // Second, forward-ready message for the team's WhatsApp group (same
      // reply for throttling purposes — only one adjunto_dm_replies row).
      return env.sendDm(id.chatJid, t.forward({ team: team.team_name, url }), { unlinked: true, eventKind: "rivals_captain_forward" });
    } catch (e) {
      // Never a half-baked reply: log and stay silent (the captain can retry).
      env.log("rivals captain lookup failed:", e?.message ?? e);
      return undefined;
    }
  };
}
