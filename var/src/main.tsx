import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PhoneRecorder,type CaptureSettings} from './mobile/recorder';
import {type LocalClip,phraseMatches} from './mobile/model';
import {listClips,loadClip,deleteClip} from './mobile/storage';
import {FieldVoice,COMMANDS} from './mobile/voice';
import {exportMP4} from './mobile/export';
import './mobile.css';
import './design.css';
import {ConnectedVar,type CloudClip} from './mobile/connected';
import {VarConnection} from './mobile/VarConnection';
import {CameraControls} from './mobile/CameraControls';
import {ClipThumbnail} from './mobile/ClipThumbnail';
import {BASE,asset,OFFLINE_CACHE,PUBLIC_VAR} from './mobile/paths';

function ReplayPlayer({clip}:{clip:LocalClip}){
  const [index,setIndex]=useState(0),[src,setSrc]=useState('');const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const p=clip.parts[index];if(!p)return;const url=URL.createObjectURL(p.blob);setSrc(url);return()=>URL.revokeObjectURL(url);},[clip.id,index]);
  const part=clip.parts[index];
  const next=()=>{if(index<clip.parts.length-1)setIndex(index+1);else ref.current?.pause();};
  return <div className="replay-player"><video ref={ref} src={src} controls playsInline preload="metadata" onLoadedMetadata={()=>{if(ref.current){ref.current.currentTime=Math.max(0,clip.start-part.start);if(index>0)void ref.current.play().catch(()=>{});}}} onTimeUpdate={()=>{if(ref.current&&part.start+ref.current.currentTime>=clip.end){ref.current.pause();}}} onEnded={next}/><small>Trecho {index+1} de {clip.parts.length} · replay local. Prepare MP4 para um arquivo único.</small><button className="text-button" onClick={()=>{setIndex(0);if(ref.current)ref.current.currentTime=Math.max(0,clip.start-clip.parts[0].start);}}>Voltar ao início</button></div>;
}

