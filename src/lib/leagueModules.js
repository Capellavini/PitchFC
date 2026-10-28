// PITCH Ligas — optional modules. A league starts with the core (calendar,
// match reports, homologation, table, discipline, rosters, public page) and
// the organizer switches the rest on or off in the league's settings. The
// registry is the single source of truth: the nav, the screens, the Adjunto
// and (later) the cloud pages all ask `moduleOn()` instead of hard-coding what
// a league shows.

/** The always-on core, listed so the settings screen can say what is NOT
 *  optional. Order = how the organizer reads it. */
export const CORE_FEATURES = Object.freeze([
  "Calendário e conflitos",
  "Ficha de jogo e resultado provisório",
  "Homologação",
  "Classificação",
  "Castigos e disciplina",
  "Plantéis e convocatórias",
  "Página pública da liga",
]);

/** group: "operacao" helps the board run the league; "adeptos" and "extras"
 *  are the fan/athlete-facing layers. `requires` = another module that must
 *  be on, `needs` = what the module adds to the product (shown in settings). */
export const MODULES = Object.freeze([
  { id: "adjunto", group: "operacao", name: "Adjunto", desc: "O assistente da direção: resume o que há por tratar, prepara o resumo da jornada e responde às perguntas do dia a dia.", default: true },
  { id: "fairplay", group: "operacao", name: "Taça Fair Play", desc: "Calcula a classificação de fair play (amarelos × 1 + vermelhos × 3) a partir dos cartões registados. A direção decide.", default: false },
  { id: "sponsors", group: "operacao", name: "Patrocinadores", desc: "Patrocinador titular por competição (ex.: «Liga X | Nome do patrocinador») nas páginas e nas partilhas.", default: false },
  { id: "fans", group: "adeptos", name: "Área do adepto", desc: "Os adeptos escolhem uma equipa para seguir e vêem o que interessa: próximo jogo, resultados, classificação.", default: true },
  { id: "fan_vote", group: "adeptos", name: "Voto de craque dos adeptos", desc: "Os adeptos votam no craque do jogo. O craque oficial continua a ser decidido pela direção.", default: false, requires: "fans" },
  { id: "fantasy", group: "extras", name: "Fantasy", desc: "Os adeptos e atletas montam uma equipa de cinco e ganham pontos com os golos e as assistências reais.", default: false, requires: "fans" },
  { id: "tactics", group: "extras", name: "Quadro tático", desc: "Os capitães publicam a formação antes do jogo.", default: false },
  { id: "compare", group: "extras", name: "Comparar atletas", desc: "Compara dois atletas lado a lado.", default: false },
  { id: "var", group: "extras", name: "VAR e clipes", desc: "Os jogos podem ter repetições de lances partilhadas pela liga.", default: false },
  { id: "ovr", group: "extras", name: "Cartão de atleta (OVR)", desc: "O cartão com atributos e avaliação (estilo FIFA), construído com as avaliações dos colegas.", default: false },
]);

export const MODULE_GROUPS = Object.freeze([
  { id: "operacao", name: "Operação da direção" },
  { id: "adeptos", name: "Adeptos" },
  { id: "extras", name: "Extras de jogo" },
]);

export const MODULE_IDS = Object.freeze(MODULES.map((m) => m.id));
const BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const moduleById = (id) => BY_ID[id] || null;

export const defaultModules = () => Object.fromEntries(MODULES.map((m) => [m.id, m.default]));

/** Keep only known ids and booleans; anything missing falls back to the
 *  module's default. */
export function normalizeModules(raw) {
  const base = defaultModules();
  if (!raw || typeof raw !== "object") return base;
  for (const id of MODULE_IDS) if (typeof raw[id] === "boolean") base[id] = raw[id];
  return base;
}

/** Is the module on? A module whose `requires` is off is off too. Takes the
 *  league state ({ modules }) or a plain modules map. Unknown ids are off. */
export function moduleOn(source, id) {
  const def = BY_ID[id];
  if (!def) return false;
  const map = normalizeModules(source && source.modules !== undefined ? source.modules : source);
  if (def.requires && !moduleOn(map, def.requires)) return false;
  return map[id];
}

/** Flip one module. Turning a module off also switches off whatever
 *  requires it, so the saved map never contradicts what the screens show. */
export function setModule(source, id, on) {
  const def = BY_ID[id];
  const map = normalizeModules(source && source.modules !== undefined ? source.modules : source);
  if (!def) return map;
  map[id] = Boolean(on);
  if (!map[id]) for (const m of MODULES) if (m.requires === id) map[m.id] = false;
  if (map[id] && def.requires) map[def.requires] = true;
  return map;
}

/** Modules that depend on `id` and are currently on (for the "this also
 *  switches off …" hint). */
export const dependentsOn = (source, id) => MODULES.filter((m) => m.requires === id && moduleOn(source, m.id)).map((m) => m.id);
