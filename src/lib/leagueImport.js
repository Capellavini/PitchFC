// PITCH Ligas — bringing a league's spreadsheets in: teams, squads and the
// calendar. Pure: rows (from leagueTable.readTableFile) + state in, a report
// and the new state out. Nothing throws for a bad row; every problem comes back
// in `skipped` with its spreadsheet line so the Gestor can fix the file or
// accept the rest. The same function previews and applies (the screens call it
// twice: once to show the result, once inside act.setup).
import { addTeam, addMatch, addPlayers, setTeamCompetitions, SetupError } from "./leagueSetup.js";
import { splitHeader, mapColumns, normalizeCell } from "./leagueTable.js";

const CAL = {
  date: ["data", "date", "dia", "data jogo", "data do jogo"],
  time: ["hora", "time", "horario", "hora jogo", "hora do jogo"],
  home: ["casa", "equipa casa", "equipa da casa", "home", "mandante", "clube casa", "equipa 1", "visitada"],
  away: ["fora", "visitante", "equipa fora", "equipa visitante", "away", "clube fora", "equipa 2", "visitada fora"],
  round: ["jornada", "ronda", "round", "j", "fase"],
  venue: ["local", "campo", "recinto", "venue", "estadio", "pavilhao", "pavilhao campo"],
};
const TEAMS = { name: ["equipa", "clube", "nome", "team", "club", "equipas", "clubes"], short: ["sigla", "abreviatura", "short"], venue: ["campo", "pavilhao", "estadio", "local", "recinto"] };
const ROSTER = {
  team: ["equipa", "clube", "team", "club"], name: ["nome", "atleta", "jogador", "name", "player"], number: ["numero", "n", "no", "camisola", "num", "n.o"],
  position: ["posicao", "pos", "position"],
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const norm = normalizeCell;

/** Finds a team by name: exact (ignoring accents/case), else the one team whose name contains / is contained by it. */
export function findTeam(state, name) {
  const n = norm(name);
  if (!n) return null;
  const teams = state.data.teams;
  const exact = teams.find((t) => norm(t.name) === n);
  if (exact) return exact;
  const partial = teams.filter((t) => norm(t.name).includes(n) || n.includes(norm(t.name)));
  return partial.length === 1 ? partial[0] : null;
}

// ── Dates and times ──────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const validDate = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
const fullYear = (y) => (y < 100 ? 2000 + y : y);

/** "2026-09-13", "13/09/2026", "13-9-26", "13.09.2026" → "2026-09-13" or null. */
export function parseDate(text) {
  const s = clean(text);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : null;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) { const y = fullYear(+m[3]); return validDate(y, +m[2], +m[1]) ? `${y}-${pad(m[2])}-${pad(m[1])}` : null; }
  return null;
}
/** "15:00", "15h", "15h30", "15:00:00" → "15:00" or null. */
export function parseTime(text) {
  const m = clean(text).match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2}))?(?::\d{2})?\s*h?$/i);
  if (!m) return null;
  const h = +m[1]; const min = m[2] ? +m[2] : 0;
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}
const splitDateTime = (cell) => {
  const m = clean(cell).match(/^(\S+)\s+(\d{1,2}[:h]\d{0,2}.*)$/);
  return m ? { date: m[1], time: m[2] } : { date: cell, time: "" };
};

// ── Teams ────────────────────────────────────────────────
/** A list of teams (one column, or a table with equipa / sigla / campo) into a competition. */
export function importTeams(state, { competitionId, rows }) {
  const comp = state.data.competitions.find((c) => c.id === competitionId);
  if (!comp) throw new SetupError("not_found", competitionId);
  const { header, body } = splitHeader(rows, TEAMS);
  const cols = header ? mapColumns(header, TEAMS) : {};
  const nameCol = cols.name ?? 0;
  const added = []; const entered = []; const skipped = [];
  let next = state;
  body.forEach((row, i) => {
    const name = clean(row[nameCol]);
    const line = i + 1 + (header ? 1 : 0);
    if (!name) return;
    if (name.length < 2) { skipped.push({ line, reason: "name_required" }); return; }
    let team = findTeam(next, name);
    // A near-match is only trusted when the name is exactly that team; otherwise it is a new team.
    if (team && norm(team.name) !== norm(name)) team = null;
    const isNew = !team;
    try {
      if (!team) {
        next = addTeam(next, { name, short: cols.short !== undefined ? row[cols.short] : "", venue: cols.venue !== undefined ? row[cols.venue] : "" });
        team = next.data.teams.find((t) => norm(t.name) === norm(name));
        added.push(team.name);
      }
      const current = next.data.competitions.find((c) => c.id === competitionId).teamIds || [];
      if (!current.includes(team.id)) { next = setTeamCompetitions(next, team.id, [...next.data.competitions.filter((c) => (c.teamIds || []).includes(team.id)).map((c) => c.id), competitionId]); if (!isNew) entered.push(team.name); }
    } catch (e) {
      skipped.push({ line, reason: e instanceof SetupError ? e.code : "invalid" });
    }
  });
  return { state: next, added, entered, skipped };
}

// ── Calendar ─────────────────────────────────────────────
/** A calendar spreadsheet into one competition. Teams in the file that the
 *  league doesn't know are created (and entered in the competition) unless
 *  `createMissing` is false, in which case those rows are skipped. */
