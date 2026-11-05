// PITCH Ligas — bringing a league's past seasons in from a spreadsheet, so the archive (and the public page) is not empty
// the day the new system starts. One row per team per season and competition:
//   Época · Competição · Posição · Equipa · J · V · E · D · GM · GS · Pts
// The champion of each competition is the team in 1st place, marked as «Histórico importado». Nothing here touches the
// current season. Same contract as leagueImport.js: bad rows come back in `skipped` with their line.
import { splitHeader, mapColumns, normalizeCell } from "./leagueTable.js";
import { findTeam } from "./leagueImport.js";

const HIST = {
  season: ["epoca", "temporada", "ano", "season"],
  comp: ["competicao", "campeonato", "divisao", "liga", "competition", "escalao"],
  pos: ["posicao", "pos", "lugar", "classificacao", "class", "#"],
  team: ["equipa", "clube", "team", "club"],
  j: ["j", "jogos", "pj", "gp"], w: ["v", "vitorias", "w", "wins"], d: ["e", "empates", "d", "draws"], l: ["d", "derrotas", "l", "losses", "der"],
  gf: ["gm", "golos marcados", "gf", "marcados", "golos m"], ga: ["gs", "golos sofridos", "ga", "sofridos", "golos s"], pts: ["pts", "pontos", "points", "p"],
};
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const slug = (s) => clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "x";
const int = (v) => (/^-?\d{1,4}$/.test(clean(v)) ? Number(clean(v)) : null);

/** Header-based only: the empates/derrotas columns both start with E/D, so the order of columns decides when they clash. */
function columns(header) {
  const cols = mapColumns(header, { season: HIST.season, comp: HIST.comp, pos: HIST.pos, team: HIST.team, gf: HIST.gf, ga: HIST.ga, pts: HIST.pts, j: HIST.j });
  // V / E / D by position after J: the first three single-letter results columns
  const norm = (c) => clean(c).toLowerCase();
  const jAt = header.findIndex((c) => ["j", "jogos", "pj", "gp"].includes(norm(c)));
  const at = (names, from) => header.findIndex((c, i) => i > from && names.includes(norm(c)));
  const w = at(["v", "vitorias", "vitórias", "w", "wins"], jAt - 1);
  const d = at(["e", "empates", "d", "draws"], w);
  const l = at(["d", "derrotas", "l", "losses", "der"], d);
  return { ...cols, ...(w >= 0 ? { w } : {}), ...(d >= 0 ? { d } : {}), ...(l >= 0 ? { l } : {}) };
}

/** Rows (with a header) → seasons added to state.data.seasons (imported). A season label that already exists is left alone. */
export function importHistory(state, { rows }) {
  const { header, body } = splitHeader(rows, HIST);
  if (!header) return { state, seasons: [], added: 0, skipped: [{ line: 1, reason: "history_columns" }] };
  const cols = columns(header);
  const need = ["season", "comp", "team", "pts"];
  if (need.some((k) => cols[k] === undefined)) return { state, seasons: [], added: 0, skipped: [{ line: 1, reason: "history_columns" }] };
  const existing = new Set((state.data.seasons || []).map((s) => clean(s.label).toLowerCase()));
  const bySeason = new Map(); const skipped = [];
  body.forEach((row, i) => {
    const line = i + 2;
    const season = clean(row[cols.season]); const comp = clean(row[cols.comp]); const teamName = clean(row[cols.team]);
    if (!season && !comp && !teamName) return;
    if (!season || !comp || !teamName) { skipped.push({ line, reason: "invalid" }); return; }
    if (existing.has(season.toLowerCase())) { skipped.push({ line, reason: "season_exists" }); return; }
    const pts = int(row[cols.pts]);
    if (pts === null) { skipped.push({ line, reason: "bad_score" }); return; }
    const key = season;
    if (!bySeason.has(key)) bySeason.set(key, new Map());
    const comps = bySeason.get(key);
    if (!comps.has(comp)) comps.set(comp, []);
    const r = (k) => (cols[k] !== undefined ? int(row[cols[k]]) : null);
    comps.get(comp).push({ line, teamName, pos: cols.pos !== undefined ? int(row[cols.pos]) : null, j: r("j") ?? 0, w: r("w") ?? 0, d: r("d") ?? 0, l: r("l") ?? 0, gf: r("gf") ?? 0, ga: r("ga") ?? 0, pts });
  });

  const added = [];
  for (const [label, comps] of bySeason) {
    const teams = new Map();
    const teamOf = (name) => {
      // only an exact name is the same team as today's; anything else is a team of the past, kept under its own name
      const found = findTeam(state, name);
      const exact = found && normalizeCell(found.name) === normalizeCell(name) ? found : null;
      const id = exact ? exact.id : `hist-${slug(name)}`;
      if (!teams.has(id)) teams.set(id, { id, name: exact?.name || name, short: exact?.short || name.slice(0, 3).toUpperCase(), color: exact?.color, venue: exact?.venue || "" });
      return id;
    };
    const competitions = [];
    for (const [name, list] of comps) {
      const sorted = list.slice().sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999) || b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
      const table = sorted.map((r, k) => ({ pos: k + 1, teamId: teamOf(r.teamName), j: r.j, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gf - r.ga, pts: r.pts }));
      const top = table[0];
      competitions.push({
        id: `hist-${slug(label)}-${slug(name)}`, name, short: name, kind: "league", legs: null, sponsor: "", category: "",
        table, champion: { teamId: top.teamId, name: teams.get(top.teamId).name, decidedBy: "table" },
        scorers: [], discipline: [], matches: [], stats: [],
      });
    }
    added.push({ id: `ep-${slug(label)}`, label, closedAt: `${/^(\d{4})/.exec(label)?.[1] || "2000"}-07-01T00:00:00.000Z`, closedBy: "Importação", competitions, teams: [...teams.values()], players: [], notes: [{ at: new Date().toISOString(), by: "Importação", text: "Época importada de um ficheiro (histórico)." }], imported: true });
  }
  const seasons = [...(state.data.seasons || []), ...added];
  return { state: added.length ? { ...state, data: { ...state.data, seasons } } : state, seasons: added.map((s) => s.label), added: added.length, skipped };
}
