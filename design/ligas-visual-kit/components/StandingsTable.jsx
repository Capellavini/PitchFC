import { LeagueCrest } from './LeagueCrest.jsx';

export function StandingsTable({ rows, caption = 'Classificação oficial', onTeamSelect }) {
  return <div className="pl-table-region"><table className="pl-table"><caption>{caption}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Equipa</th><th scope="col"><abbr title="Jogos">J</abbr></th>
      <th scope="col" className="pl-table-extra"><abbr title="Vitórias">V</abbr></th>
      <th scope="col" className="pl-table-extra"><abbr title="Empates">E</abbr></th>
      <th scope="col" className="pl-table-extra"><abbr title="Derrotas">D</abbr></th>
      <th scope="col"><abbr title="Diferença de golos">DG</abbr></th><th scope="col"><abbr title="Pontos">Pts</abbr></th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.team.id} data-position={row.position}>
      <td>{row.position}</td><th scope="row">{onTeamSelect
        ? <button type="button" className="pl-table-team" onClick={() => onTeamSelect(row.team)}><LeagueCrest {...row.team} /><span>{row.team.name}</span></button>
        : <span className="pl-table-team"><LeagueCrest {...row.team} /><span>{row.team.name}</span></span>}</th>
      <td>{row.played}</td><td className="pl-table-extra">{row.wins}</td><td className="pl-table-extra">{row.draws}</td>
      <td className="pl-table-extra">{row.losses}</td><td>{row.difference > 0 ? '+' : ''}{row.difference}</td><td className="pl-table-points">{row.points}</td>
    </tr>)}</tbody>
  </table>{rows.length === 0 && <p className="pl-table-empty">A classificação aparece quando existirem resultados oficiais.</p>}</div>;
}
