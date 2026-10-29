import {useEffect,useState} from 'react';
import {C,S,T,R,cardStyle,displayFont} from '../../theme';
import {t,getLang} from '../../lib/i18n';
import '../../lib/homeContextCopy';
import {summarizeLeagueHome} from '../../lib/homeContext';
import {leagueUrl} from '../../lib/leagueCloud';
import {statusLabel} from '../../lib/leagueCloudCopy';
import PageHeader from '../PageHeader';
import SectionLabel from '../SectionLabel';
import BtnGhost from '../BtnGhost';

const linkStyle={display:'block',minHeight:44,padding:'12px 16px',boxSizing:'border-box',borderRadius:R.control,fontSize:T.body,fontWeight:800,textDecoration:'none',textAlign:'center'};
export default function LeagueOrganizerHome({leagues,compact=false}) {
  const [state,setState]=useState({loading:true,competitions:[],pages:[],error:false});
  const [retry,setRetry]=useState(0);
  const {myLeagues,fetchLeague,fetchCompetitionTeams,fetchRegistrations,fetchCompetitionMatches,revision}=leagues;
  useEffect(()=>{
    let live=true;
    setState(s=>({...s,loading:true,error:false}));
    (async()=>{
      let failed=false;
      const pages=await Promise.all(myLeagues.map(async l=>{
        const r=await fetchLeague(l.slug);if(r.error||!r.data)failed=true;
        return r.data;
      }));
      const competitions=await Promise.all(pages.filter(Boolean).flatMap(l=>l.competitions.map(async c=>{
        const [teams,regs,matches]=await Promise.all([
          fetchCompetitionTeams(c.id),
          l.myRoles.some(r=>['owner','manager'].includes(r))?fetchRegistrations(c.id):Promise.resolve({data:{items:[]}}),
          fetchCompetitionMatches(c.id),
        ]);
        if(teams.error||regs.error||matches.error)failed=true;
        return {...c,league:l,teams:teams.data||[],registrations:regs.data||{items:[]},matches:matches.data||[]};
      })));
      if(live)setState({loading:false,pages:pages.filter(Boolean),competitions,error:failed});
    })().catch(()=>live&&setState(s=>({...s,loading:false,error:true})));
    return ()=>{live=false;};
  },[myLeagues,fetchLeague,fetchCompetitionTeams,fetchRegistrations,fetchCompetitionMatches,revision,retry]);
  const summary=summarizeLeagueHome(state.competitions);
  const locale=getLang()==='en'?'en-GB':getLang()==='pt-br'?'pt-BR':'pt-PT';
  const href=c=>leagueUrl(c.league.slug,{competitionSlug:c.slug});
  return <div style={compact?undefined:{padding:`0 ${S.lg}px`}}>
    {!compact&&<PageHeader title={t('Painel da Liga')} subtitle={t('A tua competição, sob controlo.')}/>}
    {state.loading?<div role="status" style={{padding:S.lg,color:C.text2}}>{t('A carregar a organização…')}</div>:<>
      {state.error&&<div role="alert" style={{...cardStyle,marginBottom:S.md,color:C.orange}}>{t('Não foi possível carregar todos os dados.')} <BtnGhost compact onClick={()=>setRetry(x=>x+1)}>{t('Tentar novamente')}</BtnGhost></div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:S.sm,marginBottom:S.xl}}>
        {[[summary.competitions,'Competições'],[summary.teams,'Equipas inscritas'],[summary.pending,'Inscrições para rever']].map(([n,label])=><div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:R.card,padding:`${S.md}px ${S.sm}px`}}><div style={{...displayFont,fontSize:30,color:label==='Inscrições para rever'&&n?C.accent:C.text1}}>{state.error?'—':n}</div><div style={{fontSize:T.min,color:C.text2,lineHeight:1.4,marginTop:4}}>{t(label)}</div></div>)}
      </div>
      {state.competitions.filter(c=>c.registrations.items.some(r=>r.versions?.some(v=>v.status==='submitted'))).map(c=><section key={'pending'+c.id} style={{...cardStyle,borderColor:C.accentBorder,marginBottom:S.lg}}>
        <SectionLabel>{t('Inscrições para rever')}</SectionLabel><div style={{fontSize:T.cardTitle,fontWeight:800,marginBottom:S.sm}}>{c.name}</div>
        <div style={{fontSize:T.body,color:C.text2,marginBottom:S.md}}>{c.registrations.items.filter(r=>r.versions?.some(v=>v.status==='submitted')).map(r=>r.teamName).join(' · ')}</div>
        <a href={href(c)+'#inscricoes'} style={{...linkStyle,color:C.bg,background:C.accent}}>{t('Rever inscrições')}</a>
      </section>)}
      <SectionLabel>{t('Competições')}</SectionLabel>
      {state.competitions.map(c=><section key={c.id} style={{...cardStyle,marginBottom:S.md}}>
        <div style={{fontSize:T.min,fontWeight:800,letterSpacing:'.06em',color:C.accent,marginBottom:S.sm}}>{statusLabel(c.status)}</div>
        <h2 style={{margin:`0 0 ${S.xs}px`,fontSize:T.cardTitle}}>{c.name}</h2><div style={{fontSize:T.meta,color:C.text2,marginBottom:S.md}}>{c.league.name} · {c.format} · {c.teams.length} {t('Equipas inscritas').toLowerCase()}</div>
        <a href={href(c)} style={{...linkStyle,border:`1px solid ${C.border}`,color:C.text1}}>{t('Abrir competição')}</a>
      </section>)}
      <SectionLabel style={{marginTop:S.xl}}>{t('Próximos jogos')}</SectionLabel>
      {!summary.upcoming.length&&<div style={{fontSize:T.body,color:C.text2,marginBottom:S.md}}>{t('Sem jogos agendados.')}</div>}
      {summary.upcoming.slice(0,4).map(m=><a key={m.id} href={href(m.competition)+'#jogos'} style={{...cardStyle,display:'block',color:C.text1,textDecoration:'none',marginBottom:S.sm}}>
        <div style={{fontSize:T.min,color:C.accent,fontWeight:800,marginBottom:S.sm}}>{m.round_name} · {new Date(m.kickoff_at).toLocaleString(locale,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:m.timezone||'Europe/Lisbon'})}</div>
        <div style={{fontWeight:800}}>{m.home.name} <span style={{color:C.text2,fontWeight:500}}>×</span> {m.away.name}</div>
        <div style={{fontSize:T.meta,color:C.text2,marginTop:S.xs}}>{m.venue_name}</div>
      </a>)}
      <SectionLabel style={{marginTop:S.xl}}>{t('As minhas ligas')}</SectionLabel>
      {state.pages.map(l=><a key={l.id} href={leagueUrl(l.slug)} style={{...linkStyle,border:`1px solid ${C.border}`,color:C.text1,marginBottom:S.md}}>{t('Gerir liga')} · {l.name}</a>)}
    </>}
  </div>;
}
