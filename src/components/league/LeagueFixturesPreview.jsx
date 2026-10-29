import { C, S, T } from '../../theme';
import { t } from '../../lib/i18n';
import '../../lib/leaguePresentationCopy';
import { roundRobinRounds } from '../../lib/leagueMatches';

export default function LeagueFixturesPreview({ teams, doubleLegged }) {
  const fixtures = roundRobinRounds(teams.map(team => team.id), doubleLegged);
  const names = Object.fromEntries(teams.map(team => [team.id, team.name]));
  return <section aria-label={t('Prévia do calendário')} style={{ margin: `${S.lg}px 0` }}>
    <h3 style={{ fontSize: T.cardTitle, margin: `0 0 ${S.sm}px` }}>{t('Prévia do calendário')}</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.lg, color: C.text2, fontSize: T.meta, marginBottom: S.md }}>
      <span>{teams.length} {t('Equipas')}</span><span>{new Set(fixtures.map(f => f.round)).size} {t('Jornadas')}</span>
      <span>{fixtures.length} {t('Jogos')}</span><span>{t(doubleLegged ? 'Ida e volta' : 'Uma volta')}</span>
    </div>
    <div tabIndex={0} aria-label={t('Ver confrontos antes de gerar')} style={{ maxHeight: 320, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.meta, textAlign: 'left' }}>
        <thead><tr>{['Jornada', 'Equipas'].map(label => <th key={label} style={{ color: C.text2, padding: S.sm, borderBottom: `1px solid ${C.border}` }}>{t(label)}</th>)}</tr></thead>
        <tbody>{fixtures.map(f => <tr key={`${f.round}:${f.home_team_id}:${f.away_team_id}`}>
          <td style={{ padding: S.sm, borderBottom: `1px solid ${C.border}` }}>{f.round}</td>
          <td style={{ padding: S.sm, borderBottom: `1px solid ${C.border}`, overflowWrap: 'anywhere' }}>{names[f.home_team_id]} × {names[f.away_team_id]}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t('A prévia não guarda jogos. Confirma os participantes antes de gerar.')} {t('As datas e os campos são definidos depois de gerar os confrontos.')}</p>
  </section>;
}
