import {C,S,T,cardStyle} from '../theme';
import {t} from '../lib/i18n';
import '../lib/homeContextCopy';
import PageHeader from './PageHeader';
import TeamNextMatchCard from './TeamNextMatchCard';
import TeamMatchRsvp from './TeamMatchRsvp';
import BtnPrimary from './BtnPrimary';
import BtnGhost from './BtnGhost';
import TeamBadge from './TeamBadge';
export default function RivalsHome({teams,nextMatch,items=[],onOpenTeam,onOpenMatch,onChallenges}) {
  const actions=items.filter(i=>i.needsAction);
  return <div style={{padding:`0 ${S.lg}px`}}>
    <PageHeader title="PITCH Rivals" subtitle={t('A tua equipa em primeiro lugar.')} />
    {actions.length>0&&<section style={{...cardStyle,marginBottom:S.lg,borderColor:C.accentBorder}}>
      <div style={{fontSize:T.meta,color:C.accent,fontWeight:800,marginBottom:S.sm}}>{t('Ações da equipa')}</div>
      {actions.map(i=><div key={i.id} style={{marginBottom:S.sm}}>
        <div style={{fontWeight:800,marginBottom:S.sm}}>{i.team?.name || i.title || t('Resultado')}</div>
        <BtnPrimary block onClick={()=>onOpenMatch(i.challengeId)}>{t('Rever resultado')}</BtnPrimary>
      </div>)}
    </section>}
    {nextMatch&&<TeamNextMatchCard match={nextMatch}>
      <TeamMatchRsvp value={nextMatch.myRsvp} onRsvp={status=>teams.setMatchAvailability(nextMatch.id,status)}/>
      <BtnGhost block onClick={()=>onOpenMatch(nextMatch.challengeId)} style={{marginTop:S.md}}>{t('Ver jogo')}</BtnGhost>
    </TeamNextMatchCard>}
    <BtnGhost block onClick={onChallenges} style={{marginBottom:S.lg}}>{t('Ver desafios')}{teams.pendingActions>0?` · ${teams.pendingActions}`:''}</BtnGhost>
    {(teams.myTeams||[]).map(tm=><div key={tm.id} style={{...cardStyle,marginBottom:S.md}}>
      <div style={{display:'flex',gap:S.md,alignItems:'center',marginBottom:S.md}}><TeamBadge team={tm} size={44}/><div><div style={{fontWeight:800}}>{tm.name}</div><div style={{fontSize:T.meta,color:C.text2}}>{tm.city} · {tm.format} · {tm.memberCount}</div></div></div>
      <BtnPrimary block onClick={()=>onOpenTeam(tm.id)}>{t('Abrir equipa')}</BtnPrimary>
    </div>)}
  </div>;
}
