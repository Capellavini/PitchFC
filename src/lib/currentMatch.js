// Organizer's current fixture is shared; historical browsing stays local.
export function currentMatch(md){
 const playable=(md?.matches??[]).filter(m=>!m.concluded&&!m.isBye);
 const explicit=playable.find(m=>String(m.id)===String(md?.activeMatchId));
 return explicit??(['personalizado','campeonato'].includes(md?.mode)?playable[0]:playable.at(-1))??null;
}
export function concludeMatch(md,id,concluded){
 const next={...md,matches:md.matches.map(m=>String(m.id)===String(id)?{...m,concluded}:m)};
 return {...next,activeMatchId:currentMatch(next)?.id??null};
}
