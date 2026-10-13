import { clipWindow, overlaps, retained, type LocalClip, type Part } from './model';
import { putClip, listClips, GALLERY_LIMIT } from './storage';
import {cameraZoom,applyCameraZoom,type ZoomRange} from './camera';
import type {ReplayPlan} from './matchday-var';

export interface CaptureSettings { quality:'economy'|'balanced'; pre:number; post:number; audio:boolean; demo:boolean; cameraId?:string }
export interface CaptureStatus { active:boolean; history:number; bufferMB:number; elapsed:number; pending:number; error?:string; mime:string; gaps:number }
export class PhoneRecorder {
  stream?:MediaStream; recorder?:MediaRecorder;
  status:CaptureStatus={active:false,history:0,bufferMB:0,elapsed:0,pending:0,mime:'',gaps:0};
  parts:Part[]=[];pending:LocalClip[]=[];
  settings!:CaptureSettings;startMono=0;
  rotate?:ReturnType<typeof setTimeout>;ticker?:ReturnType<typeof setInterval>;
  wake?:WakeLockSentinel;generation=0;stopping=false;finishing?:Promise<void>;
  reservedBytes=0;persisting=0;
  private cleanupDemo?:()=>void;
  cameras:{id:string;label:string}[]=[];cameraId='';zoom?:ZoomRange;
  async setZoom(value:number){
    const track=this.stream?.getVideoTracks()[0];
    if(!this.status.active||!track||this.settings.demo)throw Error('Inicie uma câmera real para ajustar o zoom.');
    const changed=await applyCameraZoom(track,value);
    if(track===this.stream?.getVideoTracks()[0]){this.zoom=changed;this.onChange();}
  }
  onChange=()=>{};onClip=(_c:LocalClip)=>{};onError=(_s:string)=>{};
  time(){return Math.max(0,(performance.now()-this.startMono)/1000);}
  async start(settings:CaptureSettings){
    if(this.status.active||this.stopping||this.persisting)throw Error('Aguarde finalizar a gravação anterior.');
    if(!window.isSecureContext)throw Error('Abra Pitch VAR por HTTPS. O navegador só permite câmera em contexto seguro.');
    if(!window.MediaRecorder)throw Error('Este navegador não oferece gravação de vídeo. Use Safari atualizado no iPhone ou Chrome atualizado no Android.');
    const stored=await listClips();this.reservedBytes=stored.reduce((n,c)=>n+c.bytes,0);
    if(this.reservedBytes>=GALLERY_LIMIT)throw Error('Galeria cheia. Exporte e exclua lances antes de gravar.');
    const size=settings.quality==='economy'?{width:854,height:480,fps:20,bitrate:900000}:{width:1280,height:720,fps:24,bitrate:1500000};
    if(settings.demo){
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext('2d')!;const began=performance.now();
      const draw=()=>{const t=(performance.now()-began)/1000;ctx.fillStyle='#0a0f18';ctx.fillRect(0,0,640,360);ctx.strokeStyle='#c8ff00';ctx.lineWidth=3;ctx.strokeRect(25,70,590,260);ctx.beginPath();ctx.arc(320,200,60,0,2*Math.PI);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 28px monospace';ctx.fillText(`Pitch VAR  ${t.toFixed(2)}s`,25,45);ctx.fillStyle='#c8ff00';ctx.beginPath();ctx.arc(50+(t*60)%540,220,15,0,Math.PI*2);ctx.fill();};
      draw();const timer=setInterval(draw,1000/20);this.cleanupDemo=()=>clearInterval(timer);this.stream=canvas.captureStream(20);
    }else{
      if(!navigator.mediaDevices?.getUserMedia)throw Error('Câmera indisponível. Verifique HTTPS e permissões.');
      this.stream=await navigator.mediaDevices.getUserMedia({video:{...(settings.cameraId?{deviceId:{exact:settings.cameraId}}:{facingMode:{ideal:'environment'}}),width:{ideal:size.width},height:{ideal:size.height},frameRate:{ideal:size.fps,max:size.fps}},audio:settings.audio});
    }
    const cameraTrack=this.stream.getVideoTracks()[0];
    this.cameraId=cameraTrack.getSettings().deviceId??'';this.zoom=undefined;
    if(!settings.demo){
      try{this.zoom=cameraZoom(cameraTrack);}catch{/* Recursos opcionais não impedem gravar. */}
      try{this.cameras=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'&&d.deviceId).map((d,i)=>({id:d.deviceId,label:d.label||`Câmera ${i+1}`}));}catch{this.cameras=[];}
    }
    this.settings=settings;this.parts=[];this.pending=[];this.stopping=false;this.startMono=performance.now();this.generation++;
    this.status={active:true,history:0,bufferMB:0,elapsed:0,pending:0,mime:'',gaps:0};
    for(const track of this.stream.getTracks()) {
      track.onended=()=>{void this.stop('A câmera foi interrompida. Inicie novamente para continuar.');};
      track.onmute=()=>{if(track.kind==='video')void this.stop('O sistema suspendeu a câmera. A gravação foi encerrada.');};
    }
    try{this.nextSegment(size.bitrate);}catch(e){await this.stop();throw e;}
    this.ticker=setInterval(()=>{this.update();},1000);
    await this.acquireWake();this.update();
  }
  async acquireWake(){
    if(!this.status.active||document.hidden||!navigator.wakeLock)return;
    try{this.wake=await navigator.wakeLock.request('screen');}catch{/* A interface informa quando não há bloqueio da suspensão. */}
  }
  private nextSegment(bitrate:number){
    if(!this.status.active||!this.stream)return;
    const start=this.time();const previous=this.parts.at(-1);
    if(previous&&start-previous.end>0.25)this.status.gaps++;
    // Cada gravação é finalizada para produzir arquivo independente. Nunca concatenar timeslices cegamente.
    const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
    const options:MediaRecorderOptions={videoBitsPerSecond:bitrate,...(mime?{mimeType:mime}:{})};
    const r=new MediaRecorder(this.stream,options);this.recorder=r;this.status.mime=r.mimeType;
    const pieces:Blob[]=[];let end=start;
    this.finishing=new Promise<void>(resolve=>{
      r.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};
      r.onerror=()=>{void this.stop('Falha do navegador ao gravar. Os lances já salvos permanecem na galeria.');};
      r.onstop=()=>{
        clearTimeout(this.rotate);end=this.time();
        const blob=new Blob(pieces,{type:r.mimeType});
        if(blob.size>0)this.parts.push({id:cryptoId(),start,end,blob});
        if(this.status.active){try{this.nextSegment(bitrate);}catch{void this.stop('Não foi possível continuar a câmera.');}}
        void this.collect(!this.status.active).finally(resolve);
      };
    });
    r.start();this.rotate=setTimeout(()=>{if(r.state!=='inactive')r.stop();},5000);
  }
  /** Gancho preparado, ainda sem chamador de rede. O adaptador autenticado futuro entrega o plano. */
  commandMatchday(plan:Extract<ReplayPlan,{status:'ready'}>){
    const now=this.time(),earliest=this.parts[0]?.start??0;
    if(!Number.isFinite(plan.at)||plan.at<earliest||plan.at>now||plan.start>=plan.end)throw Error('O gol não está no histórico disponível deste aparelho.');
    return this.command('matchday',plan);
  }
  command(source:LocalClip['source']='button',remote?:Extract<ReplayPlan,{status:'ready'}>){
    if(!this.status.active||this.stopping)throw Error('Inicie a câmera antes de salvar um lance.');
    if(this.pending.length>=3)throw Error('Há três lances aguardando. Aguarde alguns segundos.');
    const at=remote?.at??this.time(),earliest=this.parts[0]?.start??0;
    const clip:LocalClip={id:cryptoId(),createdAt:new Date().toISOString(),at,...clipWindow(at,this.settings.pre,this.settings.post,earliest),parts:[],bytes:0,interrupted:false,state:'collecting',source};
    if(remote)clip.association=remote.association;
    this.pending.push(clip);this.onClip(clip);this.update();return clip;
  }
  private async collect(final=false){
    const end=this.parts.at(-1)?.end??0;
    for(const clip of [...this.pending]){
      if(!final&&end<clip.end)continue;
      this.pending=this.pending.filter(c=>c.id!==clip.id);
      if(final&&clip.end>end){clip.end=end;clip.shortened=true;clip.interrupted=!!this.status.error;}
      clip.parts=this.parts.filter(p=>overlaps(p,clip));clip.bytes=clip.parts.reduce((n,p)=>n+p.blob.size,0);
      this.persisting++;
      try{
        if(!clip.parts.length||clip.end<=clip.start)throw Error('Sem vídeo suficiente para este lance.');
        // Reservar cota antes da primeira espera, evitando múltiplos saves simultâneos acima do teto.
        if(this.reservedBytes+clip.bytes>GALLERY_LIMIT)throw Error('Galeria cheia. Exporte e exclua lances.');
        this.reservedBytes+=clip.bytes;clip.state='saved';await putClip(clip);this.onClip({...clip,parts:[]});
      }catch(e){this.reservedBytes-=clip.state==='saved'?clip.bytes:0;clip.state='failed';clip.error=(e as Error).message;clip.parts=[];this.onClip({...clip});this.onError(clip.error);}
      finally{this.persisting--;}
    }
    this.update();
  }
  update(){
    const now=this.time();const ring=retained(this.parts,this.pending,now);
    this.parts=ring.parts;this.status={...this.status,elapsed:now,history:this.parts.length?now-this.parts[0].start:now,bufferMB:ring.bytes/1024**2,pending:this.pending.length};
    if(ring.overflow&&this.status.active){void this.stop('O histórico protegido atingiu 24 MB. Gravação encerrada para limitar memória.');}
    this.onChange();
  }
  async stop(error?:string){
    if(this.stopping)return;
    this.stopping=true;this.status.active=false;if(error){this.status.error=error;this.onError(error);}
    clearTimeout(this.rotate);clearInterval(this.ticker);
    if(this.recorder&&this.recorder.state!=='inactive'){this.recorder.stop();await this.finishing;}
    else await this.collect(true);
    for(const t of this.stream?.getTracks()??[]){t.onended=null;t.onmute=null;t.stop();}
    this.cleanupDemo?.();this.stream=undefined;this.zoom=undefined;await this.wake?.release().catch(()=>{});this.wake=undefined;
    this.parts=[];this.stopping=false;this.status.history=0;this.status.bufferMB=0;this.onChange();
  }
}
export function cryptoId(){const b=new Uint8Array(16);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
