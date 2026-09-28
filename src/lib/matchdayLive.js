// Pure helpers for the LIVE matchday object (games.live_matchday /
// localStorage "matchday"): { startedAt, mode, config?, matches: [{ id, n,
// homeId, awayId, homeGkId, awayGkId, events: [...], stage?, round?,
// isBye?, concluded?, penaltyWinnerId?, subs? }] }.
// Events: goal { teamId, scorerId, assistId?, ownGoal?, minute? } — teamId
// is always the team that BENEFITS (own goals included) — or save
// { teamId, type: "epicSave", playerId }.
import { t } from "./i18n";
import { matchWinner } from "./tournament";

export const isSave = (e) => e?.type === "epicSave";

export const goalsOf = (m, teamId) => (m.events || []).filter((e) => e.teamId === teamId && !isSave(e)).length;

/** Group-stage table (campeonato = the whole day; personalizado = only the
 *  "grupo" matches — the play-off doesn't count towards it). */
export function standings(teams, matches) {
  const tally = {};
  teams.forEach((tm) => { tally[tm.id] = { ...tm, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; });
  matches.filter((m) => m.stage !== "playoff" && !m.isBye).forEach((m) => {
    const H = tally[m.homeId], A = tally[m.awayId];
    if (!H || !A) return;
    const hg = goalsOf(m, m.homeId), ag = goalsOf(m, m.awayId);
    H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
    if (hg > ag) { H.w++; A.l++; } else if (ag > hg) { A.w++; H.l++; } else { H.d++; A.d++; }
  });
  return Object.values(tally)
    .map((r) => ({ ...r, j: r.w + r.d + r.l, gd: r.gf - r.ga, pts: r.w * 3 + r.d }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
}

/** Play-off bookkeeping (personalizado only): current round, whether it's
 *  decided, champion, and whether "advance" is allowed. "Concluído" (the
 *  explicit lock-in) is what gates advancing — a 0-0 on a match nobody has
 *  played yet would otherwise look decided from the score alone. */
export function playoffState(matchday) {
  const matches = matchday?.matches || [];
  const playoffMatches = matches.filter((m) => m.stage === "playoff");
  const rounds = [...new Set(playoffMatches.map((m) => m.round))].sort((a, b) => a - b);
  const currentRound = playoffMatches.length ? Math.max(...playoffMatches.map((m) => m.round)) : 0;
  const currentRoundMatches = playoffMatches.filter((m) => m.round === currentRound);
  const winnerOf = (m) => (m.isBye ? m.homeId : matchWinner(m, goalsOf(m, m.homeId), goalsOf(m, m.awayId)));
  const roundWinners = currentRoundMatches.map(winnerOf);
  const isDone = (m) => m.isBye || Boolean(m.concluded);
  const groupMatches = matches.filter((m) => m.stage !== "playoff");
  const allGroupConcluded = groupMatches.length > 0 && groupMatches.every(isDone);
  const roundDecided = roundWinners.length > 0 && roundWinners.every(Boolean) && currentRoundMatches.every(isDone);
  const champion = currentRound > 0 && currentRoundMatches.length === 1 && roundDecided ? roundWinners[0] : null;
  const isPersonalizado = matchday?.mode === "personalizado";
  const canAdvance = isPersonalizado && Boolean(matchday.config?.faseFinal) && !champion
    && (currentRound === 0 ? allGroupConcluded : roundDecided);
  const roundSize = (round) => playoffMatches.filter((pm) => pm.round === round).length;
  return { playoffMatches, rounds, currentRound, champion, canAdvance, roundSize, winnerOf };
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
