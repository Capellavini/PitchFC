import { cx } from './shared.mjs';
import { StatusBadge } from './StatusBadge.jsx';
import { Scoreboard } from './Scoreboard.jsx';
import { PitchButton } from './PitchButton.jsx';

export function MatchCard({ match, onOpen, featured = false }) {
  return <article className={cx('pl-match-card', featured && 'pl-match-card--featured')}>
    {featured && <div className="pl-field" aria-hidden="true"><span /><span /><span /></div>}
    <header className="pl-match-meta"><span>{match.roundLabel} · {match.dateLabel}</span><StatusBadge state={match.state} /></header>
    <Scoreboard home={match.home} away={match.away} score={match.score} shootout={match.shootout}
      winnerTeamId={match.winnerTeamId} kickoffLabel={match.timeLabel} />
    <footer className="pl-match-footer"><span>{match.venue || 'Local por confirmar'}</span>
      {onOpen && <PitchButton variant="ghost" onClick={() => onOpen(match)}
        aria-label={`Ver jogo: ${match.home.name} contra ${match.away.name}`}>Ver jogo ↗</PitchButton>}
    </footer>
  </article>;
}
