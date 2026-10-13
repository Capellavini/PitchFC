import React,{useState} from 'react';
import {ConnectedVar,varClient,type AvailableGame} from './connected';
export function VarConnection({network,active,game,matchId,onGame,onMatch,onError}:{network:ConnectedVar;active:boolean;game?:AvailableGame;matchId:string;onGame:(id:string)=>void;onMatch:(id:string)=>void;onError:(s:string)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);try{const {error}=await varClient!.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');await network.refresh();}catch(e){onError((e as Error).message);}finally{setBusy(false);}}
 if(!varClient)return null;
 return <section className="settings-card"><div className="section-label">MESMO GRUPO. MESMO JOGO.</div><h2>VAR da partida</h2>
 {!network.user?<><p>Entre na sua conta Pitch. Se você já entrou neste navegador, o login é reconhecido automaticamente.</p><form onSubmit={e=>void login(e)}><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar no Pitch'}</button></form><a className="text-button" href="/">Criar conta ou recuperar senha no Pitch</a></>:<>
 <p>Conta: {network.user.email}</p>
 {network.games.length?<><label>Partida<select disabled={active||network.uploading} value={game?.id??''} onChange={e=>onGame(e.target.value)}>{network.games.map(g=><option key={g.id} value={g.id}>{g.groupName} · {g.venue||'Campo'} · {new Date(g.scheduledAt??Date.now()).toLocaleDateString('pt-BR')}</option>)}</select></label>
 <label>Jogo que esta câmera vai filmar<select disabled={active||network.uploading} value={matchId} onChange={e=>onMatch(e.target.value)}><option value="">Escolha o jogo</option>{game?.matches.filter(m=>!m.concluded&&!m.isBye).map(m=><option key={m.id} value={String(m.id)}>Jogo {m.n}</option>)}</select></label>
 <p className="hint">Ao iniciar, você autoriza enviar os trechos dos gols aos respectivos autores. Seus gols ficam na galeria local; os demais ficam temporariamente na fila de envio. O acesso na nuvem dura 3 horas após o fim da partida.</p></>:<p>Não há partida com VAR liberado para você. Confirme presença no Pitch e peça ao organizador para ativar o VAR. Aguarde o início dos jogos.</p>}
 <button className="secondary" disabled={active||busy||network.uploading} onClick={()=>void network.refresh().catch(e=>onError(e.message))}>Atualizar partidas e meus gols</button>
 {network.warning&&<p className="error" role="status">{network.warning}</p>}
 </>}
 </section>;
}