export function importCalendar(state, { competitionId, rows, createMissing = true }) {
  const comp = state.data.competitions.find((c) => c.id === competitionId);
  if (!comp) throw new SetupError("not_found", competitionId);
  const { header, body } = splitHeader(rows, CAL);
  let cols = header ? mapColumns(header, CAL) : null;
  if (!cols) {
    const probe = body[0] || [];
    cols = parseTime(probe[1]) ? { date: 0, time: 1, home: 2, away: 3, round: 4, venue: 5 } : { date: 0, home: 1, away: 2, round: 3, venue: 4 };
  }
  if (cols.home === undefined || cols.away === undefined || cols.date === undefined) return { state, added: 0, skipped: [{ line: 1, reason: "columns_missing" }], created: [] };
  let next = state; let added = 0; const skipped = []; const created = [];
  const key = (m) => `${m.competitionId}|${m.homeId}|${m.awayId}|${m.kickoff}`;
  const ensureTeam = (name) => {
    let team = findTeam(next, name);
    if (team) return team;
    if (!createMissing) return null;
    next = addTeam(next, { name: clean(name) });
    team = next.data.teams.find((t) => norm(t.name) === norm(name));
    created.push(team.name);
    return team;
  };
  body.forEach((row, i) => {
    const line = i + 1 + (header ? 1 : 0);
    const homeName = clean(row[cols.home]); const awayName = clean(row[cols.away]);
    if (!homeName && !awayName) return; // empty line (a bye, a spacer)
    const split = cols.time === undefined ? splitDateTime(row[cols.date]) : { date: row[cols.date], time: row[cols.time] };
    const date = parseDate(split.date); const time = parseTime(split.time) || (clean(split.time) === "" ? "15:00" : null);
    if (!date) { skipped.push({ line, reason: "bad_date" }); return; }
    if (!time) { skipped.push({ line, reason: "bad_time" }); return; }
    try {
      const before = next;
      const home = ensureTeam(homeName); const away = ensureTeam(awayName);
      if (!home || !away) { next = before; skipped.push({ line, reason: "unknown_team" }); return; }
      if (home.id === away.id) { skipped.push({ line, reason: "two_different_teams" }); return; }
      for (const t of [home, away]) {
        if (!(next.data.competitions.find((c) => c.id === competitionId).teamIds || []).includes(t.id)) {
          next = setTeamCompetitions(next, t.id, [...next.data.competitions.filter((c) => (c.teamIds || []).includes(t.id)).map((c) => c.id), competitionId]);
        }
      }
      const roundCell = cols.round !== undefined ? clean(row[cols.round]) : "";
      const roundNumber = parseInt(roundCell.match(/\d+/)?.[0] || "", 10);
      const round = Number.isFinite(roundNumber) ? roundNumber : 1;
      const named = roundCell && !/^\d+$/.test(roundCell) && !/^(j|jornada|ronda|round)\s*\d+$/i.test(roundCell) ? roundCell : undefined;
      const candidate = addMatch(next, { competitionId, homeId: home.id, awayId: away.id, date, time, venue: cols.venue !== undefined ? row[cols.venue] : "", round, roundName: named });
      const fresh = candidate.matches[candidate.matches.length - 1];
      if (next.matches.some((m) => key(m) === key(fresh))) { skipped.push({ line, reason: "duplicate" }); return; }
      next = candidate; added += 1;
    } catch (e) {
      skipped.push({ line, reason: e instanceof SetupError ? e.code : "invalid" });
    }
  });
  return { state: next, added, skipped, created };
}

// ── Squads ───────────────────────────────────────────────
export const POSITION_ALIASES = Object.freeze({
  GR: ["gr", "guarda redes", "guarda-redes", "gk", "goleiro", "guardaredes"],
  DEF: ["def", "defesa", "defensor", "df", "lateral", "central"],
  MED: ["med", "medio", "meio campo", "meio-campo", "mc", "meio"],
  AVA: ["ava", "avancado", "atacante", "ponta", "av", "extremo"],
});
export function parsePosition(text) {
  const n = norm(text);
  return Object.entries(POSITION_ALIASES).find(([, names]) => names.includes(n))?.[0] || null;
}

/** Squads: columns equipa · nome · número · posição (the team column is
 *  optional when the file is for one team, passed as `teamId`). */
export function importRoster(state, { rows, teamId = null }) {
  const { header, body } = splitHeader(rows, ROSTER);
  const cols = header ? mapColumns(header, ROSTER) : { team: teamId ? undefined : 0, name: teamId ? 0 : 1, number: teamId ? 1 : 2, position: teamId ? 2 : 3 };
  if (cols.name === undefined) return { state, added: 0, skipped: [{ line: 1, reason: "columns_missing" }] };
  const byTeam = new Map(); const skipped = [];
  body.forEach((row, i) => {
    const line = i + 1 + (header ? 1 : 0);
    const name = clean(row[cols.name]);
    if (!name) return;
    const team = teamId ? state.data.teams.find((t) => t.id === teamId) : findTeam(state, row[cols.team]);
    if (!team) { skipped.push({ line, reason: "unknown_team" }); return; }
    const number = cols.number !== undefined && /^\d{1,3}$/.test(clean(row[cols.number])) ? clean(row[cols.number]) : "";
    const pos = cols.position !== undefined ? parsePosition(row[cols.position]) : null;
    if (!byTeam.has(team.id)) byTeam.set(team.id, []);
    byTeam.get(team.id).push({ line, text: `${number ? `${number};` : ""}${name}${pos ? `;${pos}` : ""}` });
  });
  let next = state; let added = 0;
  for (const [id, items] of byTeam) {
    try {
      const before = next.data.players.length;
      next = addPlayers(next, id, items.map((x) => x.text).join("\n"));
      added += next.data.players.length - before;
    } catch (e) {
      skipped.push({ line: items[0].line, reason: e instanceof SetupError ? e.code : "invalid", team: state.data.teams.find((t) => t.id === id)?.name });
    }
  }
  return { state: next, added, skipped };
}
