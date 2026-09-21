// Turns one saved game (an entry of matchdays.summary.matches) into what the
// "open this game" view shows. Pure, so it is easy to test.
//
// Two shapes exist in the database:
//  - new  : `events` (every goal / own goal / save, in order) + `homeGk`/`awayGk`,
//           written by endMatchday since the per-game record was added;
//  - legacy: only `lines` (per-player goals/assists for that game). Days ended
//           before that change can never have the goal-by-goal timeline.

/** name lookup for a season-stable player key, from the day's own summary. */
function nickIndex(summary) {
  const nick = {};
  (summary?.candidates ?? []).forEach((c) => { if (c.key != null) nick[c.key] = c.nick; });
  (summary?.lines ?? []).forEach((l) => { if (l.key != null) nick[l.key] = l.nick || nick[l.key]; });
  return nick;
}

export function buildGameView(m, summary) {
  const nick = nickIndex(summary);
  const nm = (k) => (k != null && nick[k]) || null;
  const teams = summary?.teamResults ?? [];
  const team = (name) => teams.find((t) => t.name === name);
  const side = (name, goals, gk) => ({ name, color: team(name)?.color ?? null, goals, gk: nm(gk) });
  const home = side(m.homeName, m.homeGoals, m.homeGk);
  const away = side(m.awayName, m.awayGoals, m.awayGk);

  if (Array.isArray(m.events)) {
    const timeline = m.events.map((e) => ({
      side: e.side, type: e.type, who: nm(e.by) ?? "?", assist: nm(e.ast), min: e.min ?? null,
    }));
    return {
      n: m.n, home, away, detailed: true,
      goals: timeline.filter((e) => e.type !== "save"),
      saves: timeline.filter((e) => e.type === "save"),
      // A clean sheet belongs to the keeper of the side that conceded nothing.
      cleanSheets: [
        ...(m.awayGoals === 0 && home.gk ? [{ side: "h", who: home.gk }] : []),
        ...(m.homeGoals === 0 && away.gk ? [{ side: "a", who: away.gk }] : []),
      ],
    };
  }

  // Legacy: per-player counts for this game, grouped by the team they were on.
  const inTeam = (name, key) => Boolean(team(name)?.players?.includes(key));
  const scorers = (m.lines ?? []).map((l) => {
    const h = inTeam(m.homeName, l.key), a = inTeam(m.awayName, l.key);
    return { side: h && !a ? "h" : a && !h ? "a" : null, who: nm(l.key) ?? "?", goals: l.goals || 0, assists: l.assists || 0 };
  }).sort((x, y) => (y.goals * 2 + y.assists) - (x.goals * 2 + x.assists));
  return { n: m.n, home, away, detailed: false, scorers };
}