function UiIcon({name}:{name:'gear'|'camera'|'play'|'moon'|'arrow'|'chevron'|'voice'|'close'}){
 const paths={gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z',camera:'M3 7h4l2-3h6l2 3h4v13H3V7Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',play:'m9 5 11 7-11 7V5Z',moon:'M20 14a8 8 0 0 1-10-10 9 9 0 1 0 10 10Z',arrow:'M4 12h16m-6-6 6 6-6 6',chevron:'m6 9 6 6 6-6',voice:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-4 5v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8',close:'m6 6 12 12M6 18 18 6'};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function FootballCourt(){return <svg className="football-court" viewBox="0 0 360 180" fill="none" aria-hidden="true"><rect width="360" height="180" fill="#0d2424"/><g stroke="#78a998" strokeWidth="1.5"><path d="M30 18H330V162H30Z M180 18V162 M30 51H78V129H30 M330 51H282V129H330 M30 70H50V110H30 M330 70H310V110H330"/><circle cx="180" cy="90" r="26"/><circle cx="180" cy="90" r="2"/></g><circle cx="240" cy="124" r="7" fill="#c8ff00"/><path d="m211 136 16-7" stroke="#c8ff00" strokeWidth="2" strokeLinecap="round"/></svg>;}
function TennisCourt(){return <div className="tennis-court" aria-hidden="true"><svg viewBox="0 0 360 174" fill="none"><rect x="22" y="12" width="316" height="150" rx="8" fill="#164d45"/><g stroke="#e1eddd" strokeWidth="2"><path d="M50 28H310V146H50Z M74 28V146 M286 28V146 M74 56H286 M74 118H286 M180 56V118"/><path d="M38 87H322" strokeWidth="3"/></g><path d="M38 91H322" stroke="#091b1b" strokeWidth="3" strokeDasharray="3 4"/><circle cx="271" cy="37" r="16" fill="#c8ff00"/><path d="M261 25C277 33 273 46 285 46" stroke="#fff" strokeWidth="2.5"/><path d="M249 43L223 62M250 52L236 63" stroke="#c8ff00" strokeOpacity=".5" strokeWidth="2"/></svg><span>MARI & EDER · NA QUADRA</span></div>;}

function App(){
  const engine=useRef(new PhoneRecorder()).current,voice=useRef(new FieldVoice()).current,network=useRef(new ConnectedVar()).current;
  const [varGameId,setVarGameId]=useState(new URLSearchParams(location.search).get('game')??''),[localOnly,setLocalOnly]=useState(PUBLIC_VAR);
  const [,rerender]=useState(0),[clips,setClips]=useState<LocalClip[]>([]),[tab,setTab]=useState<'camera'|'gallery'>(new URLSearchParams(location.search).get('view')==='goals'?'gallery':'camera');
  const [settings,setSettings]=useState<CaptureSettings>({quality:'balanced',pre:20,post:10,audio:false,demo:false});
  const [preview,setPreview]=useState(true),[field,setField]=useState(false),[voiceWanted,setVoiceWanted]=useState(true),[lang,setLang]=useState('pt-BR');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[playing,setPlaying]=useState<LocalClip>();
  const [exporting,setExporting]=useState(''),[progress,setProgress]=useState(0),[ready,setReady]=useState<{id:string;blob:Blob;url:string}>();
  const [offline,setOffline]=useState(false),[offlineBusy,setOfflineBusy]=useState(false),[wake,setWake]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false),[showTip,setShowTip]=useState(()=>{try{return localStorage.getItem('pitch-var-guide-'+BASE)!=='1';}catch{return true;}});
  const settingsDialog=useRef<HTMLDialogElement>(null),pairing=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const dialog=settingsDialog.current;if(!dialog)return;if(settingsOpen&&!dialog.open)dialog.showModal();else if(!settingsOpen&&dialog.open)dialog.close();},[settingsOpen]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),7000);return()=>clearTimeout(timer);},[message]);
  const video=useRef<HTMLVideoElement>(null);const exportBusy=useRef(false),lastTap=useRef(-Infinity);
  async function refresh(){try{setClips(await listClips());}catch{setError('O navegador não permite armazenamento local. Não inicie uma partida sem conseguir salvar clipes.');}}
  useEffect(()=>{
    network.onChange=()=>rerender(n=>n+1);network.onError=setError;network.onRefresh=()=>void refresh();
    network.onRemoteStop=()=>{if(engine.status.active){voice.stop();setField(false);void engine.stop('Gravação da partida encerrada ou acesso revogado. Confira os lances e a fila de envio.').then(()=>{if(!document.hidden)void network.uploadQueue();});}};
    if(!PUBLIC_VAR)void network.initialize().catch(e=>setError(e.message));
    engine.onChange=()=>{if(!engine.status.active&&network.sessionId)void network.stop();if(!engine.status.active&&voice.enabled)voice.stop();rerender(n=>n+1);setWake(!!engine.wake&&!engine.wake.released);};
    engine.onClip=c=>{void network.clipChanged(c);setClips(cs=>[{...c,parts:[]},...cs.filter(x=>x.id!==c.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));if(c.state==='saved')setMessage(c.association?'Gol guardado temporariamente. O envio começa após encerrar a câmera.':'Lance guardado no aparelho.');};
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
      // No match with VAR enabled → free mode: the camera still records and "Salvar lance" keeps clips on this phone, just without goal association.
      const linked=!!(network.user&&!settings.demo&&!localOnly&&selectedGame);
      if(linked)await network.clock();
      await engine.start(settings);
      if(linked){try{await network.begin(engine,selectedGame!);}catch(e){await engine.stop();throw e;}}
      setPreview(true);setTab('camera');
      if(pairing.current)pairing.current.open=false;
      setSettingsOpen(false);
      if(voiceWanted){try{voice.start(lang);}catch(e){setError((e as Error).message);}}
      setMessage(linked||PUBLIC_VAR||!network.user||settings.demo||localOnly?'Câmera ativa. Mantenha a tela desbloqueada.':'Modo livre: sem partida com VAR. Salve os lances pelo botão; eles ficam neste celular.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function stop(upload=true){setBusy(true);voice.stop();await engine.stop();await network.stop();setField(false);setBusy(false);setMessage(PUBLIC_VAR?'Gravação encerrada. Os lances estão neste celular; abra Meus lances para assistir ou compartilhar.':'Gravação encerrada. Mantenha a página aberta até concluir o envio dos gols.');if(!PUBLIC_VAR&&upload&&!document.hidden)void network.uploadQueue();}
  async function switchCamera(){await stop(false);await start();if(engine.status.active)setMessage('Câmera alterada. Confira o enquadramento; histórico reiniciado. Os lances salvos permanecem.');}
  function save(source:LocalClip['source']='button'){
    if(performance.now()-lastTap.current<1500)return;
    try{const c=engine.command(source);lastTap.current=performance.now();setMessage(`${PUBLIC_VAR?'Ponto':'Lance'} marcado${c.shortened?' · histórico curto':''}. Salvando…`);navigator.vibrate?.(50);}catch(e){setError((e as Error).message);}
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
      // Entradas locais são caminhos; o core remoto (VITE_FFMPEG_CORE_BASE) é URL absoluta.
      for(const request of await cache.keys()){const u=new URL(request.url);if(!keep.has(u.pathname)&&!keep.has(u.href))await cache.delete(request);}
      await navigator.storage?.persist?.();
      setOffline(true);setMessage('Página e processador prontos para uso offline. Reconhecimento de voz pode continuar exigindo internet.');
    }catch(e){setError((e as Error).message);}finally{setOfflineBusy(false);}
  }
  async function openCloud(c:CloudClip){setBusy(true);setError('');try{const blob=await network.download(c);setReady({id:c.id,blob,url:URL.createObjectURL(blob)});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const selectedGame=network.games.find(g=>g.id===varGameId)??network.games[0];
  const visibleClips=clips.filter(c=>!c.association||(c.association.uploaderUserId===network.user?.id&&c.association.scorerPlayerId===c.association.operatorPlayerId));
  const queued=clips.filter(c=>c.state==='saved'&&c.association&&c.association.uploaderUserId===network.user?.id&&!c.cloudUploaded&&!c.cloudExpired).length;
  const used=clips.filter(c=>c.state==='saved').reduce((n,c)=>n+c.bytes,0),active=engine.status.active;
  const filming=active&&!field;
  const saveLabel=PUBLIC_VAR?'Salvar ponto':'Salvar lance';
  const commandList=PUBLIC_VAR?COMMANDS.filter(p=>!p.includes('goal')):COMMANDS;
  const galleryBusy=active||network.uploading||!!exporting;
  if(field&&active)return <div className="field-mode"><div className="field-head"><img src={asset('brand/pitch-logo.png')} alt="Pitch"/><strong>VAR</strong><span>● GRAVANDO</span></div><div className="field-center"><div className={`voice-dot ${voice.listening?'on':''}`}/><h1>{voice.listening?'Pitch está ouvindo.':voice.enabled?'Reconectando voz…':'Câmera ativa.'}</h1><p>“Pitch, salve o lance”</p><small>{Math.floor(engine.status.history)}s de histórico · {engine.status.pending} pendente(s)</small><button onClick={()=>save()} disabled={busy} className="field-save">{saveLabel}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}</div><div className="field-footer"><p>Mantenha a tela desbloqueada.</p><button onClick={()=>setField(false)}>Mostrar câmera</button></div></div>;
  return <div className={`phone-shell redesign ${PUBLIC_VAR?'tennis':''}`}>
    <header><a className="brand" href={BASE} aria-label="Pitch VAR"><img src={asset('brand/pitch-logo.png')} alt="Pitch"/><strong>VAR</strong></a><button className="icon-button" aria-label="Abrir ajustes" onClick={()=>setSettingsOpen(true)}><UiIcon name="gear"/></button></header>
    <main>
      <div className="app-heading"><div><span className="eyebrow">{PUBLIC_VAR?'MARI & EDER · TÊNIS':'O JOGO EM REPLAY'}</span><h1>{tab==='gallery'?'Meus lances':PUBLIC_VAR?'Na quadra.':'Dentro do jogo.'}</h1></div><span className={`status-pill ${active?'live':''}`}><span className={`dot ${active?'live':''}`}/>{engine.status.pending?'Salvando':active?'Gravando':'Pronto'}</span></div>
      <nav aria-label="Área do VAR"><button className={tab==='camera'?'selected':''} aria-current={tab==='camera'?'page':undefined} onClick={()=>setTab('camera')}><UiIcon name="camera"/>Câmera</button><button className={tab==='gallery'?'selected':''} aria-current={tab==='gallery'?'page':undefined} onClick={()=>setTab('gallery')}><UiIcon name="play"/>Meus lances <span>{visibleClips.length+network.cloud.length}</span></button></nav>
      {!PUBLIC_VAR&&<details className="connection-drawer" ref={pairing}><summary><span><small>MATCHDAY</small><strong>{network.user?(selectedGame?.groupName??'Escolher partida'):'Conectar ao Pitch'}</strong></span><span className="connection-meta">{network.sessionId?(network.currentMatch?'Jogo '+network.currentMatch.n:'Aguardando jogo'):'Automático'} <UiIcon name="chevron"/></span></summary><VarConnection network={network} active={active} game={selectedGame} onGame={setVarGameId} onError={setError}/></details>}
      {error&&<div className="notice error" role="alert"><span>{error}</span><button aria-label="Fechar aviso" onClick={()=>setError('')}>×</button></div>}
      {message&&<div className="notice toast" role="status"><span>{message}</span><button aria-label="Fechar mensagem" onClick={()=>setMessage('')}>×</button></div>}
      {(queued>0||network.uploading)&&<aside className="upload-status" aria-live="polite"><span><strong>{network.uploading?'Enviando gols…':`${queued} lance(s) para enviar`}</strong><small>{network.uploadProgress||'Pare a câmera e mantenha a página aberta.'}</small></span><button className="compact-button" disabled={galleryBusy} onClick={()=>void network.uploadQueue()}>Enviar</button></aside>}
      {tab==='camera'?<>
        <section className="camera-stage" aria-label="Câmera de replay">
          <div className="viewfinder">
            {filming&&preview?<video className="camera-preview" ref={video} autoPlay muted playsInline/>:<div className={`camera-idle ${active?'preview-off':''}`}>
              {active?<><UiIcon name="moon"/><strong>Câmera gravando</strong><span>Prévia desligada</span></>:<>{PUBLIC_VAR?<TennisCourt/>:<FootballCourt/>}<div className="idle-caption"><strong>{PUBLIC_VAR?'Cada ponto merece replay.':'O próximo lance é teu.'}</strong><span>Apoie o celular e enquadre o jogo.</span></div></>}
            </div>}
            {active&&<div className="viewfinder-top"><span className="record-label">● REC</span><span>{Math.floor(engine.status.elapsed/60).toString().padStart(2,'0')}:{Math.floor(engine.status.elapsed%60).toString().padStart(2,'0')}</span></div>}
            <div className="viewfinder-bottom"><span>{settings.quality==='economy'?'ECONOMIA':'EQUILIBRADO'}</span><span>{settings.pre}s antes · {settings.post}s depois</span></div>
          </div>
          {active&&<div className="camera-toolbar"><details className="lens-controls"><summary><UiIcon name="camera"/>Zoom e lentes <UiIcon name="chevron"/></summary><CameraControls engine={engine} cameraId={settings.cameraId} onCamera={cameraId=>setSettings({...settings,cameraId})} onSwitch={switchCamera} onError={setError} disabled={busy}/></details><button className="compact-button" onClick={()=>setPreview(!preview)}>{preview?'Ocultar prévia':'Ver câmera'}</button></div>}
          <button className="primary capture-action" disabled={busy||!!exporting||network.uploading} onClick={()=>active?save():void start()}><span className="action-mark" aria-hidden="true">{active?'↶':'●'}</span><span>{busy?'Preparando…':active?saveLabel:'Iniciar câmera'}</span>{!active&&<UiIcon name="arrow"/>}</button>
          {active?<>
            <div className="capture-chips"><span className={voice.listening?'voice-active':''}><span className={`voice-dot ${voice.listening?'on':''}`}/>{voice.listening?'Ouvindo':voice.enabled?'Reconectando voz':'Voz desligada'}</span><span>{Math.floor(engine.status.history)}s de histórico</span>{engine.status.pending>0&&<span>{engine.status.pending} salvando</span>}</div>
            <div className="record-actions"><button className="secondary" onClick={()=>{setPreview(false);setField(true);}}><UiIcon name="moon"/>{PUBLIC_VAR?'Modo quadra':'Modo de campo'}</button><button className="stop" disabled={busy} onClick={()=>void stop()}><span aria-hidden="true">■</span> Parar câmera</button></div>
            <p className="screen-reminder">{wake?'Mantenha esta página aberta e a tela desbloqueada.':'Evite o bloqueio automático da tela enquanto grava.'}</p>
          </>:<div className="start-meta"><span><UiIcon name="voice"/>{voiceWanted?'Comando de voz ligado':'Salvar pelo botão'}</span><button onClick={()=>setSettingsOpen(true)}>{settings.quality==='economy'?'Economia':'Equilibrado'} <UiIcon name="chevron"/></button></div>}
        </section>
        {showTip&&!active&&<aside className="first-use"><span>Permita a câmera e mantenha a tela desbloqueada. Os lances ficam neste celular.</span><button onClick={()=>{setShowTip(false);try{localStorage.setItem('pitch-var-guide-'+BASE,'1');}catch{}}}>Entendi</button></aside>}
        {!active&&visibleClips.length>0&&<button className="recent-link" onClick={()=>setTab('gallery')}><span>↶ <strong>{visibleClips.length} {PUBLIC_VAR?'ponto(s)':'lance(s)'} guardados</strong></span><UiIcon name="arrow"/></button>}
      </>:<section className="gallery">
        <div className="gallery-heading"><span>{PUBLIC_VAR?'Os teus melhores pontos.':'Os teus melhores momentos.'}</span>{network.user&&!PUBLIC_VAR&&<button className="text-button" disabled={busy||network.uploading} onClick={()=>void network.refresh().catch(e=>setError(e.message))}>Atualizar</button>}</div>
        {!visibleClips.length&&!network.cloud.length&&<div className="empty"><span>↶</span><h3>{PUBLIC_VAR?'Um ponto para guardar.':'Um lance para guardar.'}</h3><p>Inicie a câmera e salve seu primeiro replay.</p><button className="secondary" onClick={()=>setTab('camera')}>Abrir câmera</button></div>}
        <div className="clip-grid">
          {visibleClips.map(c=><article className={`clip-card ${playing?.id===c.id?'expanded':''}`} key={c.id}>
            {c.state==='collecting'?<div className="collecting">Salvando o lance…</div>:c.state==='failed'?<p className="error">{c.error}</p>:<>
              {playing?.id===c.id?<ReplayPlayer key={c.id} clip={playing}/>:<button className="open-replay" aria-label={`Assistir lance das ${new Date(c.createdAt).toLocaleTimeString('pt-BR')}`} onClick={()=>void playClip(c)}><ClipThumbnail clip={c} disabled={galleryBusy}/></button>}
            </>}
            <div className="clip-title"><strong>{new Date(c.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong><span>{c.source==='voice'?'Voz':c.source==='matchday'?'Matchday':'Local'}</span></div>
            {c.state==='saved'&&<>
              {playing?.id===c.id&&<div className="clip-details">{c.shortened&&<p className="hint">Histórico curto: o lance começou mais tarde.</p>}{c.interrupted&&<p className="error">Gravação interrompida antes de completar o lance.</p>}<button className="secondary" disabled={galleryBusy} onClick={()=>void prepare(c)}>{exporting===c.id?`Preparando · ${progress}%`:'Preparar para compartilhar'}</button><button className="text-button" onClick={()=>setPlaying(undefined)}>Fechar replay</button></div>}
              {ready?.id===c.id&&<div className="export-ready"><a href={ready.url} download={`Pitch-VAR-${c.id}.mp4`}>Baixar MP4 ↓</a><button onClick={()=>void share()}>Compartilhar</button></div>}
              <details className="clip-options"><summary aria-label="Opções do lance">···</summary><div><span>{(c.bytes/1024**2).toFixed(1)} MB</span><button disabled={galleryBusy} onClick={()=>void prepare(c)}>{exporting===c.id?`${progress}%`:'Preparar MP4'}</button><button className="danger" disabled={!!exporting||network.uploading} onClick={()=>void remove(c)}>Excluir</button></div></details>
            </>}
          </article>)}
          {network.cloud.map(c=><article className={`clip-card cloud-card ${ready?.id===c.id?'expanded':''}`} key={c.id}>
            {ready?.id===c.id?<video className="camera-preview" src={ready.url} controls playsInline/>:<button className="open-replay cloud-poster" disabled={busy||galleryBusy} onClick={()=>void openCloud(c)}><UiIcon name="play"/><span>{c.ownGoal?'Autogolo':'Meu gol'}</span><small>{busy?'Abrindo…':'Abrir vídeo'}</small></button>}
            <div className="clip-title"><strong>{new Date(c.occurredAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong><span>Nuvem</span></div><p className="cloud-context">{c.groupName}</p><small className="expiry">Baixe até {new Date(c.expiresAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small>
            {ready?.id===c.id&&<div className="export-ready"><a href={ready.url} download={`Pitch-VAR-${c.goalId}.mp4`}>Baixar meu gol ↓</a><button onClick={()=>void share()}>Compartilhar</button></div>}
          </article>)}
        </div>
        {visibleClips.length>0&&<div className="gallery-storage"><span>{(used/1024**2).toFixed(1)} de 200 MB no aparelho</span><span>Baixe para guardar.</span></div>}
      </section>}
    </main>
    <dialog ref={settingsDialog} className="settings-dialog" onCancel={()=>setSettingsOpen(false)} onClose={()=>setSettingsOpen(false)}>
      <div className="sheet-heading"><div><span className="eyebrow">PITCH VAR</span><h2>Ajustes</h2></div><button autoFocus className="icon-button" aria-label="Fechar ajustes" onClick={()=>setSettingsOpen(false)}><UiIcon name="close"/></button></div>
      {error&&<div className="notice error" role="alert"><span>{error}</span><button aria-label="Fechar aviso nos ajustes" onClick={()=>setError('')}>×</button></div>}
      <section className="settings-card">
        <label>Qualidade<select disabled={active} value={settings.quality} onChange={e=>setSettings({...settings,quality:e.target.value as CaptureSettings['quality']})}><option value="balanced">Equilibrado · 720p</option><option value="economy">Economia · 480p</option></select></label>
        {!active&&engine.cameras.length>1&&<label>Câmera<select value={settings.cameraId??''} onChange={e=>setSettings({...settings,cameraId:e.target.value||undefined})}><option value="">Traseira automática</option>{engine.cameras.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
        <label className="check"><input type="checkbox" checked={voiceWanted} onChange={e=>{setVoiceWanted(e.target.checked);if(active){if(e.target.checked){try{voice.start(lang);}catch(err){setError((err as Error).message);}}else voice.stop();}}}/>Salvar por comando de voz</label>
        {voiceWanted&&<><label>Idioma<select disabled={active} value={lang} onChange={e=>setLang(e.target.value)}><option value="pt-BR">Português</option><option value="en-US">English</option></select></label><p className="commands">{commandList.map(p=><span key={p}>“{p}”</span>)}</p><p className="hint">A voz depende do navegador, da conexão e do ruído. O serviço pode enviar áudio à internet.</p></>}
        <div className="section-label settings-label">JANELA DO REPLAY</div><div className="two-buttons"><label>Antes · segundos<input disabled={active} type="number" min={5} max={30} value={settings.pre} onChange={e=>setSettings({...settings,pre:Math.min(30,Math.max(5,Number(e.target.value)))})}/></label><label>Depois · segundos<input disabled={active} type="number" min={0} max={15} value={settings.post} onChange={e=>setSettings({...settings,post:Math.min(15,Math.max(0,Number(e.target.value)))})}/></label></div>
        <label className="check"><input disabled={active} type="checkbox" checked={settings.audio} onChange={e=>setSettings({...settings,audio:e.target.checked})}/>Áudio da partida no vídeo</label>
        {!PUBLIC_VAR&&<label className="check"><input disabled={active} type="checkbox" checked={localOnly} onChange={e=>setLocalOnly(e.target.checked)}/>Gravar localmente, sem Matchday</label>}
        <details><summary>Sem internet</summary><p className="hint">Baixe a página e o processador (~32 MB) antes de sair. Voz pode exigir conexão.</p><button className="secondary" disabled={active||offlineBusy||!!exporting||network.uploading} onClick={()=>void prepareOffline()}>{offlineBusy?'Preparando…':offline?'Atualizar pacote offline':'Preparar uso offline'}</button></details>
        <details><summary>Ajuda e armazenamento</summary><p className="hint">Mantenha a página aberta, o celular desbloqueado e o brilho baixo. O modo de campo escurece a tela, sem bloquear o celular.</p><p className="hint">Histórico de cerca de 45s, até 24 MB. Galeria e fila: até 200 MB. Limpar os dados do navegador apaga os lances locais.</p><p className="hint">{PUBLIC_VAR?'Sem login e sem envio à nuvem. Baixe ou compartilhe os vídeos para guardar.':'Os gols do Matchday são enviados depois de parar a câmera. Mantenha a página aberta até concluir; o autor pode baixar por 3h após encerrar a partida.'}</p><p className="hint">Use Safari no iPhone ou Chrome no Android. Zoom e lentes dependem do aparelho. Apple Watch ainda não integrado.</p></details>
        <details><summary>Testar sem câmera</summary><label className="check"><input disabled={active} type="checkbox" checked={settings.demo} onChange={e=>setSettings({...settings,demo:e.target.checked})}/>Vídeo de demonstração</label><button className="secondary" disabled={!active} onClick={()=>{const t=prompt('Frase simulada:');if(t){if(COMMANDS.some(p=>phraseMatches(t,p)))save('voice');else setMessage('Comando não reconhecido.');}}}>Simular comando de voz</button></details>
      </section>
    </dialog>
    <footer>{PUBLIC_VAR?'Pitch VAR · Mari & Eder':'Pitch VAR'}<span>Feito para o teu jogo.</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
