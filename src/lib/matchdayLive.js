// Pure helpers for the LIVE matchday object (games.live_matchday /
// localStorage "matchday"): { startedAt, mode, config?, matches: [{ id, n,
// homeId, awayId, homeGkId, awayGkId, events: [...], stage?, round?,
// isBye?, concluded?, penaltyWinnerId?, subs? }] }.
// Events: goal { teamId, scorerId, assistId?, ownGoal?, minute? } — teamId
// is always the team that BENEFITS (own goals included) — or save
// { teamId, type: "epicSave", playerId }.
// Table / play-off logic lives in the shared core (src/lib/core/
// standings.js, also used by the WhatsApp bot); re-exported here so app
// import paths stay put.
import { t } from "./i18n";
import { computeTable, isSave } from "./core/standings.js";

export { isSave, goalsOf, playoffState } from "./core/standings.js";

/** Group-stage table (campeonato = the whole day; personalizado = only the
 *  "grupo" matches — the play-off doesn't count towards it). Personalizado
 *  generates every fixture upfront, so a game nobody has touched yet (no
 *  events, not concluded) must not count as a 0-0 draw. */
export function standings(teams, matches) {
  const started = (m) => m.concluded || (m.events || []).length > 0;
  return computeTable(teams, matches.filter((m) => m.stage !== "playoff" && !m.isBye && started(m)));
}

/** "JOGO 3" / "MEIA-FINAL" / "FINAL". */
export function matchLabel(m, roundSize) {
  if (m.stage !== "playoff") return `${t("JOGO")} ${m.n}`;
  return roundSize(m.round) === 1 ? t("FINAL") : t("MEIA-FINAL");
}

/** Tonight's per-player tally (not the season — that roll-up only happens
 *  at "Terminar jogo"), sorted by goals×2 + assists. */
export function dayStats(matchday, byId) {
  const stats = {};
  const bump = (id, key) => {
    if (!id) return;
    stats[id] = stats[id] || { goals: 0, assists: 0, epicSaves: 0 };
    stats[id][key] += 1;
  };
  (matchday?.matches || []).forEach((m) => (m.events || []).forEach((e) => {
    if (isSave(e)) bump(e.playerId, "epicSaves");
    else if (!e.ownGoal) { bump(e.scorerId, "goals"); bump(e.assistId, "assists"); }
  }));
  return Object.entries(stats)
    .map(([id, s]) => { const p = byId(Number(id)) ?? byId(id); return p ? { p, ...s } : null; })
    .filter(Boolean)
    .sort((a, b) => (b.goals * 2 + b.assists + b.epicSaves * 0.5) - (a.goals * 2 + a.assists + a.epicSaves * 0.5));
}
