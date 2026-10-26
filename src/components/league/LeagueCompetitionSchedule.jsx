import {useEffect,useState} from 'react';
import {C,S,T,cardStyle} from '../../theme';
import {t,getLang} from '../../lib/i18n';
import '../../lib/homeContextCopy';
import {competitionTable} from '../../lib/homeContext';
import SectionLabel from '../SectionLabel';
export default function LeagueCompetitionSchedule({leagues,competition,teams,viewKey}) {
  const [state,setState]=useState({loading:true,items:[],error:false});
  const {fetchCompetitionMatches}=leagues;
  useEffect(()=>{let live=true;setState({loading:true,items:[],error:false});fetchCompetitionMatches(competition.id,viewKey).then(r=>live&&setState({loading:false,items:r.data||[],error:!!r.error}));return()=>{live=false;};},[fetchCompetitionMatches,competition.id,viewKey]);
  if(state.loading)return <div role="status" style={{color:C.text2,padding:S.md}}>{t('A carregar a organização…')}</div>;
  if(state.error)return <div role="alert">{t('Não foi possível carregar todos os dados.')}</div>;
  if(!state.items.length)return null;
  const table=competitionTable(teams,state.items,competition.regulation.rules||{});
  const locale=getLang()==='en'?'en-GB':getLang()==='pt-br'?'pt-BR':'pt-PT';
  return <section id="jogos" style={{scrollMarginTop:20}}>
    {competition.structure==='league'&&<>
      <SectionLabel>{t('Classificação')}</SectionLabel>
      <div style={{...cardStyle,overflowX:'auto',padding:S.md,marginBottom:S.sm}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:T.meta,textAlign:'left'}}>
        <thead><tr>{['#',t('Equipa'),'J','V','E','D','SG','Pts'].map(x=><th key={x} style={{padding:'8px 4px',color:C.text2}}>{x}</th>)}</tr></thead>
        <tbody>{table.map((r,i)=><tr key={r.id} style={{borderTop:`1px solid ${C.border}`}}><td>{i+1}</td><th style={{padding:'12px 4px',maxWidth:130}}>{r.name}</th>{[r.j,r.w,r.d,r.l,r.gd,r.pts].map((v,n)=><td key={n} style={{padding:'8px 4px',color:n===5?C.accent:C.text1,fontWeight:n===5?800:500}}>{v}</td>)}</tr>)}</tbody>
      </table></div><p style={{fontSize:T.min,color:C.text2,marginBottom:S.xl,lineHeight:1.5}}>{t('A classificação usa apenas resultados homologados e o regulamento publicado.')}</p>
    </>}
    <SectionLabel>{t('Calendário e resultados')}</SectionLabel>
    {state.items.map(m=><div key={m.id} style={{...cardStyle,padding:S.md,marginBottom:S.sm}}>
      <div style={{fontSize:T.min,color:C.text2,marginBottom:S.sm}}>{m.round_name} · {m.kickoff_at?new Date(m.kickoff_at).toLocaleString(locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:m.timezone||'Europe/Lisbon'}):'—'}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:S.sm,alignItems:'center',fontSize:T.body,fontWeight:800}}><span>{m.home.name}</span><span style={{color:C.accent,fontSize:20}}>{m.result_status==='homologated'?`${m.home_score}–${m.away_score}`:'×'}</span><span style={{textAlign:'right'}}>{m.away.name}</span></div>
      <div style={{fontSize:T.min,color:C.text2,marginTop:S.sm}}>{m.result_status==='homologated'?t('Resultados homologados'):m.venue_name}</div>
    </div>)}
  </section>;
}
