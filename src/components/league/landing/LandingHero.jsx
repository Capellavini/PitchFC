import {fanLoginPath} from '../../../lib/leagueCommunity';
import { MapPin, ArrowUpRight, Radio, Goal } from 'lucide-react';
import { BRAND } from './theme';
import { t, getLang } from '../../../lib/i18n';
import { fmtKickoff } from '../../../lib/leagueDemo';
import LeagueMark from '../LeagueMark';
import LandingTeamMark from './LandingTeamMark';

/** Public matchday masthead: tenant identity, editorial intro and a live/next fixture. */
export default function LandingHero({ slug, league, settings, model }) {
  const games = model.competitions.flatMap(c => c.rounds.flatMap(r => r.matches));
  const fixture = model.live[0] || games.filter(m => m.state === 'scheduled').sort((a,b) => String(a.kickoff || 'z').localeCompare(String(b.kickoff || 'z')))[0] || games.slice().reverse().find(m => m.score);
  const played = model.competitions.reduce((n,c) => n+c.played,0);
  return <header className="pl-public-header">
    <div className="pl-platform-bar"><a href="/league"><img src={BRAND.logo} alt="PITCH"/> <span>LIGAS</span></a><a href={fanLoginPath(slug)}>{t('Área do adepto')} <ArrowUpRight size={14}/></a></div>
    <div className="pl-league-masthead"><div className="pl-league-identity"><LeagueMark size={52}/><div><strong>{league.name}</strong>{league.city && <span><MapPin size={13}/>{league.city}</span>}</div></div><a className="pl-public-link" href="#jornadas">{t('Calendário e resultados')} <ArrowUpRight size={16}/></a></div>
    <div className="pl-public-hero">
      <div className="pl-editorial-intro"><span className="pl-eyebrow">{t('DENTRO E FORA DAS QUATRO LINHAS')}</span><h1>{t('A tua liga.')}<br/><em>{t('Todo o jogo.')}</em></h1><p>{settings.intro || t('As equipas, os protagonistas e as histórias que fazem esta liga. Acompanha cada jornada de perto.')}</p><div className="pl-public-stats"><span><b>{model.teams.length}</b>{t('Equipas')}</span><span><b>{played}</b>{t('Jogos disputados')}</span><span><b>{model.competitions.length}</b>{t('Competições')}</span></div></div>
      <div className="pl-featured-fixture"><Goal className="pl-football-detail" size={140} strokeWidth={.6} aria-hidden/><span className="pl-eyebrow">{fixture?.state === 'live' ? <><Radio size={14}/> {t('EM DIRETO')}</> : fixture?.score ? t('EM DESTAQUE') : t('PRÓXIMO JOGO')}</span>{fixture ? <><div className="pl-featured-teams"><div><LandingTeamMark team={fixture.home} size={54}/><strong>{fixture.home?.name || '—'}</strong></div><b>{fixture.score ? `${fixture.score.home}–${fixture.score.away}` : 'VS'}</b><div><LandingTeamMark team={fixture.away} size={54}/><strong>{fixture.away?.name || '—'}</strong></div></div>{fixture.shootout && <p>{t('Penáltis')} {fixture.shootout.home}–{fixture.shootout.away}</p>}<p>{fixture.kickoff ? fmtKickoff(fixture.kickoff, getLang()) : t('Data por definir')}{fixture.venue ? ` · ${fixture.venue}` : ''}</p><a href="#jornadas">{t('Acompanhar a jornada')} <ArrowUpRight size={16}/></a></> : <><h2>{t('Uma nova época está a chegar.')}</h2><p>{t('O calendário será publicado aqui.')}</p></>}</div>
    </div>
  </header>;
}
