let offset=0;
export async function syncVarClock(client){
 const started=performance.now(),wall=Date.now();const {data,error}=await client.rpc('pitch_var',{action:'clock',payload:{}});
 if(error)throw error;const rtt=performance.now()-started;if(rtt>3000)throw Error('Conexão lenta para sincronizar o horário do VAR.');
 offset=Number(data.serverMs)-(wall+rtt/2);
}
export const varTimestamp=()=>new Date(Date.now()+offset).toISOString();
export function stampVarGoal(event,players,id=globalThis.crypto.randomUUID(),now=varTimestamp()){
 const scorer=players.find(p=>p.id===event.scorerId);
 return {...event,eventId:id,scorerPlayerId:scorer?.uuid??null,occurredAt:event.occurredAt??now,recordedAt:now};
}
