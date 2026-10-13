import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {syncVarClock} from '../lib/varProtocol.js';
import {C,R,S,T} from '../theme';
export default function VarControls({gameId,canManage,confirmed}){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!supabase||!gameId)return;let alive=true;
  const read=async()=>{const r=await supabase.from('var_games').select('enabled').eq('game_id',gameId).maybeSingle();if(alive&&!r.error)setEnabled(Boolean(r.data?.enabled));};
  void read();const ch=supabase.channel(`var-setting-${gameId}`).on('postgres_changes',{event:'*',schema:'public',table:'var_games',filter:`game_id=eq.${gameId}`},()=>void read()).subscribe();
  return()=>{alive=false;void supabase.removeChannel(ch);};
 },[gameId]);
 useEffect(()=>{if(!enabled||!supabase)return;void syncVarClock(supabase).catch(()=>{});const timer=setInterval(()=>void syncVarClock(supabase).catch(()=>{}),60000);return()=>clearInterval(timer);},[enabled]);
 async function toggle(){setBusy(true);setError('');try{await syncVarClock(supabase);const r=await supabase.rpc('pitch_var',{action:'toggle',payload:{gameId,enabled:!enabled}});if(r.error)throw r.error;setEnabled(Boolean(r.data.enabled));}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!supabase||!gameId)return null;
 const button={minHeight:44,padding:'10px 16px',borderRadius:R.control,border:`1px solid ${C.border}`,background:enabled?C.accent:C.card,color:enabled?C.bg:C.text1,fontSize:T.meta,fontWeight:800,cursor:'pointer'};
 return <div style={{marginBottom:S.md,display:'flex',flexWrap:'wrap',gap:S.sm,alignItems:'center'}}>
 {canManage&&<button type="button" style={button} disabled={busy} onClick={()=>void toggle()}>{busy?'Aguarda…':enabled?'Desativar VAR':'Ativar VAR'}</button>}
 {enabled&&confirmed&&<a style={{...button,textDecoration:'none',background:C.card,color:C.text1}} href={`/VAR/?game=${encodeURIComponent(gameId)}`}>Gravar com Pitch VAR</a>}
 <a style={{fontSize:T.meta,color:C.text2,padding:10}} href="/VAR/?view=goals">Meus gols</a>
 {error&&<div role="alert" style={{width:'100%',fontSize:T.meta,color:C.orange}}>{error}</div>}
 </div>;
}
