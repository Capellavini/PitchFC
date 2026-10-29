import {useEffect,useState} from 'react';
import {C} from '../../../theme';
import {leagueUrl,isLeagueManagerRole} from '../../../lib/leagueCloud';
import {supabase} from '../../../lib/supabase';
import LeagueOperations from './LeagueOperations';
export default function LeagueOperationsCloud({league,leagues,onLeagueChanged}){
 const [id,setId]=useState(league.competitions[0]?.id),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const {fetchCompetition,fetchCompetitionTeams,fetchMatchesStaff,fetchPlayerStats,revision}=leagues;
 useEffect(()=>{let alive=true;setData(null);setError('');const c=league.competitions.find(c=>c.id===id);if(!c)return;setLoading(true);
 (async()=>{try{const results=await Promise.all([fetchCompetition(league.slug,c.slug),fetchCompetitionTeams(c.id),fetchMatchesStaff(c.id),fetchPlayerStats(c.id)]);if(!alive)return;if(results.some(r=>r.error)||!results[0].data)throw new Error('Não foi possível carregar todos os dados desta competição.');setData({competition:results[0].data,teams:results[1].data||[],matches:results[2].data||[],stats:results[3].data||[]});}catch(e){if(alive)setError(e.message)}finally{if(alive)setLoading(false)}})();return()=>{alive=false};
 },[id,league.id,league.slug,revision,retry,fetchCompetition,fetchCompetitionTeams,fetchMatchesStaff,fetchPlayerStats]);
 if(!isLeagueManagerRole(league.myRoles))return <div role="alert">Este espaço está reservado à direção.</div>;
 const requestAI=async body=>{try{const {data:s}=await supabase.auth.getSession();if(!s?.session?.access_token)return {error:'Inicia sessão para utilizar a IA.'};const response=await fetch('/api/league-copilot',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.session.access_token}`},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const r=await response.json();return response.ok?r:{error:r.message||'A IA não está disponível. Usa a transcrição manual.'}}catch{return {error:'A IA não respondeu. Podes continuar pela transcrição manual.'}}};
 if(!id)return <div style={{background:C.bg,color:C.text1,minHeight:'100vh',padding:32}}><h1>Cria a primeira competição.</h1><p>A central reúne os jogos e os plantéis depois da configuração inicial.</p><a href={leagueUrl(league.slug)+'?view=public'}>Voltar à gestão da Liga</a></div>;
 if(loading||!data)return <div style={{background:C.bg,color:C.text1,minHeight:'100vh',padding:32}}>{error?<><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></>:<p role="status">A preparar a central da Liga…</p>}<a style={{display:'block',marginTop:20,color:C.accent}} href={leagueUrl(league.slug)+'?view=public'}>Voltar à Liga</a></div>;
 return <LeagueOperations key={id} league={league} {...data} leagues={leagues} onCompetition={setId} onRefresh={()=>{setRetry(n=>n+1);onLeagueChanged?.()}} requestAI={requestAI} onOpen={m=>{const u=new URL(leagueUrl(league.slug,{competitionSlug:data.competition.slug,key:league.viewKey}),window.location.origin);u.searchParams.set('jogo',m.id);window.location.href=u.pathname+u.search}}/>;
}
