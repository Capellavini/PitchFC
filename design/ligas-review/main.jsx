import React, {useState, useMemo, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {buildExampleState} from '../../src/lib/leagueExample';
import {normalizeLeagueState, deriveLeague, emptyLeagueState} from '../../src/lib/leagueDemo';
import {closeSeason,newSeason,annotateSeason,reenrollAthletes} from '../../src/lib/leagueSeason';
import {setLang} from '../../src/lib/i18n';
import LeagueContextApp from '../../src/components/league/LeagueContextApp';
import LeagueLanding from '../../src/components/league/landing/LeagueLanding';
import LeagueManage from '../../src/components/league/LeagueManage';
import LeagueAuth from '../../src/components/league/LeagueAuth';
import LeagueOnboarding from '../../src/components/league/LeagueOnboarding';
import '../../src/components/league/visual/redesign.css';
import './review.css';
setLang('pt');
const query = new URLSearchParams(location.search);
const frame = query.has('frame');
const initial = query.get('view') || 'app';
const seed = () => {const s = buildExampleState(); s.viewer={role:'manager',entered:true}; s.setup={done:true}; s.data.league.color='#355BC4'; return s;};
if (!localStorage.getItem('pitch.demo.v1.leagueDemo')) localStorage.setItem('pitch.demo.v1.leagueDemo',JSON.stringify(seed()));
const screens=[['app','Aplicação'],['public','Página pública'],['management','Gestão completa'],['auth','Entrar / criar conta'],['onboarding','Primeiros passos'],['empty','Liga vazia']];
function FrameApp(){
 const [raw,setRaw]=useState(() => { if(initial==='onboarding') return emptyLeagueState(); try{return JSON.parse(localStorage.getItem('pitch.demo.v1.leagueDemo')) || seed();}catch{return seed();}}), [section,setSection]=useState('overview'),[message,setMessage]=useState(''),[lang,changeLang]=useState('pt');
 useEffect(()=>{if(initial==='management')localStorage.setItem('pitch.demo.v1.leagueDemo',JSON.stringify(raw));},[raw]);
 const state=useMemo(()=>normalizeLeagueState(initial==='empty'?emptyLeagueState():raw),[raw]);
 const derived=useMemo(()=>deriveLeague(state),[state]);
 const notice=text=>{setMessage(text);setTimeout(()=>setMessage(''),4500);};
 const unsupported=()=>Promise.resolve({error:'Prévia visual: esta ação precisa de uma conta real e não é enviada.'});
 const roles=useMemo(()=>({invites:async()=>({data:[]}),members:async()=>({data:[]}),createInvite:unsupported,revokeInvite:unsupported,removeMember:unsupported}),[]);
 const ctx={state,derived,role:'manager',acc:{},lang,scope:'all',wide:false,live:true,store:{slug:'liga-de-demonstracao',published:false,publish:unsupported,roles},open:()=>notice('Abre o detalhe do jogo no separador Aplicação.'),notify:notice,goTab:()=>{},goManage:setSection,act:{setup:(fn,text)=>{try{setRaw(fn(state));notice(text||'Guardado apenas na prévia.');return {ok:true};}catch(e){notice(e.message);return {error:e};}}}};
 ctx.act.closeSeason=(label,overrides={})=>ctx.act.setup(s=>closeSeason(s,{label,overrides,by:'Gestor (prévia)',at:new Date().toISOString()}),'Época fechada na prévia.');
 ctx.act.newSeason=label=>ctx.act.setup(s=>newSeason(s,{label}),'Nova época criada na prévia.');
 ctx.act.annotateSeason=(id,text)=>ctx.act.setup(s=>annotateSeason(s,id,text,{by:'Gestor (prévia)',at:new Date().toISOString()}),'Nota guardada na prévia.');
 ctx.act.reenrollAthletes=entries=>ctx.act.setup(s=>reenrollAthletes(s,entries),'Atletas reinscritos na prévia.');
 let body;
 if(initial==='public')body=<LeagueLanding slug="liga-de-demonstracao" raw={raw} updatedAt={new Date().toISOString()}/>;
 else if(initial==='management')body=<div className="pitch-ligas review-management"><h1>Organizar a liga</h1><p className="review-muted">Todos os espaços de gestão, com dados fictícios. As ações remotas estão desligadas.</p><LeagueManage ctx={ctx} section={section} onSection={setSection}/></div>;
 else if(initial==='auth')body=<LeagueAuth onBack={()=>{location.href="?frame=1&demo=1&view=app"}} cloud={{status:'anon',signIn:unsupported,signUp:unsupported,resetPassword:unsupported}} lang={lang} onLang={l=>{setLang(l);changeLang(l)}}/>;
 else if(initial==='onboarding')body=<div className="pitch-ligas"><LeagueOnboarding ctx={{...ctx,state}}/></div>;
 else if(initial==='empty')body=<LeagueContextApp store={{raw:emptyLeagueState(),readOnly:true,setRaw(){}}}/>;
 else body=<LeagueContextApp/>;
 return <>{body}{message&&<div className="review-toast" role="status">{message}</div>}</>;
}
function Review(){
 const [view,setView]=useState(initial),[device,setDevice]=useState('pc');
 return <div className="review-shell"><header className="review-toolbar"><a className="review-logo" href="?demo=1">PITCH <b>LIGAS</b><span>PRÉVIA</span></a><nav aria-label="Ecrãs da prévia">{screens.map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav><div className="review-devices">{[['pc','PC'],['390','Celular'],['320','320 px']].map(([id,label])=><button key={id} aria-pressed={device===id} onClick={()=>setDevice(id)}>{label}</button>)}</div></header><p className="review-note">Versão para avaliação · Dados fictícios · Nada é publicado. Na Aplicação, muda entre Gestor, Capitão, Atleta e Adepto em «Ver como».</p><iframe key={view} title={screens.find(s=>s[0]===view)?.[1]} src={`?frame=1&demo=1&view=${view}`} className={device==='pc'?'review-frame':'review-frame review-phone'} style={{width:device==='pc'?'100%':Number(device)}}/></div>;
}
// Keep product navigation inside the review, without changing production routes.
document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const href=a.getAttribute('href')||'';if(href.startsWith('#'))return;if(href.startsWith('/leagues/')){e.preventDefault();location.href='?frame=1&demo=1&view='+(href.endsWith('/app')?'app':'public');}else if(href.startsWith('/league')||href.startsWith('/privacidade')||href.includes('wa.me')||href.includes('whatsapp')){e.preventDefault();}});
createRoot(document.getElementById('root')).render(frame?<FrameApp/>:<Review/>);


