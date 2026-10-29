// Taça Fair Play: yellows × 1 + reds × 3 per team (lower is better). Pure.
export const FAIR_PLAY_WEIGHTS = Object.freeze({ yellow: 1, red: 3 });

/**
 * @param {string[]} teamIds teams in the competition
 * @param {{id: string, teamId: string}[]} players every athlete of the league
 * @param {Record<string, {yellows?: number, reds?: number}>} stats per-player official stats
 * @returns {{teamId: string, yellows: number, reds: number, total: number}[]} best (fewest points) first;
 *   ties → fewer reds, then the order the teams were given.
 */
export function fairPlayTable(teamIds, players, stats) {
  const rows = teamIds.map((teamId, order) => {
    let yellows = 0; let reds = 0;
    for (const p of players) {
      if (p.teamId !== teamId) continue;
      yellows += stats[p.id]?.yellows || 0;
      reds += stats[p.id]?.reds || 0;
    }
    return { teamId, yellows, reds, total: yellows * FAIR_PLAY_WEIGHTS.yellow + reds * FAIR_PLAY_WEIGHTS.red, order };
  });
  return rows.sort((a, b) => a.total - b.total || a.reds - b.reds || a.order - b.order).map(({ order, ...r }) => r);
}
