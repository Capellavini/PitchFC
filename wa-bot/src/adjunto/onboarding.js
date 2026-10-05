// Treinador Adjunto — format onboarding (plan §8.6), a pure deterministic
// state machine over adjunto_threads.step/draft. Every step has a default
// ("ok" accepts it). Decision 2: "campeonato" is the night table only (no
// season league), so it asks just points + tiebreakers.
//
//   start()                      → { state, reply }
//   step(state, text, lang)      → { state | null (left onboarding), reply, done: format | null, invalid }
import { normalize } from "./identity.js";
import { parseYesNo } from "./commands.js";
import { T } from "./texts.js";
import { defaultFormat, validateFormat, describeFormat } from "../core/format.js";

const TB_CHOICES = ["gd", "gf", "h2h", "wins", "ga_fewest", "lots"];
const DEFAULT_WORDS = /^(ok|okay|sim|yes|default|padrao|normal|isso|pode ser|tanto faz|whatever|claro|certo|esse|essa|y|s)$/;

const firstInt = (n) => { const m = n.match(/-?\d+/); return m ? Number(m[0]) : null; };
const isDefault = (n) => DEFAULT_WORDS.test(n);

/** Next step after `step`, given the draft so far. */
function nextStep(step, d) {
  const custom = d.type === "custom";
  switch (step) {
    case "type": return d.type === "avulso" ? "summary" : d.type === "campeonato" ? "points" : "teams";
    case "teams": return "playersPerTeam";
    case "playersPerTeam": return "schedule";
    case "schedule": return { round_robin: "legs", winner_stays: "winnerStays", fixed: "fixedGames", manual: "gameMinutes" }[d.night.schedule];
    case "legs": case "fixedGames": return "gameMinutes";
    case "winnerStays": return "gameMinutes";
    case "gameMinutes": return d.night.schedule === "winner_stays" ? "goalCap" : "points";
    case "goalCap": return "points";
    case "points": return "tiebreakers";
    case "tiebreakers": return custom ? "playoffs" : "summary";
    case "playoffs": return !d.playoffs.enabled ? "summary" : d.playoffs.qualifiers === 4 ? "thirdPlace" : "penalties";
    case "thirdPlace": return "penalties";
    case "penalties": return "summary";
    default: return "summary";
  }
}

function question(step, d, lang) {
  const t = T(lang).ob;
  if (step === "summary") return t.summary(describeFormat(d, lang));
  return t[step];
}

export function start(lang = "pt") {
  return { state: { step: "type", draft: {}, misses: 0 }, reply: T(lang).ob.type };
}

