// Local preview only. Connected leagues always use the existing seq-checked RPCs.
export function demoLiveTransition(state,matchId,action){
 const match=state.matches.find(m=>m.id===matchId);if(!match)throw Error('match_not_found');
 if(action==='start'&&match.state!=='scheduled')throw Error('invalid_state');
 if(action==='end'&&match.state!=='live')throw Error('invalid_state');
 if(!['start','end'].includes(action))throw Error('invalid_action');
 return {...state,matches:state.matches.map(m=>m.id!==matchId?m:action==='start'?{...m,state:'live',homeScore:0,awayScore:0,startedAt:new Date().toISOString(),liveEvents:[]}:{...m,state:'ended_provisional',endedAt:new Date().toISOString()})};
}
export function demoLiveEvent(state,matchId,event){
 const m=state.matches.find(m=>m.id===matchId);if(!m||m.state!=='live')throw Error('not_live');
 if(!event.id||!['goal','yellow','red'].includes(event.type)||![m.homeId,m.awayId].includes(event.teamId))throw Error('invalid_event');
 if((m.liveEvents||[]).some(e=>e.id===event.id))return state;
 if(event.minute!==null&&(!Number.isInteger(event.minute)||event.minute<0||event.minute>180))throw Error('invalid_minute');
 const player=state.teams.find(t=>t.team.id===event.teamId)?.squad.find(p=>p.playerId===event.playerId);if(!player)throw Error('invalid_player');
 const next={...m,liveEvents:[...(m.liveEvents||[]),{...event,playerName:player.name}]};
 if(event.type==='goal'){const key=event.teamId===m.homeId?'homeScore':'awayScore';next[key]=(next[key]||0)+1}
 return {...state,matches:state.matches.map(x=>x.id===matchId?next:x)};
}
