import { SectionHeading } from './SectionHeading.jsx';

export function PlayerRanking({ players, title = 'Melhores marcadores', metric = 'golos' }) {
  return <section><SectionHeading title={title} /><ol className="pl-rankings">{players.map((player, index) =>
    <li key={player.id}><span className="pl-ranking-position">{index + 1}</span><span className="pl-ranking-name">{player.name}<small>{player.teamName}</small></span>
      <strong aria-label={`${player.value} ${metric}`}>{player.value}</strong></li>)}</ol></section>;
}
