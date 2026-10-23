import { computeTable } from './core/standings.js';

export function homeContexts({ leagues = [], teams = [], mode } = {}) {
  const member = leagues.some(l => (l.roles || []).some(r => ['owner', 'manager', 'scorer', 'referee'].includes(r)));
  // A display preference can hide contexts; it never confers a league role.
  if (member && mode === 'league_only') return ['league'];
  return ['player', ...(teams.length ? ['rivals'] : []), ...(member ? ['league'] : [])];
}
export function resolveHomeContext({ preferred, ...inputs } = {}) {
  const options = homeContexts(inputs);
  return options.includes(preferred) ? preferred : options.includes('league') ? 'league' : options.includes('rivals') ? 'rivals' : 'player';
}
export function competitionTable(teams = [], matches = [], rules = {}) {
  const official = matches.filter(m => m.result_status === 'homologated' && m.match_status === 'finished'
    && Number.isInteger(m.home_score) && Number.isInteger(m.away_score));
  const games = official.map(m => ({ homeId: m.home.id, awayId: m.away.id,
    events: [...Array.from({length:m.home_score}, () => ({teamId:m.home.id})), ...Array.from({length:m.away_score}, () => ({teamId:m.away.id}))] }));
  return computeTable(teams.map(x => x.team || x), games, {points:rules.points, tiebreakers:rules.tiebreakers});
}
export function summarizeLeagueHome(competitions = [], now = Date.now()) {
  const games = competitions.flatMap(c => (c.matches || []).map(m => ({...m, competition:c})));
  return {
    competitions:competitions.length,
    teams:new Set(competitions.flatMap(c => (c.teams || []).map(t => t.team.id))).size,
    pending:competitions.flatMap(c => c.registrations?.items || []).filter(r => r.versions?.some(v => v.status === 'submitted')).length,
    upcoming:games.filter(m => m.match_status === 'scheduled' && Date.parse(m.kickoff_at) >= now).sort((a,b) => Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)),
  };
}
