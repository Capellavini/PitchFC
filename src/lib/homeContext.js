import { computeTable } from './core/standings.js';

export function homeContexts({ leagues = [], teams = [], mode, product } = {}) {
  // An account created on the league entry (pitch_product "league") only ever
  // has the league context, with or without a membership yet.
  if (product === 'league') return ['league'];
  const member = leagues.some(l => (l.roles || []).some(r => ['owner', 'manager', 'scorer', 'referee'].includes(r)));
  // A display preference can hide contexts; it never confers a league role.
  if (member && mode === 'league_only') return ['league'];
  return ['player', ...(teams.length ? ['rivals'] : []), ...(member ? ['league'] : [])];
}
// Entry space. An explicit, valid preference always wins. Without one, someone
// who belongs to a group opens as a Player (that is where the group, its
// Fantasy and the OVR ratings live); Rivals / League stay one tap away in the
// switcher. People with no group (team-only or league-only accounts) open in
// their team / league space, as before.
export function resolveHomeContext({ preferred, hasGroup = false, ...inputs } = {}) {
  const options = homeContexts(inputs);
  if (options.includes(preferred)) return preferred;
  if (hasGroup && options.includes('player')) return 'player';
  return options.includes('league') ? 'league' : options.includes('rivals') ? 'rivals' : 'player';
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
