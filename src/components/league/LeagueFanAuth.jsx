import {useEffect,useState} from 'react';
import {C,BRAND,inputStyle} from './visual/theme';
import {fanPath,communityError} from '../../lib/leagueCommunity';
import {communityApi} from '../../lib/leagueCommunityApi';
import BtnPrimary from './visual/BtnPrimary';
import BtnGhost from './visual/BtnGhost';
export default function LeagueFanAuth({slug,cloud}){
 const [mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
 const signed=cloud.status!=='loading'&&Boolean(cloud.user);
 useEffect(()=>{if(signed)window.location.replace(fanPath(slug));},[signed,slug]);
 const submit=async e=>{e.preventDefault();if(busy)return;setError('');setInfo('');if(mode==='signup'&&!consent){setError('Aceita os termos e a política de privacidade para criar a conta.');return;}setBusy(true);try{const r=mode==='signup'?await communityApi.signUp(slug,{name,email,password}):await cloud.signIn(email.trim(),password);if(r?.error)setError(mode==='login'?'Não foi possível entrar. Confirma o email e a palavra-passe, ou recupera o acesso.':r.error);else if(r?.needsConfirm)setInfo('Se o email estiver disponível, receberás a confirmação para continuar. Se já tens conta, entra ou recupera a palavra-passe.');else window.location.replace(fanPath(slug));}catch{setError(communityError('network'));}finally{setBusy(false);}};
 const reset=async()=>{setError('');setInfo('');if(!email.trim()){setError('Escreve primeiro o teu email.');return;}setBusy(true);try{const r=await cloud.resetPassword(email.trim());if(r?.error)setError('Não foi possível enviar o pedido. Tenta novamente.');else setInfo('Se existir uma conta com este email, receberás as instruções para recuperar o acesso.');}finally{setBusy(false);}};
 if(cloud.status==='loading'||signed)return <div className="pitch-ligas lf-page" role="status">A abrir a tua conta…</div>;
 return <div className="pitch-ligas lf-page"><div className="lf-account"><a href={`/leagues/${slug}`} className="lf-back">← Voltar à liga</a><img src={BRAND.logo} alt="PITCH" width="130"/><span className="pl-eyebrow">PITCH MANAGER · ADEPTOS</span><h1>O teu futebol.<br/><em>A tua equipa.</em></h1><p>Escolhe os atletas desta liga e soma pontos em cada jornada.</p><div className="pl-filter-tabs"><button type="button" aria-pressed={mode==='login'} onClick={()=>{setMode('login');setError('')}}>Entrar</button><button type="button" aria-pressed={mode==='signup'} onClick={()=>{setMode('signup');setError('')}}>Criar conta</button></div><form onSubmit={submit} className="lf-form">
 {mode==='signup'&&<label>O teu nome<input style={inputStyle()} autoComplete="name" value={name} minLength={2} maxLength={60} required onChange={e=>setName(e.target.value)}/></label>}
 <label>Email<input style={inputStyle()} type="email" autoComplete="email" value={email} required maxLength={254} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Palavra-passe<input style={inputStyle()} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?8:undefined} value={password} required onChange={e=>setPassword(e.target.value)}/></label>
 {mode==='signup'&&<label className="lf-consent"><input type="checkbox" checked={consent} required onChange={e=>setConsent(e.target.checked)}/><span>Aceito os <a href="/termos" target="_blank" rel="noreferrer">termos</a> e li a <a href="/privacidade" target="_blank" rel="noreferrer">política de privacidade</a>.</span></label>}
 {error&&<div role="alert" style={{color:C.red}}>{error}</div>}{info&&<div role="status" className="lf-notice">{info}</div>}<BtnPrimary type="submit" disabled={busy}>{busy?'A continuar…':mode==='signup'?'Criar conta de adepto':'Entrar no Fantasy'}</BtnPrimary>{mode==='login'&&<BtnGhost disabled={busy} onClick={reset}>Esqueci-me da palavra-passe</BtnGhost>}</form></div></div>;
}
