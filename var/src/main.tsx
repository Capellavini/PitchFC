import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PhoneRecorder,type CaptureSettings} from './mobile/recorder';
import {type LocalClip,phraseMatches} from './mobile/model';
import {listClips,loadClip,deleteClip} from './mobile/storage';
import {FieldVoice,COMMANDS} from './mobile/voice';
import {exportMP4} from './mobile/export';
import './mobile.css';
import {ConnectedVar,type CloudClip} from './mobile/connected';
import {VarConnection} from './mobile/VarConnection';
import {CameraControls} from './mobile/CameraControls';
import {BASE,asset,OFFLINE_CACHE,PUBLIC_VAR} from './mobile/paths';

function ReplayPlayer({clip}:{clip:LocalClip}){
  const [index,setIndex]=useState(0),[src,setSrc]=useState('');const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const p=clip.parts[index];if(!p)return;const url=URL.createObjectURL(p.blob);setSrc(url);return()=>URL.revokeObjectURL(url);},[clip.id,index]);
  const part=clip.parts[index];
  const next=()=>{if(index<clip.parts.length-1)setIndex(index+1);else ref.current?.pause();};
  return <div className="replay-player"><video ref={ref} src={src} controls playsInline preload="metadata" onLoadedMetadata={()=>{if(ref.current){ref.current.currentTime=Math.max(0,clip.start-part.start);if(index>0)void ref.current.play().catch(()=>{});}}} onTimeUpdate={()=>{if(ref.current&&part.start+ref.current.currentTime>=clip.end){ref.current.pause();}}} onEnded={next}/><small>Trecho {index+1} de {clip.parts.length} · replay local. Prepare MP4 para um arquivo único.</small><button className="text-button" onClick={()=>{setIndex(0);if(ref.current)ref.current.currentTime=Math.max(0,clip.start-clip.parts[0].start);}}>Voltar ao início</button></div>;
}

