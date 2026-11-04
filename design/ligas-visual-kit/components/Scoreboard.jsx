import { cx } from './shared.mjs';
import { LeagueCrest } from './LeagueCrest.jsx';

export function Scoreboard({ home, away, score, shootout, winnerTeamId, kickoffLabel, compact = false }) {
  const winner = winnerTeamId === home.id ? home : winnerTeamId === away.id ? away : null;
  return <div className={cx('pl-scoreboard', compact && 'pl-scoreboard--compact')}>
    <div className="pl-scoreboard-teams" role="group" aria-label={`${home.name} contra ${away.name}`}>
      <div className="pl-scoreboard-team"><LeagueCrest {...home} size="large" /><span>{home.name}</span></div>
      <div className="pl-scoreboard-score">
        {score ? <strong aria-label={`Resultado: ${score.home} a ${score.away}`}>{score.home}<span>–</span>{score.away}</strong>
          : <strong className="pl-kickoff">{kickoffLabel || 'Por marcar'}</strong>}
        <small>{score ? 'Resultado' : 'Hora de Lisboa'}</small>
      </div>
      <div className="pl-scoreboard-team"><LeagueCrest {...away} size="large" /><span>{away.name}</span></div>
    </div>
    {shootout && <p className="pl-shootout">Penáltis <b>{shootout.home}–{shootout.away}</b></p>}
    {winner && <p className="pl-winner">Vencedor: <b>{winner.name}</b></p>}
  </div>;
}
