// Adjunto da Liga — guided answers for the demo. Deterministic and read-only:
// every number comes from the league state (via leagueToday), never from a
// model. The real Adjunto (WhatsApp + app) uses the same tool-loop as the
// weekly-groups Adjunto; this is the offline demo of its answers.
import { COMPETITIONS } from "./leagueDemo.js";

const KIND_TEXT = {
  contest: (n) => `${n} ${n === 1 ? "contestação à espera de decisão" : "contestações à espera de decisão"}`,
  homologate: (n) => `${n} ${n === 1 ? "resultado por homologar" : "resultados por homologar"}`,
  live: (n) => `${n} ${n === 1 ? "jogo a decorrer" : "jogos a decorrer"}`,
  suspended: (n) => `${n} ${n === 1 ? "atleta suspenso numa convocatória" : "atletas suspensos em convocatórias"}`,
  lineup: (n) => `${n} ${n === 1 ? "convocatória em falta" : "convocatórias em falta"}`,
  conflict: (n) => `${n} ${n === 1 ? "conflito de calendário" : "conflitos de calendário"}`,
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** One-paragraph morning brief from the work queue. */
export function adjuntoBrief(today) {
  if (!today.items.length) {
    return { text: today.done ? "Está tudo em dia e as jornadas atuais estão fechadas. Se quiseres, preparo o resumo para partilhar." : "Está tudo em dia. Não há nada à espera de decisão.", counts: {} };
  }
  const counts = today.items.reduce((o, i) => ({ ...o, [i.kind]: (o[i.kind] || 0) + 1 }), {});
  const parts = Object.keys(KIND_TEXT).filter((k) => counts[k]).map((k) => KIND_TEXT[k](counts[k]));
  return { text: `Hoje precisas de tratar de ${parts.join(", ")}.`, counts };
}

/**
 * @returns {{text: string, actions: {id: string, label: string}[]}}
 *   action ids are resolved by the screen: "homologate", "contest", "recap", "calendar",
 *   "discipline", "reports", "lineups".
 */
export function adjuntoReply(question, today, { names = {} } = {}) {
  const q = norm(question);
  const counts = adjuntoBrief(today).counts;
  const act = (id, label) => ({ id, label });

  if (/resumo|partilh|whats|comunic/.test(q)) {
    const done = today.sections.filter((s) => s.done);
    return done.length
      ? { text: `Posso preparar o resumo de ${done.map((s) => names[s.competition.id] || s.competition.short).join(" e ")}. Leva só resultados homologados e vais rever o texto antes de o enviar.`, actions: [act("recap", "Preparar resumo")] }
      : { text: "Ainda nenhuma jornada está fechada. O resumo só leva resultados homologados, por isso falta homologar o que está pendente.", actions: [act("homologate", "Ver o que falta")] };
  }
  if (/suspen|castig|cartao|cartoes|disciplin|fair/.test(q)) {
    return counts.suspended
      ? { text: `Há ${counts.suspended} ${counts.suspended === 1 ? "atleta suspenso" : "atletas suspensos"} numa convocatória desta jornada. A suspensão é decisão da direção: eu aponto o caso, tu confirmas.`, actions: [act("discipline", "Abrir disciplina")] }
      : { text: "Nenhum atleta suspenso aparece nas convocatórias desta jornada. A disciplina mostra as suspensões ainda por cumprir.", actions: [act("discipline", "Abrir disciplina")] };
  }
  if (/calend|conflit|campo|agenda|horario/.test(q)) {
    return counts.conflict
      ? { text: `${counts.conflict === 1 ? "Há 1 conflito" : `Há ${counts.conflict} conflitos`} de calendário (dois jogos no mesmo local ao mesmo tempo). Abre o calendário para mudar a hora ou o local.`, actions: [act("calendar", "Abrir calendário")] }
      : { text: "Não encontro conflitos de local nos jogos agendados.", actions: [act("calendar", "Abrir calendário")] };
  }
  if (/convoc|escalac|equipa|capitao/.test(q)) {
    return counts.lineup
      ? { text: `Faltam ${counts.lineup} convocatórias nesta jornada. Cabe ao capitão de cada equipa; posso lembrar quem ainda não enviou.`, actions: [act("lineups", "Ver quem falta")] }
      : { text: "Todas as convocatórias desta jornada estão entregues.", actions: [] };
  }
  if (/ficha|boletim|papel|foto|sumula/.test(q)) {
    return { text: "Recebo a fotografia da ficha e devolvo a transcrição para conferires: nada entra no resultado oficial sem a tua confirmação. Neste momento vês as fichas e os lances em Gerir.", actions: [act("reports", "Abrir fichas de jogo")] };
  }
  if (/pend|falta|fechar|jornada|hoje|resta/.test(q) || !q) {
    const b = adjuntoBrief(today);
    return { text: b.text, actions: [counts.homologate ? act("homologate", "Homologar") : null, counts.contest ? act("contest", "Ver contestações") : null].filter(Boolean) };
  }
  const known = COMPETITIONS.map((c) => c.short).join(" e ");
  return { text: `Posso ajudar com pendências, suspensões, conflitos de calendário, convocatórias, resumos e fichas (${known}). Sobre qual queres trabalhar?`, actions: [] };
}

export const ADJUNTO_SUGGESTIONS = ["O que falta fechar hoje?", "Há suspensões a ter em conta?", "Preparar o resumo da jornada", "Há conflitos no calendário?"];
