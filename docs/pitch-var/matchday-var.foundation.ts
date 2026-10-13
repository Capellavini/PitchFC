/** Fundação offline/testável. Não conecta Supabase nem se ativa na interface atual.
 * A camada autenticada futura deve resolver os IDs e validar permissões no servidor.
 */
export const MATCHDAY_VAR_ENABLED = true;
export interface ReplayAssociation {
  groupId:string;gameId:string;matchId:string;goalId:string;scorerPlayerId:string;
  sessionId:string;deviceId:string;occurredAt:string;recordedAt:string;ownGoal:boolean;revision:number;
  requestId?:string;operatorPlayerId?:string;uploaderUserId?:string;
}
export interface GoalReplayRequest {
  version:1;groupId:string;gameId:string;matchId:string;goalId:string;scorerPlayerId:string;
  sessionId:string;occurredAt:string;recordedAt:string;ownGoal:boolean;revision:number;
}
export interface VarCaptureContext {
  enabled:boolean;armed:boolean;active:boolean;groupId:string;gameId:string;matchId:string;sessionId:string;deviceId:string;
  // Instante de início do vídeo no relógio sincronizado com servidor; nunca usar relógio do João cru.
  startServerMs:number;clockUncertaintyMs:number;elapsedSeconds:number;earliestSeconds:number;
  preSeconds:number;postSeconds:number;
}
export interface EligibleVarDevice {
  groupId:string;gameId:string;matchId:string;sessionId:string;deviceId:string;operatorPlayerId:string;
  armed:boolean;active:boolean;captureStartedServerMs:number;leaseExpiresServerMs:number;
}
/** Planejamento de destinatários. O servidor deve fornecer confirmação e sessões autorizadas;
 * essa função não substitui autenticação/RLS nem conecta os aparelhos.
 */
export function fanOutMatchdayGoal(goal:Omit<GoalReplayRequest,'sessionId'>,sessions:readonly EligibleVarDevice[],options:{enabled:boolean;nowServerMs:number;confirmedPlayerIds:ReadonlySet<string>}){
  if(!options.enabled||!Number.isFinite(options.nowServerMs))return [];
  const seen=new Set<string>();const targets:{deviceId:string;request:GoalReplayRequest}[]=[];
  for(const s of sessions){
    if(!s.armed||!s.active||s.groupId!==goal.groupId||s.gameId!==goal.gameId||s.matchId!==goal.matchId
      ||!options.confirmedPlayerIds.has(s.operatorPlayerId)||!uuid.test(s.deviceId)||!uuid.test(s.operatorPlayerId)
      ||!Number.isFinite(s.captureStartedServerMs)||Date.parse(goal.occurredAt)<s.captureStartedServerMs
      ||!Number.isFinite(s.leaseExpiresServerMs)||s.leaseExpiresServerMs<=options.nowServerMs||seen.has(s.sessionId))continue;
    const request:GoalReplayRequest={...goal,sessionId:s.sessionId};
    if(!validateGoalRequest(request))continue;
    if(Date.parse(request.occurredAt)>options.nowServerMs)continue;
    seen.add(s.sessionId);targets.push({deviceId:s.deviceId,request});
  }
  return targets;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateGoalRequest(value:unknown):value is GoalReplayRequest{
  if(!value||typeof value!=='object')return false;
  const r=value as GoalReplayRequest;
  return r.version===1&&['groupId','gameId','goalId','scorerPlayerId','sessionId'].every(k=>uuid.test(String(r[k as keyof GoalReplayRequest])))
    &&typeof r.matchId==='string'&&r.matchId.length>0&&r.matchId.length<=100
    &&typeof r.ownGoal==='boolean'&&Number.isInteger(r.revision)&&r.revision>=1
    &&['occurredAt','recordedAt'].every(k=>{const s=r[k as 'occurredAt'|'recordedAt'];return typeof s==='string'&&/^\d{4}-\d\d-\d\dT.*Z$/.test(s)&&Number.isFinite(Date.parse(s));});
}
export type ReplayPlan = {status:'ready';key:string;at:number;start:number;end:number;shortened:boolean;association:ReplayAssociation}
  |{status:'disabled'|'not_recording'|'invalid'|'wrong_session'|'clock_uncertain'|'expired'|'future'|'duplicate'};
export function planGoalReplay(value:unknown,c:VarCaptureContext,knownKeys:ReadonlySet<string>=new Set()):ReplayPlan{
  if(!c.enabled||!c.armed)return {status:'disabled'};
  if(!c.active)return {status:'not_recording'};
  if(!validateGoalRequest(value))return {status:'invalid'};
  const r=value;
  if(r.groupId!==c.groupId||r.gameId!==c.gameId||r.matchId!==c.matchId||r.sessionId!==c.sessionId)return {status:'wrong_session'};
  // A revisão muda a atribuição, não a identidade do vídeo; correções exigem fluxo separado.
  const key=`${r.sessionId}:${r.goalId}`;
  if(knownKeys.has(key))return {status:'duplicate'};
  if(![c.startServerMs,c.elapsedSeconds,c.earliestSeconds,c.clockUncertaintyMs,c.preSeconds,c.postSeconds].every(Number.isFinite)
    ||c.elapsedSeconds<0||c.earliestSeconds<0||c.earliestSeconds>c.elapsedSeconds||c.clockUncertaintyMs<0||c.clockUncertaintyMs>1500
    ||c.preSeconds<5||c.preSeconds>30||c.postSeconds<0||c.postSeconds>15)return {status:'clock_uncertain'};
  const at=(Date.parse(r.occurredAt)-c.startServerMs)/1000;
  if(at<0||at<c.earliestSeconds)return {status:'expired'};
  if(at>c.elapsedSeconds+c.clockUncertaintyMs/1000)return {status:'future'};
  const anchor=Math.min(at,c.elapsedSeconds),start=Math.max(c.earliestSeconds,anchor-c.preSeconds);
  return {status:'ready',key,at:anchor,start,end:anchor+c.postSeconds,shortened:start>anchor-c.preSeconds,
    association:{...r,deviceId:c.deviceId}};
}
/** Preparar o evento ANTES de inserir no Matchday. O mesmo ID deve sobreviver a retry/reconexão.
 * O adaptador real converte scorerId da UI em baseGroup.find(...).uuid (players.id).
 */
export function stampMatchdayGoal<T extends object>(event:T,id:string,recordedAt:string){
  if(!uuid.test(id)||!/^\d{4}-\d\d-\d\dT.*Z$/.test(recordedAt)||!Number.isFinite(Date.parse(recordedAt)))throw Error('Identidade/horário do gol inválidos.');
  return {...event,eventId:id,recordedAt};
}
