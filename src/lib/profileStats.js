// Derived per-player numbers for Perfil (PITCH ID). Everything here is
// computed from matchday summaries the app already stores — nothing new
// is persisted (CLAUDE.md: "compute, don't store").
//
// `days` = normalized matchday list, NEWEST first:
//   [{ date, playedOn?, mvpNick?, summary: { teamResults, matches, lines, candidates } }]
// `key`  = the player's season-stable key (uuid in cloud, numeric id in
//          local demo) — the same keyOf() endMatchday writes into summaries.

const playedIn = (s, key) =>
  (s?.candidates || []).some((c) => c.key === key) || (s?.lines || []).some((l) => l.key === key);

/** Recent form as 'V' | 'E' | 'D', oldest → newest, one entry per game
 *  (a matchday usually has several). Only derivable when the matchday
 *  saved each team's roster (`teamResults[].players`, added later — older
 *  matchdays are skipped) and team names are unique that day (matches
 *  reference teams by name). Returns [] when nothing is reliable. */
export function formFor(days, key) {
  const out = [];
  [...(days || [])].reverse().forEach(({ summary: s }) => {
    const teams = s?.teamResults || [];
    const names = teams.map((t) => t.name);
    if (new Set(names).size !== names.length) return;
    const team = teams.find((t) => Array.isArray(t.players) && t.players.includes(key));
    if (!team) return;
    (s.matches || []).forEach((m) => {
      let mine, other;
      if (m.homeName === team.name) { mine = m.homeGoals; other = m.awayGoals; }
      else if (m.awayName === team.name) { mine = m.awayGoals; other = m.homeGoals; }
      else return;
      if (typeof mine !== "number" || typeof other !== "number") return;
      out.push(mine > other ? "V" : mine < other ? "D" : "E");
    });
  });
  return out;
}

/** Career records from the loaded matchdays:
 *  - bestMatch:  most goals in a single game ({ goals, date }) or null
 *  - streak:     longest run of consecutive matchdays PLAYED with ≥1 goal
 *                (a matchday the player missed doesn't break the run)
 *  - bestNight:  most G+A in one matchday ({ ga, date }) or null */
export function careerRecordsFor(days, key) {
  let bestMatch = null, bestNight = null, streak = 0, run = 0;
  [...(days || [])].reverse().forEach(({ date, summary: s }) => {
    (s?.matches || []).forEach((m) => {
      const l = (m.lines || []).find((x) => x.key === key);
      if (l && l.goals > 0 && (!bestMatch || l.goals > bestMatch.goals)) bestMatch = { goals: l.goals, date };
    });
    if (!playedIn(s, key)) return;
    const line = (s.lines || []).find((x) => x.key === key);
    const ga = (line?.goals || 0) + (line?.assists || 0);
    if (ga > 0 && (!bestNight || ga > bestNight.ga)) bestNight = { ga, date };
    if ((line?.goals || 0) > 0) { run += 1; streak = Math.max(streak, run); } else run = 0;
  });
  return { bestMatch, streak, bestNight };
}

/** Per-day markers for the calendar: iso → { goals, mvp }. Needs
 *  `playedOn` (cloud only — local demo doesn't keep the ISO date). */
export function calendarDaysFor(days, key, nick) {
  const map = {};
  (days || []).forEach((d) => {
    if (!d.playedOn || !playedIn(d.summary, key)) return;
    const line = (d.summary?.lines || []).find((l) => l.key === key);
    map[d.playedOn] = { day: d, goals: line?.goals || 0, mvp: Boolean(d.mvpNick && nick && d.mvpNick === nick) };
  });
  return map;
}