/** Parse one answer for `step` into the draft. Returns the new draft, or null if unparseable. */
function apply(step, n, d) {
  const num = firstInt(n);
  const def = isDefault(n);
  const set = (path, v) => {
    const c = structuredClone(d);
    const [a, b, k] = path;
    if (k) c[a][b][k] = v; else if (b) c[a][b] = v; else c[a] = v;
    return c;
  };
  switch (step) {
    case "type": {
      const t = /^(1|avulso|avulsa|casual|soltos?)$/.test(n) ? "avulso"
        : /^(2|campeonato|liga|league|league night|tabela)$/.test(n) ? "campeonato"
          : /^(3|personalizado|custom|personalizar)$/.test(n) ? "custom" : null;
      return t ? defaultFormat(t) : null;
    }
    case "teams": return def ? d : num >= 2 && num <= 6 ? set(["night", "teams"], num) : null;
    case "playersPerTeam": return def ? d : num >= 1 && num <= 11 ? set(["night", "playersPerTeam"], num) : null;
    case "schedule": {
      const s = /^(1|todos contra todos|round robin|liga)$/.test(n) ? "round_robin"
        : /^(2|quem ganha fica|winner stays( on)?|rei da quadra)$/.test(n) ? "winner_stays"
          : /^(3|fixo|numero fixo|fixed)$/.test(n) ? "fixed"
            : /^(4|vamos marcando|manual|livre)$/.test(n) || def ? "manual" : null;
      if (!s) return null;
      const c = set(["night", "schedule"], s);
      if (s === "fixed" && c.night.fixedGames == null) c.night.fixedGames = null;
      return c;
    }
    case "legs": {
      const l = /^(1|uma|uma volta|single|unico|turno unico)$/.test(n) || def ? 1 : /^(2|duas|ida e volta|home and away|returno)$/.test(n) ? 2 : null;
      return l ? set(["night", "legs"], l) : null;
    }
    case "winnerStays": return def ? d : num >= 1 && num <= 10 ? set(["night", "winnerStays", "maxConsecutive"], num) : null;
    case "fixedGames": return num >= 1 && num <= 40 ? set(["night", "fixedGames"], num) : null;
    case "gameMinutes": return def ? d : num >= 1 && num <= 120 ? set(["night", "gameMinutes"], num) : null;
    case "goalCap": {
      if (def || /^(nao|no|sem|sem limite|none)$/.test(n) || num === 0) return set(["night", "goalCap"], null);
      return num >= 1 && num <= 20 ? set(["night", "goalCap"], num) : null;
    }
    case "points": {
      if (def) return d;
      const m = n.match(/^(-?\d+)\s*[/ -]?\s*(-?\d+)\s*[/ -]?\s*(-?\d+)$/) || n.match(/^(-?\d+) (-?\d+) (-?\d+)$/);
      if (!m) return null;
      const p = { win: Number(m[1]), draw: Number(m[2]), loss: Number(m[3]) };
      const c = set(["points"], p);
      return validateFormat(c).errors.some((e) => e.startsWith("points")) ? null : c;
    }
    case "tiebreakers": {
      if (def) return set(["tiebreakers"], ["pts", "gd", "gf", "h2h"]);
      const picks = (n.match(/\d/g) || []).map(Number);
      if (!picks.length || picks.some((k) => k < 1 || k > 6) || new Set(picks).size !== picks.length) return null;
      return set(["tiebreakers"], ["pts", ...picks.map((k) => TB_CHOICES[k - 1])]);
    }
    case "playoffs": {
      const k = def ? 1 : num;
      const base = { ...d.playoffs, byeTop: false, thirdPlace: false };
      const p = k === 1 ? { ...base, enabled: false }
        : k === 2 ? { ...base, enabled: true, qualifiers: 2 }
          : k === 3 ? { ...base, enabled: true, qualifiers: 4 }
            : k === 4 ? { ...base, enabled: true, qualifiers: 3, byeTop: true } : null;
      if (!p) return null;
      if (p.enabled && p.qualifiers > d.night.teams) return null; // can't have a top-4 play-off with 2 teams
      return set(["playoffs"], p);
    }
    case "thirdPlace": case "penalties": {
      const yn = parseYesNo(n);
      return yn ? set(["playoffs", step], yn === "yes") : null;
    }
    default: return null;
  }
}

/** One onboarding answer. */
export function step(state, text, lang = "pt") {
  const t = T(lang).ob;
  const n = normalize(text);
  if (/^(recomecar|recomeca|reset|restart|start over|voltar ao inicio|do inicio)$/.test(n)) {
    const s = start(lang);
    return { state: s.state, reply: `${t.restart}\n${s.reply}`, done: null, invalid: false };
  }
  if (/^(sair|cancelar|cancela|depois|mais tarde|exit|later|stop)$/.test(n)) {
    return { state: null, reply: t.cancelled, done: null, invalid: false };
  }
  const cur = state?.step ?? "type";
  const draft = state?.draft ?? {};

  if (cur === "summary") {
    const yn = parseYesNo(text);
    if (yn === "yes") {
      const v = validateFormat(draft);
      if (v.ok) return { state: null, reply: t.saved(describeFormat(v.format, lang)), done: v.format, invalid: false };
      const s = start(lang); // should not happen: every step validated
      return { state: s.state, reply: `${t.restart}\n${s.reply}`, done: null, invalid: true };
    }
    if (yn === "no") {
      const s = start(lang);
      return { state: s.state, reply: `${t.restart}\n${s.reply}`, done: null, invalid: false };
    }
    return { state, reply: t.invalid + question("summary", draft, lang), done: null, invalid: true };
  }

  const nd = apply(cur, n, draft);
  if (!nd) {
    const misses = (state?.misses ?? 0) + 1;
    return { state: { ...state, step: cur, draft, misses }, reply: t.invalid + question(cur, draft, lang) + (misses >= 2 ? t.hintExit : ""), done: null, invalid: true };
  }
  const ns = nextStep(cur, nd);
  return { state: { step: ns, draft: nd, misses: 0 }, reply: question(ns, nd, lang), done: null, invalid: false };
}
