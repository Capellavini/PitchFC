// PITCH Ligas — results from a spreadsheet: one row per game already played, with the score (and the penalties
// of a knockout tie). Same contract as leagueImport.js: nothing throws for a bad row, every problem comes back in
// `skipped` with its line, and the same function previews and applies. Results enter exactly like a quick result:
// PROVISIONAL, without scorers; the Gestor still homologates. (Scorers and cards come from the súmula, via the Adjunto.)
import { splitHeader, mapColumns } from "./leagueTable.js";
import { findTeam, parseDate } from "./leagueImport.js";
import { recordResult } from "./leagueResults.js";
import { SetupError } from "./leagueSetup.js";

const RES = {
  home: ["casa", "equipa casa", "equipa da casa", "home", "mandante", "clube casa", "equipa 1"],
  away: ["fora", "visitante", "equipa fora", "equipa visitante", "away", "clube fora", "equipa 2"],
  hg: ["golos casa", "golos da casa", "gc", "g casa", "golos equipa casa", "resultado casa", "home goals", "golos 1"],
  ag: ["golos fora", "golos visitante", "gf", "g fora", "golos equipa fora", "resultado fora", "away goals", "golos 2"],
  score: ["resultado", "score", "placar", "marcador final"],
  ph: ["penaltis casa", "pen casa", "penaltis da casa", "pens casa", "penalties casa"],
  pa: ["penaltis fora", "pen fora", "penaltis visitante", "pens fora", "penalties fora"],
  pens: ["penaltis", "pens", "desempate", "penalties"],
  round: ["jornada", "ronda", "round", "j", "fase"],
  date: ["data", "date", "dia", "data jogo", "data do jogo"],
};
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const SCORE = /^(\d{1,2})\s*[-–—x×:]\s*(\d{1,2})$/i;
const lisbonDay = (iso) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date(iso));
const num = (v) => (/^\d{1,2}$/.test(clean(v)) ? Number(clean(v)) : null);

/** Rows (header required) → results recorded as provisional. `competitionId` limits the search to one competition. */
export function importResults(state, { competitionId = null, rows }) {
  const { header, body } = splitHeader(rows, RES);
  const cols = header ? mapColumns(header, RES) : null;
  const hasScore = cols && (cols.score !== undefined || (cols.hg !== undefined && cols.ag !== undefined));
  if (!cols || cols.home === undefined || cols.away === undefined || !hasScore) return { state, added: 0, skipped: [{ line: 1, reason: "results_columns" }], lines: [] };
  let next = state; let added = 0; const skipped = []; const lines = [];
  body.forEach((row, i) => {
    const line = i + 2;
    const homeName = clean(row[cols.home]); const awayName = clean(row[cols.away]);
    if (!homeName && !awayName) return;
    let hg; let ag;
    if (cols.hg !== undefined && cols.ag !== undefined) { hg = num(row[cols.hg]); ag = num(row[cols.ag]); }
    else { const m = SCORE.exec(clean(row[cols.score])); hg = m ? Number(m[1]) : null; ag = m ? Number(m[2]) : null; }
    if (hg === null || ag === null) { skipped.push({ line, reason: "bad_score" }); return; }
    const home = findTeam(next, homeName); const away = findTeam(next, awayName);
    if (!home || !away) { skipped.push({ line, reason: "unknown_team" }); return; }
    if (home.id === away.id) { skipped.push({ line, reason: "two_different_teams" }); return; }
    const pair = (m) => [m.homeId, m.awayId].sort().join() === [home.id, away.id].sort().join() && (!competitionId || m.competitionId === competitionId);
    const roundN = cols.round !== undefined ? parseInt(clean(row[cols.round]).match(/[0-9]+/)?.[0] || "", 10) : NaN;
    const day = cols.date !== undefined ? parseDate(row[cols.date]) : null;
    const between = next.matches.filter(pair);
    let open = between.filter((m) => ["scheduled", "live"].includes(m.state));
    if (Number.isFinite(roundN)) open = open.filter((m) => m.round === roundN);
    if (day) { const same = open.filter((m) => m.kickoff && lisbonDay(m.kickoff) === day); if (same.length) open = same; }
    if (!open.length) { skipped.push({ line, reason: between.length ? "match_played" : "no_match" }); return; }
    if (open.length > 1) { skipped.push({ line, reason: "match_ambiguous" }); return; }
    const match = open[0];
    const flip = match.homeId !== home.id; // the file lists the pair the other way round
    const pensText = cols.pens !== undefined ? clean(row[cols.pens]) : "";
    const pensCell = pensText ? SCORE.exec(pensText) : null;
    const ph = pensCell ? Number(pensCell[1]) : cols.ph !== undefined ? num(row[cols.ph]) : null;
    const pa = pensCell ? Number(pensCell[2]) : cols.pa !== undefined ? num(row[cols.pa]) : null;
    if (pensText && !pensCell) { skipped.push({ line, reason: "bad_shootout" }); return; }
    const shootout = ph !== null && pa !== null ? (flip ? { home: pa, away: ph } : { home: ph, away: pa }) : null;
    try {
      next = recordResult(next, { matchId: match.id, score: flip ? { home: ag, away: hg } : { home: hg, away: ag }, shootout, by: "Importação · ficheiro", at: new Date().toISOString() });
      added += 1;
      lines.push(`${home.name} ${hg}–${ag} ${away.name}${shootout ? ` (${ph}–${pa} pen.)` : ""}`);
    } catch (e) {
      const code = e instanceof SetupError ? e.code : "invalid";
      skipped.push({ line, reason: code === "invalid" && shootout ? "bad_shootout" : code === "result_exists" ? "match_played" : code });
    }
  });
  return { state: next, added, skipped, lines };
}
