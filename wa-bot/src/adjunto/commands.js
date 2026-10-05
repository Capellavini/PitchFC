// Treinador Adjunto — deterministic fast path (plan §7.2). Pure parsing:
// decisions on pending proposals, team edits, quick commands and nick
// resolution. No model, no I/O. A "sim" that executes something is always
// parsed here, never by the LLM.
import { normalize } from "./identity.js";

const YES = new Set(["sim", "s", "ok", "okay", "okey", "confirmo", "confirmado", "confirma", "aprovo", "aprovado", "aprova",
  "bora", "manda", "manda ai", "pode", "pode ser", "claro", "isso", "isso mesmo", "fechado", "valida", "yes", "y", "yep",
  "yeah", "sure", "go", "go ahead", "do it", "approve", "approved", "confirm", "sim manda", "sim pode", "ok manda", "certo", "perfeito", "top"]);
const NO = new Set(["nao", "n", "no", "nope", "nah", "cancela", "cancelar", "esquece", "deixa", "deixa estar", "nao obrigado",
  "nao manda", "nao quero", "cancel", "forget it", "dont", "don't", "nao precisa"]);
const YES_EMOJI = /^\s*(👍|✅|👌|🙌|💪)+\s*$/u;
const NO_EMOJI = /^\s*(👎|❌|🚫)+\s*$/u;

/** "yes" | "no" | null. digits: also read "1" as yes and "2" as no (plan §7.2). */
export function parseYesNo(text, { digits = false } = {}) {
  if (YES_EMOJI.test(text ?? "")) return "yes";
  if (NO_EMOJI.test(text ?? "")) return "no";
  const n = normalize(text).replace(/ (por favor|pf|please|obrigado|obrigada|thanks)$/, "").replace(/^(ok|sim) (sim|ok)$/, "sim");
  if (!n) return null;
  if (YES.has(n)) return "yes";
  if (NO.has(n)) return "no";
  if (digits && n === "1") return "yes";
  if (digits && n === "2") return "no";
  return null;
}

/** Proposal reference "sim #12" / "#12" → 12. */
export const proposalRef = (text) => { const m = String(text ?? "").match(/#(\d{1,9})\b/); return m ? Number(m[1]) : null; };

const stripRefs = (s) => s.replace(/^(o|a|the) /, "").trim();

/** Commands on a teams validation card. null = not a team command. */
export function parseTeamsCommand(text) {
  const yn = parseYesNo(text);
  if (yn === "yes") return { type: "approve" };
  if (yn === "no") return { type: "reject" };
  const n = normalize(text);
  if (/^(propoe|propor|proponho|propose|go ahead and propose|avanca|avancar|propoe ja|propoe com esses)$/.test(n)) return { type: "propose_now" };
  if (/^(espera|esperar|aguarda|wait|espera mais|ainda nao)$/.test(n)) return { type: "wait" };
  let m = n.match(/^(?:troca|trocar|troca o|troca a|swap|switch)\s+(.+?)\s+(?:com|por|pelo|pela|with|and|for)\s+(.+)$/);
  if (m) return { type: "swap", a: stripRefs(m[1]), b: stripRefs(m[2]) };
  m = n.match(/^(?:troca|trocar|swap)\s+(\S+)\s+(\S+)$/);
  if (m) return { type: "swap", a: m[1], b: m[2] };
  m = n.match(/^(?:separa|separar|separate|split( up)?)\s+(.+?)\s+(?:e|do|da|de|and|from)\s+(.+)$/);
  if (m) return { type: "separate", a: stripRefs(m[2]), b: stripRefs(m[3]) };
  m = n.match(/^(?:mete|meter|poe|por|passa|passar|move)\s+(?:o |a )?(.+?)\s+(?:na|no|para a|para o|pra|para|to|in)\s+(?:equipa|team|time)\s+(\d)$/);
  if (m) return { type: "move", player: m[1], team: Number(m[2]) };
  m = n.match(/^(?:sorteia|sortear|sorteio|resorteia|re sorteia|redraw|baralha|baralhar|outra vez|de novo|draw again|reshuffle)(?: de novo| outra vez| again)?(?: com (\d) (?:equipas|times)| with (\d) teams)?$/);
  if (m) return { type: "redraw", numTeams: m[1] ? Number(m[1]) : m[2] ? Number(m[2]) : null };
  return null;
}

/** Quick commands available any time (plan §7.2). null = not a command. */
export function parseQuickCommand(text) {
  const n = normalize(text);
  if (/^(estado|status|ponto de situacao|situacao)$/.test(n)) return { type: "status" };
  if (/^(tabela|table|classificacao|standings)$/.test(n)) return { type: "table" };
  if (/^(equipas|times|teams|ve as equipas|ver equipas)$/.test(n)) return { type: "teams" };
  if (/^(ajuda|help|comandos|commands|menu)$/.test(n)) return { type: "help" };
  if (/^(pausa|pause|stop|para|silencio)$/.test(n)) return { type: "pause" };
  if (/^(retoma|resume|continua|volta|start)$/.test(n)) return { type: "resume" };
  if (/^(formato|format|mudar formato|muda o formato|change format|alterar formato)$/.test(n)) return { type: "format" };
  if (/^(fala ingles|speak english|in english|english)$/.test(n)) return { type: "lang", lang: "en" };
  if (/^(fala portugues|portugues|em portugues)$/.test(n)) return { type: "lang", lang: "pt" };
  if (/^(fala brasileiro|portugues do brasil)$/.test(n)) return { type: "lang", lang: "ptbr" };
  const m = n.match(/^(?:grupo|group|switch|muda para o grupo|mudar para)\s+(.+)$/);
  if (m) return { type: "group", name: m[1] };
  return null;
}

/** Resolve a nick reference against [{ nick, name, … }]: exact
 *  (accent-insensitive) nick/name, then unique prefix. Returns
 *  { player } | { ambiguous: [nick…] } | { none: true }. */
export function resolveNick(ref, players) {
  const r = normalize(ref);
  if (!r) return { none: true };
  const keyOf = (p) => [normalize(p.nick), normalize(p.name)].filter(Boolean);
  const exact = players.filter((p) => keyOf(p).includes(r));
  if (exact.length === 1) return { player: exact[0] };
  if (exact.length > 1) return { ambiguous: exact.map((p) => p.nick) };
  const pref = players.filter((p) => keyOf(p).some((k) => k.startsWith(r) || k.split(" ").some((w) => w.startsWith(r))));
  if (pref.length === 1) return { player: pref[0] };
  if (pref.length > 1) return { ambiguous: pref.map((p) => p.nick) };
  return { none: true };
}

/** Menu choice "1".."9" (also "opção 2", "a 2"). */
export function parseChoice(text, max) {
  const n = normalize(text).replace(/^(opcao|opção|option|a|o|numero|n)\s+/, "");
  if (!/^\d{1,2}$/.test(n)) return null;
  const k = Number(n);
  return k >= 1 && k <= max ? k : null;
}
