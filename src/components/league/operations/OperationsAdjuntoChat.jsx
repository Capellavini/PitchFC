import {useState,useRef,useEffect} from 'react';
import {Send,MessageCircle} from 'lucide-react';
import {adjuntoName,guidedAdjuntoReply} from '../../../lib/leagueAdjunto';
import {getLang} from '../../../lib/i18n';
import {Action,Tag} from './OperationsOverview';
const ACTIONS={afpce:'Abrir boletim AFPCE',sheet:'Conferir uma ficha',insights:'Ver pendências',recap:'Preparar resumo',live:'Abrir Matchday',whatsapp:'Ver fluxo WhatsApp',compare:'Comparar',teams:'Abrir clubes',calendar:'Abrir calendário',operations:'Abrir operação'};
export default function OperationsAdjuntoChat({competition,matches,teams,demo,requestAI,onAction,history,onHistory}){
 const [localHistory,setLocalHistory]=useState([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const messages=history??localHistory,setMessages=onHistory??setLocalHistory;
 const end=useRef(null),gate=useRef(false),name=adjuntoName(getLang());
 useEffect(()=>{if(messages.length)end.current?.scrollIntoView({block:'nearest'})},[messages.length]);
 const send=async value=>{
  const question=String(value||text).trim();if(!question||question.length>1500||gate.current)return;
  gate.current=true;setBusy(true);setError('');setText('');
  const next=[...messages,{role:'user',text:question}];setMessages(next);
  try{
   let reply;
   if(demo)reply=guidedAdjuntoReply(question,{competition,matches,teams});
   else{
    const r=await requestAI({task:'chat',leagueSlug:competition.league?.slug,competitionSlug:competition.slug,messages:next.slice(-9).map(m=>({role:m.role,text:m.text}))});
    if(r.error)throw Error(r.error);
    reply=r.reply;if(!reply?.text)throw Error('Resposta indisponível. Tenta novamente.');
   }
   setMessages(m=>[...m,{role:'assistant',text:reply.text,actions:reply.actions||[]}]);
  }catch(e){setMessages(messages);setError(e.message||'Não foi possível responder. Podes continuar pelas ferramentas do Adjunto.');setText(question)}
  finally{gate.current=false;setBusy(false)}
 };
 return <section className="ops-card"><div className="ops-card-head"><h2><MessageCircle size={20}/> Falar com o {name}</h2><Tag tone="accent">{demo?'Conversa guiada local':'Conversa com IA'}</Tag></div><p style={{color:'var(--ops-text2)',marginBottom:16}}>{demo?'A demonstração usa regras locais e dados fictícios.':'As perguntas, o histórico recente e um resumo autorizado da competição são enviados à Anthropic. Não inclua contatos ou licenças nas mensagens.'} As mensagens ficam nesta sessão e não alteram os registos.</p>
 <div className="ops-chat-log" role="log" aria-label="Conversa com o Adjunto" aria-live="polite">{messages.length?messages.map((m,i)=><article className={`ops-chat-message ${m.role}`} key={i}><small>{m.role==='user'?'Tu':name}</small><p style={{whiteSpace:'pre-wrap',marginTop:6}}>{m.text}</p>{m.role==='assistant'&&<div className="ops-actions" style={{marginTop:12}}>{(m.actions||[]).map(a=>ACTIONS[a]&&<Action key={a} onClick={()=>onAction(a)}>{ACTIONS[a]}</Action>)}</div>}</article>):<div className="ops-empty">Olá! Em que posso ajudar?</div>}<div ref={end}/></div>
 {!messages.length&&<div className="ops-actions" style={{margin:'16px 0'}}>{['O que falta fechar na jornada?','Quero comparar duas equipas','Como envio uma ficha pelo WhatsApp?'].map(q=><Action key={q} onClick={()=>send(q)}>{q}</Action>)}</div>}
 {error&&<div className="ops-alert" role="alert">{error}</div>}<form onSubmit={e=>{e.preventDefault();send()}}><label className="ops-field">Mensagem para o {name}<textarea className="ops-input" aria-label="Mensagem para o Adjunto" rows="3" maxLength={1500} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="Pergunta sobre fichas, calendário ou a jornada…"/></label><div className="ops-actions"><button type="submit" className="ops-btn primary" disabled={busy||!text.trim()}><Send size={16}/>{busy?'A preparar resposta…':'Enviar mensagem'}</button><small>Histórico desta sessão · Sem publicação ou alterações automáticas.</small></div></form></section>;
}