function App(){
  const engine=useRef(new PhoneRecorder()).current,voice=useRef(new FieldVoice()).current,network=useRef(new ConnectedVar()).current;
  const [varGameId,setVarGameId]=useState(new URLSearchParams(location.search).get('game')??''),[varMatchId,setVarMatchId]=useState(''),[localOnly,setLocalOnly]=useState(PUBLIC_VAR);
  const [,rerender]=useState(0),[clips,setClips]=useState<LocalClip[]>([]),[tab,setTab]=useState<'camera'|'gallery'>(new URLSearchParams(location.search).get('view')==='goals'?'gallery':'camera');
  const [settings,setSettings]=useState<CaptureSettings>({quality:'balanced',pre:20,post:10,audio:false,demo:false});
  const [preview,setPreview]=useState(true),[field,setField]=useState(false),[voiceWanted,setVoiceWanted]=useState(true),[lang,setLang]=useState('pt-BR');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[playing,setPlaying]=useState<LocalClip>();
  const [exporting,setExporting]=useState(''),[progress,setProgress]=useState(0),[ready,setReady]=useState<{id:string;blob:Blob;url:string}>();
  const [offline,setOffline]=useState(false),[offlineBusy,setOfflineBusy]=useState(false),[wake,setWake]=useState(false);
  const video=useRef<HTMLVideoElement>(null);const exportBusy=useRef(false),lastTap=useRef(-Infinity);
  async function refresh(){try{setClips(await listClips());}catch{setError('O navegador não permite armazenamento local. Não inicie uma partida sem conseguir salvar clipes.');}}
  useEffect(()=>{
    network.onChange=()=>rerender(n=>n+1);network.onError=setError;network.onRefresh=()=>void refresh();
    network.onRemoteStop=()=>{if(engine.status.active){voice.stop();setField(false);void engine.stop('Gravação da partida encerrada ou acesso revogado. Confira os lances e a fila de envio.').then(()=>{if(!document.hidden)void network.uploadQueue();});}};
    if(!PUBLIC_VAR)void network.initialize().catch(e=>setError(e.message));
    engine.onChange=()=>{if(!engine.status.active&&network.sessionId)void network.stop();if(!engine.status.active&&voice.enabled)voice.stop();rerender(n=>n+1);setWake(!!engine.wake&&!engine.wake.released);};
    engine.onClip=c=>{void network.clipChanged(c);setClips(cs=>[c,...cs.filter(x=>x.id!==c.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));if(c.state==='saved')setMessage(c.association?'Gol guardado temporariamente. O envio começa após encerrar a câmera.':'Lance guardado no aparelho.');};
    engine.onError=setError;voice.onchange=()=>rerender(n=>n+1);voice.onerror=setError;
    voice.oncommand=()=>save('voice');
    const visibility=()=>{if(document.hidden){voice.stop();setField(false);if(engine.status.active)void engine.stop('A página saiu de primeiro plano. Gravação encerrada; confira os lances salvos e inicie novamente.');}else if(engine.status.active)void engine.acquireWake();};
    const unload=(e:BeforeUnloadEvent)=>{if(engine.status.active||network.uploading){e.preventDefault();e.returnValue='';}};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('beforeunload',unload);void refresh();
    if('serviceWorker'in navigator)void navigator.serviceWorker.register(asset('sw.js'),{scope:BASE}).then(async()=>{const cache=await caches.open(OFFLINE_CACHE);setOffline(!!await cache.match(asset('offline-ready')));}).catch(()=>{});
    return()=>{network.dispose();voice.stop();void engine.stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('beforeunload',unload);};
  },[]);
  useEffect(()=>{if(video.current){video.current.srcObject=preview?engine.stream??null:null;if(preview&&engine.stream)void video.current.play().catch(()=>{});}},[engine.status.active,preview,tab,field]);
  useEffect(()=>()=>{if(ready)URL.revokeObjectURL(ready.url);},[ready]);
  async function start(){
    if(exportBusy.current||network.uploading)return;
    setBusy(true);setError('');setMessage('');setReady(undefined);
    try{
      if(network.user&&!settings.demo&&!localOnly){if(!selectedGame||!selectedMatch)throw Error('Escolha uma partida liberada e o jogo que esta câmera vai filmar.');await network.clock();}
      await engine.start(settings);
      if(network.user&&!settings.demo&&!localOnly){try{await network.begin(engine,selectedGame!,selectedMatch);}catch(e){await engine.stop();throw e;}}
      setPreview(true);setTab('camera');
      if(voiceWanted){try{voice.start(lang);}catch(e){setError((e as Error).message);}}
      setMessage('Câmera ativa. Enquadre o campo e toque em Modo de campo. Mantenha esta página aberta e a tela desbloqueada.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function stop(upload=true){setBusy(true);voice.stop();await engine.stop();await network.stop();setField(false);setBusy(false);setMessage(PUBLIC_VAR?'Gravação encerrada. Os lances estão neste celular; abra Meus lances para assistir ou compartilhar.':'Gravação encerrada. Mantenha a página aberta até concluir o envio dos gols.');if(!PUBLIC_VAR&&upload&&!document.hidden)void network.uploadQueue();}
  async function switchCamera(){await stop(false);await start();if(engine.status.active)setMessage('Câmera alterada. Confira o enquadramento; histórico reiniciado. Os lances salvos permanecem.');}
  function save(source:LocalClip['source']='button'){
    if(performance.now()-lastTap.current<1500)return;
    try{const c=engine.command(source);lastTap.current=performance.now();setMessage(`Lance marcado. Guardando ${settings.post}s depois${c.shortened?' · histórico ainda curto':''}.`);navigator.vibrate?.(50);}catch(e){setError((e as Error).message);}
  }
  async function prepare(c:LocalClip){
    if(engine.status.active||network.uploading){setError('Encerre a gravação para preparar MP4. Assim o processamento não compete com a câmera nem aquece o aparelho durante o jogo.');return;}
    if(exportBusy.current)return;
    exportBusy.current=true;setExporting(c.id);setProgress(0);setError('');setReady(undefined);
    try{const source=await loadClip(c.id);const blob=await exportMP4(source,setProgress);setReady({id:c.id,blob,url:URL.createObjectURL(blob)});setMessage('MP4 pronto. Baixe ou compartilhe antes de preparar outro.');}
    catch(e){setError(`${(e as Error).message} O replay original continua salvo.`);}finally{exportBusy.current=false;setExporting('');}
  }
  async function share(){
    if(!ready)return;const file=new File([ready.blob],`Pitch-VAR-${ready.id}.mp4`,{type:'video/mp4'});
    try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Pitch VAR'});else setMessage('Compartilhamento indisponível neste navegador. Use Baixar MP4.');}catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}
  }
  async function remove(c:LocalClip){if(!confirm('Excluir este replay do navegador? Exporte antes se quiser guardar.'))return;try{await deleteClip(c.id);setClips(cs=>cs.filter(x=>x.id!==c.id));if(ready?.id===c.id)setReady(undefined);if(playing?.id===c.id)setPlaying(undefined);}catch(e){setError((e as Error).message);}}
  async function playClip(c:LocalClip){try{setPlaying(await loadClip(c.id));}catch(e){setError((e as Error).message);}}
  async function prepareOffline(){
    setOfflineBusy(true);setError('');
    try{
      const r=await fetch(asset('offline-files.json'));if(!r.ok)throw Error('Pacote offline indisponível. Atualize a página por HTTPS.');
      const {files}=await r.json() as {files:string[]};const cache=await caches.open(OFFLINE_CACHE);
      // Inclui o processador ~32 MB, carregado só se o usuário escolher uso offline/exportação.
      for(const url of files)await cache.add(new Request(url,{cache:'reload'}));
      await cache.add(BASE);await cache.put(asset('offline-ready'),new Response('ready'));
      const keep=new Set([...files,BASE,asset('offline-ready')]);
      for(const request of await cache.keys())if(!keep.has(new URL(request.url).pathname))await cache.delete(request);
      await navigator.storage?.persist?.();
      setOffline(true);setMessage('Página e processador prontos para uso offline. Reconhecimento de voz pode continuar exigindo internet.');
    }catch(e){setError((e as Error).message);}finally{setOfflineBusy(false);}
  }
  async function openCloud(c:CloudClip){setBusy(true);setError('');try{const blob=await network.download(c);setReady({id:c.id,blob,url:URL.createObjectURL(blob)});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const selectedGame=network.games.find(g=>g.id===varGameId)??network.games[0];
  const selectedMatch=selectedGame?.matches.some(m=>String(m.id)===varMatchId&&!m.concluded&&!m.isBye)?varMatchId:'';
  const visibleClips=clips.filter(c=>!c.association||(c.association.uploaderUserId===network.user?.id&&c.association.scorerPlayerId===c.association.operatorPlayerId));
  const queued=clips.filter(c=>c.state==='saved'&&c.association?.uploaderUserId===network.user?.id&&!c.cloudUploaded&&!c.cloudExpired).length;
  const used=clips.filter(c=>c.state==='saved').reduce((n,c)=>n+c.bytes,0),active=engine.status.active;
  if(field&&active)return <div className="field-mode"><div className="field-head"><img src={asset('brand/pitch-logo.png')} alt="Pitch"/><strong>VAR</strong><span>● GRAVANDO</span></div><div className="field-center"><div className={`voice-dot ${voice.listening?'on':''}`}/><h1>{voice.listening?'Pitch está ouvindo.':voice.enabled?'Reconectando voz…':'Câmera ativa.'}</h1><p>“Pitch, salve o lance”<br/>“Pitch, record this goal”<br/>“Pitch, record this part”</p><small>{Math.floor(engine.status.history)}s de histórico · {engine.status.pending} pendente(s)</small><button onClick={()=>save()} className="field-save">Salvar lance</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}</div><div className="field-footer"><p>Tela escura ≠ tela bloqueada. Mantenha esta página aberta.</p><button onClick={()=>setField(false)}>Mostrar controles</button></div></div>;
  return <div className="phone-shell"><header><a className="brand" href={BASE} aria-label="Pitch VAR"><img src={asset('brand/pitch-logo.png')} alt="Pitch"/><strong>VAR</strong></a><span className="tag">CÂMERA NO CELULAR</span></header>
    <main><div className="intro"><span className="eyebrow">APOIE O CELULAR. JOGUE. GUARDE O LANCE.</span><h1>O teu jogo.<br/><em>O teu replay.</em></h1><p>iPhone ou Android. Tudo gravado neste aparelho.</p></div>
      {error&&<div className="notice error" role="alert">{error}<button aria-label="Fechar aviso" onClick={()=>setError('')}>×</button></div>}{message&&<div className="notice" role="status">{message}</div>}
      <nav><button className={tab==='camera'?'selected':''} onClick={()=>setTab('camera')}>Câmera</button><button className={tab==='gallery'?'selected':''} onClick={()=>setTab('gallery')}>Meus lances <span>{visibleClips.length+network.cloud.length}</span></button></nav>
      {!PUBLIC_VAR&&<VarConnection network={network} active={active} game={selectedGame} matchId={selectedMatch} onGame={id=>{setVarGameId(id);setVarMatchId('');}} onMatch={setVarMatchId} onError={setError}/>}
      {(queued>0||network.uploading||network.uploadProgress)&&<section className="storage-note"><strong>Fila temporária de envio</strong><p>{queued} lance(s) aguardando · {network.uploadProgress||'Envio após parar a câmera. Mantenha a página aberta.'}</p><button className="secondary" disabled={active||network.uploading||!!exporting} onClick={()=>void network.uploadQueue()}>Enviar lances pendentes</button></section>}
      {tab==='camera'?<>
        <section className="capture-card"><div className="capture-status"><span className={`dot ${active?'live':''}`}/><strong>{active?'Gravando neste celular':'Pronto para o campo'}</strong>{active&&<span>{Math.floor(engine.status.history)}s de histórico</span>}</div>
          {active&&preview?<video className="camera-preview" ref={video} autoPlay muted playsInline/>:<div className="camera-placeholder"><span>{active?'◐':'↶'}</span><strong>{active?'Prévia desligada. Câmera gravando.':'O seu celular é a câmera.'}</strong><p>{active?'Poupe tela e processamento depois de enquadrar.':'Apoie na horizontal, enquadre o campo e inicie.'}</p></div>}
          {active&&<CameraControls engine={engine} cameraId={settings.cameraId} onCamera={cameraId=>setSettings({...settings,cameraId})} onSwitch={switchCamera} onError={setError} disabled={busy}/>}
          {active?<><button className="primary big" disabled={busy} onClick={()=>save()}>↶ Salvar lance <small>{settings.pre}s antes + {settings.post}s depois</small></button><div className="two-buttons"><button className="secondary" onClick={()=>{setPreview(false);setField(true);}}>Modo de campo ◐</button><button className="secondary" onClick={()=>setPreview(!preview)}>{preview?'Desligar prévia':'Ver enquadramento'}</button></div><div className="metrics"><span>{engine.status.bufferMB.toFixed(1)} MB de histórico</span><span>{engine.status.pending} lance(s) pendente(s)</span></div><p className="hint">{wake?'Tela mantida ativa durante a captura.':'Bloqueio automático não impedido: configure a tela para não bloquear enquanto grava.'} Reduza o brilho nas configurações do celular.</p><button className="stop" disabled={busy} onClick={()=>void stop()}>{PUBLIC_VAR?'Parar câmera':'Parar câmera e enviar gols'}</button></>:<><button className="primary big" disabled={busy||!!exporting||network.uploading} onClick={()=>void start()}>{busy?'Preparando câmera…':'Iniciar câmera neste celular ↗'}</button><p className="hint">A câmera e o microfone pedem permissão no navegador. Use HTTPS. Sem computador, conta ou transmissão contínua à nuvem.</p></>}
        </section>
        <section className="settings-card"><div className="section-label">UM AJUSTE. DEPOIS É SÓ JOGAR.</div><h2>Preparar a partida</h2><label>Qualidade<select disabled={active} value={settings.quality} onChange={e=>setSettings({...settings,quality:e.target.value as CaptureSettings['quality']})}><option value="balanced">Equilibrado · 720p / 24 fps</option><option value="economy">Economia · 480p / 20 fps</option></select></label><p className="hint">A resolução real depende da câmera. Sem 4K ou qualidade máxima por padrão.</p>{!active&&engine.cameras.length>1&&<label>Câmera para iniciar<select value={settings.cameraId??""} onChange={e=>setSettings({...settings,cameraId:e.target.value||undefined})}><option value="">Traseira automática</option>{engine.cameras.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
          <label className="check"><input type="checkbox" checked={voiceWanted} onChange={e=>{setVoiceWanted(e.target.checked);if(active){if(e.target.checked){try{voice.start(lang);}catch(err){setError((err as Error).message);}}else voice.stop();}}}/>Escuta contínua enquanto grava</label>
          <div className="voice-info"><span className={`voice-dot ${voice.listening?'on':''}`}/><strong>{voice.listening?'Ouvindo comandos':voice.enabled?'Voz reconectando':'Voz desligada'}</strong></div>
          <label>Idioma do reconhecimento<select disabled={active} value={lang} onChange={e=>setLang(e.target.value)}><option value="pt-BR">Português</option><option value="en-US">English</option></select></label><p className="commands">{COMMANDS.map(p=><span key={p}>“{p}”</span>)}</p><p className="hint">As três frases são aceitas. Escolha o idioma em que vai falar para melhorar o reconhecimento. O serviço do navegador pode enviar áudio à internet; Pitch VAR não guarda áudio de comandos nem transcrições. Ruído e distância podem impedir o comando.</p>
          <details><summary>Mais opções</summary><div className="two-buttons"><label>Antes (s)<input disabled={active} type="number" min={5} max={30} value={settings.pre} onChange={e=>setSettings({...settings,pre:Math.min(30,Math.max(5,Number(e.target.value)))})}/></label><label>Depois (s)<input disabled={active} type="number" min={0} max={15} value={settings.post} onChange={e=>setSettings({...settings,post:Math.min(15,Math.max(0,Number(e.target.value)))})}/></label></div><label className="check"><input disabled={active} type="checkbox" checked={settings.audio} onChange={e=>setSettings({...settings,audio:e.target.checked})}/>Gravar áudio da partida</label>{!PUBLIC_VAR&&<><label className="check"><input disabled={active} type="checkbox" checked={localOnly} onChange={e=>setLocalOnly(e.target.checked)}/>Gravação local sem Matchday</label><p className="hint">Para uso sem conexão: salva pelo botão ou voz neste aparelho, sem receber gols automáticos nem enviar à nuvem.</p></>}<label className="check"><input disabled={active} type="checkbox" checked={settings.demo} onChange={e=>setSettings({...settings,demo:e.target.checked})}/>Teste sem câmera · vídeo com contador</label><p className="hint">O teste gera vídeo no próprio navegador. Não acessa câmera nem representa validação em campo.</p><button className="secondary" disabled={!active} onClick={()=>{const t=prompt('Frase simulada:');if(t){if(COMMANDS.some(p=>phraseMatches(t,p)))save('voice');else setMessage('Frase diferente: nenhum lance salvo.');}}}>Testar comando de voz sem microfone</button></details>
        </section>
      </>:<section className="gallery"><div className="section-label">GUARDADOS NESTE NAVEGADOR</div><h2>Os teus melhores lances.</h2><p className="hint">{(used/1024**2).toFixed(1)} / 200 MB. Exporte antes de excluir. Limpar os dados do navegador apaga estes vídeos.</p>{!visibleClips.length&&!network.cloud.length&&<div className="empty">↶<h3>O próximo lance pode ser teu.</h3><p>Inicie a câmera e marque um momento.</p></div>}
        {visibleClips.map(c=><article className="clip-card" key={c.id}><div className="clip-title"><strong>{new Date(c.createdAt).toLocaleTimeString('pt-BR')}</strong><span>{(c.end-c.start).toFixed(1)}s · {c.source==='voice'?'voz':c.source==='matchday'?'Matchday':'botão'}</span></div>{c.state==='collecting'?<div className="collecting">Guardando os segundos depois do lance…</div>:c.state==='failed'?<p className="error">{c.error}</p>:<>{playing?.id===c.id?<ReplayPlayer key={c.id} clip={playing}/>:<button className="open-replay" onClick={()=>void playClip(c)}>▶ Assistir replay local</button>}{c.shortened&&<p className="hint">Janela reduzida ao histórico disponível.</p>}{c.interrupted&&<p className="error">A câmera foi interrompida antes de completar o lance.</p>}<button className="secondary" disabled={active||!!exporting||network.uploading} onClick={()=>void prepare(c)}>{exporting===c.id?`Preparando MP4 · ${progress}%`:'Preparar MP4 para compartilhar'}</button>{ready?.id===c.id&&<div className="export-ready"><a href={ready.url} download={`Pitch-VAR-${c.id}.mp4`}>Baixar MP4 ↓</a><button onClick={()=>void share()}>Compartilhar</button></div>}<p className="hint">{(c.bytes/1024**2).toFixed(1)} MB · processamento do MP4 só após encerrar a gravação.</p><button className="text-button danger" disabled={!!exporting||network.uploading} onClick={()=>void remove(c)}>Excluir replay</button></>}</article>)}
      {network.cloud.map(c=><article className="clip-card" key={c.id}><div className="clip-title"><strong>{c.ownGoal?'Autogolo':'Meu gol'} · {c.groupName}</strong><span>{new Date(c.occurredAt).toLocaleTimeString('pt-BR')}</span></div><p className="hint">Disponível até {new Date(c.expiresAt).toLocaleString('pt-BR')}. Baixe para guardar.</p><button className="secondary" disabled={busy||active||network.uploading||!!exporting} onClick={()=>void openCloud(c)}>Abrir vídeo da nuvem</button>{ready?.id===c.id&&<><video className="camera-preview" src={ready.url} controls playsInline/><div className="export-ready"><a href={ready.url} download={`Pitch-VAR-${c.goalId}.mp4`}>Baixar meu gol ↓</a><button onClick={()=>void share()}>Compartilhar</button></div></>}</article>)}
      </section>}
      <section className="storage-note"><strong>Histórico curto. Memória controlada.</strong><p>O histórico mantém cerca de 45 segundos, com teto de 24 MB de vídeo. Trechos antigos são descartados. Só os lances marcados ficam guardados, até 200 MB.</p><p>{PUBLIC_VAR?'Sem login e sem envio à nuvem. Salve pelo botão ou voz; os vídeos ficam neste navegador. Baixe ou compartilhe os lances para guardar uma cópia.':'Sem upload contínuo. Os gols automáticos são enviados após encerrar a câmera e ficam disponíveis ao autor por 3 horas após o fim da partida.'}</p><button className="secondary" disabled={active||offlineBusy||!!exporting||network.uploading} onClick={()=>void prepareOffline()}>{offlineBusy?'Preparando arquivos…':offline?'Atualizar pacote offline':'Preparar uso sem internet'}</button><p className="hint">Opcional: baixa também o processador de vídeo (~32 MB). Voz pode exigir internet. Nenhum app precisa ser instalado.</p></section>
      <p className="footnote">Safari no iPhone · Chrome no Android · câmera no próprio aparelho. Tela escura não é tela bloqueada. Apple Watch ainda não se conecta a esta versão de navegador.</p>
    </main><footer>Pitch VAR · navegador · sem gravador externo</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
