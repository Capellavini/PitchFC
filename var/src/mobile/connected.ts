import {createClient,type SupabaseClient,type RealtimeChannel,type User} from '@supabase/supabase-js';
import {planGoalReplay,type ReplayAssociation,type GoalReplayRequest} from './matchday-var';
import type {PhoneRecorder} from './recorder';
import type {LocalClip} from './model';
import {listClips,loadClip,putClip,deleteClip} from './storage';
import {exportMP4} from './export';
import {PUBLIC_VAR} from './paths';
export interface AvailableGame{id:string;groupId:string;groupName:string;venue:string;scheduledAt:string;playerId:string;matches:{id:number|string;n:number;concluded?:boolean;isBye?:boolean}[]}
export interface CloudClip{id:string;path:string;expiresAt:string;occurredAt:string;goalId:string;groupName:string;ownGoal:boolean;bytes:number}
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const varClient=!PUBLIC_VAR&&url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}}):undefined;
export async function varRPC<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
 if(!varClient)throw Error('Conexão Pitch indisponível.');
 const {data,error}=await varClient.rpc('pitch_var',{action,payload});if(error)throw Error(error.message);return data as T;
}
export class ConnectedVar{
 user?:User;games:AvailableGame[]=[];cloud:CloudClip[]=[];sessionId?:string;game?:AvailableGame;matchId='';
 offset=0;startServerMs=0;uncertainty=Infinity;deviceId='';uploading=false;uploadProgress='';warning='';
 private channel?:RealtimeChannel;private timer?:ReturnType<typeof setInterval>;private busy=false;private rerun=false;private known=new Set<string>();private stopping?:Promise<void>;
 onChange=()=>{};onError=(_s:string)=>{};onRefresh=()=>{};onRemoteStop=()=>{};
 private unsubscribe?:()=>void;
 async initialize(){
  if(PUBLIC_VAR)return;
  this.deviceId=localStorage.getItem('pitch-var-device')||crypto.randomUUID();localStorage.setItem('pitch-var-device',this.deviceId);
  if(!varClient)return;
  this.user=(await varClient.auth.getSession()).data.session?.user;
  const sub=varClient.auth.onAuthStateChange((_e,s)=>{const changed=this.user?.id!==s?.user.id;this.user=s?.user;this.onChange();if(changed)setTimeout(()=>{void this.stop();this.onRemoteStop();void this.refresh().catch(e=>this.onError(e.message));},0);});this.unsubscribe=()=>sub.data.subscription.unsubscribe();
  await this.refresh();
 }
 async refresh(){
  if(!this.user){this.games=[];this.cloud=[];this.onChange();return;}
  [this.games,this.cloud]=await Promise.all([varRPC<AvailableGame[]>('games'),varRPC<CloudClip[]>('my_clips')]);this.onChange();
 }
 async clock(){
  const began=performance.now(),wall=Date.now();const r=await varRPC<{serverMs:number}>('clock');const roundTrip=performance.now()-began;
  this.offset=r.serverMs-(wall+roundTrip/2);this.uncertainty=roundTrip/2;
  if(this.uncertainty>1500)throw Error('Conexão lenta para sincronizar o VAR. Tente novamente antes de gravar.');
 }
 async begin(engine:PhoneRecorder,game:AvailableGame,matchId:string){
  await this.stop();this.game=game;this.matchId=matchId;this.known=new Set((await listClips()).filter(c=>c.state==='saved'&&c.association).map(c=>`${c.association!.sessionId}:${c.association!.goalId}`));
  const startServerMs=Date.now()+this.offset-engine.time()*1000;
  this.startServerMs=startServerMs;
  const r=await varRPC<{sessionId:string}>('join',{gameId:game.id,matchId,deviceId:this.deviceId,startServerMs,uncertaintyMs:this.uncertainty});this.sessionId=r.sessionId;
  const sid=r.sessionId;
  this.channel=varClient!.channel(`var-device-${sid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'var_requests',filter:`session_id=eq.${sid}`},()=>{void this.process(engine,false);}).subscribe();
  this.timer=setInterval(()=>{void this.process(engine,true);},15000);
  await this.process(engine,true);this.onChange();
 }
 private async process(engine:PhoneRecorder,beat:boolean){
  if(this.busy){this.rerun=true;return;}
  if(!this.sessionId||!this.game)return;
  if(!engine.status.active){await this.stop();return;}
  // Camera/encoder health, rather than presence of an open browser tab.
  const track=engine.stream?.getVideoTracks()[0];
  if(!track||track.readyState!=='live'||track.muted||(engine.time()>12&&(engine.parts.at(-1)?.end??0)<engine.time()-12)){this.onError('A câmera deixou de produzir vídeo. Reinicie a gravação.');await this.stop();this.onRemoteStop();return;}
  this.busy=true;const sid=this.sessionId;
  try{
   const response=await varRPC<{active:boolean;requests:{requestId:string;state:string;goal:GoalReplayRequest}[]}>(beat?'beat':'poll',{sessionId:sid});
   if(sid!==this.sessionId)return;
   if(!response.active){await this.stop();this.onRemoteStop();return;}
   this.warning='';
   for(const item of response.requests){
    const c=this.game;const plan=planGoalReplay(item.goal,{enabled:true,armed:true,active:engine.status.active,groupId:c.groupId,gameId:c.id,matchId:this.matchId,sessionId:sid,deviceId:this.deviceId,startServerMs:this.startServerMs,clockUncertaintyMs:this.uncertainty,elapsedSeconds:engine.time(),earliestSeconds:engine.parts[0]?.start??0,preSeconds:engine.settings.pre,postSeconds:engine.settings.post},this.known);
    if(plan.status==='duplicate')continue;
    if(plan.status!=='ready'){await this.receipt(item.requestId,'expired',undefined,plan.status);continue;}
    plan.association.requestId=item.requestId;plan.association.operatorPlayerId=c.playerId;plan.association.uploaderUserId=this.user!.id;
    try{const clip=engine.commandMatchday(plan);this.known.add(plan.key);await this.receipt(item.requestId,'collecting',clip.id);}catch(e){await this.receipt(item.requestId,'failed',undefined,(e as Error).message);}
   }
  }catch(e){this.warning='Sem comunicação com o Pitch. A câmera continua local; novos gols podem ficar sem replay.';this.onChange();}
  finally{this.busy=false;if(this.rerun){this.rerun=false;void this.process(engine,false);}}
 }
 private async receipt(requestId:string,state:string,clipId?:string,reason?:string){try{await varRPC('receipt',{requestId,state,clipId,reason});}catch{/* Saved metadata on the device retries when the upload queue resumes. */}}
 async clipChanged(clip:LocalClip){
  if(!clip.association?.requestId)return;
  if(clip.state==='saved')await this.receipt(clip.association.requestId,'saved_local',clip.id);
  if(clip.state==='failed')await this.receipt(clip.association.requestId,'failed',clip.id,clip.error);
 }
 async stop(){
  if(this.stopping)return this.stopping;
  clearInterval(this.timer);this.timer=undefined;
  if(this.channel){void varClient?.removeChannel(this.channel);this.channel=undefined;}
  const sid=this.sessionId;this.sessionId=undefined;this.onChange();
  if(!sid)return;
  this.stopping=varRPC('stop',{sessionId:sid}).then(()=>{}).catch(()=>{}).finally(()=>{this.stopping=undefined;});return this.stopping;
 }
 async uploadQueue(){
  if(!varClient||!this.user||this.uploading)return;
  this.uploading=true;this.onChange();
  try{
   const pending=(await listClips()).filter(c=>c.state==='saved'&&c.association?.requestId&&c.association.uploaderUserId===this.user!.id&&!c.cloudUploaded&&!c.cloudExpired);
   if(!pending.length)return;
   for(let i=0;i<pending.length;i++){
    const c=pending[i];const a=c.association!;
    try{
    this.uploadProgress=`Enviando lance ${i+1} de ${pending.length}`;this.onChange();
    await varRPC('receipt',{requestId:a.requestId,state:'saved_local',clipId:c.id});
    const reserved=await varRPC<{id:string;path:string;state:string;scorerPlayerId:string;operatorPlayerId:string}>('reserve',{requestId:a.requestId});
    if(reserved.state!=='available'){
     const full=await loadClip(c.id);const blob=await exportMP4(full,n=>{this.uploadProgress=`Lance ${i+1}/${pending.length} · preparando ${n}%`;this.onChange();});
     const {error}=await varClient.storage.from('pitch-var').upload(reserved.path,blob,{contentType:'video/mp4',cacheControl:'0',upsert:false});
     if(error&&!/already exists|duplicate|409/i.test(error.message))throw Error(error.message);
     await varRPC('uploaded',{requestId:a.requestId});
    }
    if(reserved.scorerPlayerId!==reserved.operatorPlayerId)await deleteClip(c.id);
    else{const full=await loadClip(c.id);full.cloudUploaded=true;await putClip(full);}
    this.onRefresh();
    }catch(e){
     if(/prazo encerrado|Lance indisponível/.test((e as Error).message)){
      if(a.scorerPlayerId!==a.operatorPlayerId)await deleteClip(c.id);
      else{const full=await loadClip(c.id);full.cloudExpired=true;await putClip(full);}
      this.onRefresh();continue;
     }
     throw e;
    }
   }
   this.uploadProgress='Lances enviados. Os gols estão disponíveis aos autores na app.';await this.refresh();
  }catch(e){this.uploadProgress='Envio pendente. Mantenha a página aberta e tente novamente.';this.onError((e as Error).message);}
  finally{this.uploading=false;this.onChange();}
 }
 async download(c:CloudClip){
  if(Date.parse(c.expiresAt)<=Date.now()+this.offset)throw Error('Prazo de acesso encerrado.');
  const {data,error}=await varClient!.storage.from('pitch-var').download(c.path);if(error)throw Error(error.message);return data!;
 }
 dispose(){this.unsubscribe?.();void this.stop();}
}
