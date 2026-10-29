// Derived views only. Official writes continue through the existing league RPCs.
export const OPERATIONS_TABS = [
  ['overview','Visão geral'],['matchday','Fechar jornada'],['calendar','Calendário'],
  ['standings','Classificação'],['teams','Clubes e atletas'],['discipline','Disciplina'],
  ['copilot','Adjunto'],['communications','Comunicação'],['public','Página da Liga'],['setup','Implantação'],
  ['live','Matchday ao vivo'],['compare','Comparar'],['operations','Operação'],
];
export const isOfficial = m => m.state === 'homologated' || m.resultStatus === 'homologated';
export const needsReview = m => ['ended_provisional','in_review','abandoned'].includes(m.state);
const time = m => Date.parse(m.kickoff || '') || 0;
export function operationSummary(matches=[],teams=[]) {
  return {matches:matches.length,official:matches.filter(isOfficial).length,pending:matches.filter(needsReview).length,
    unscheduled:matches.filter(m=>!m.kickoff&&!['cancelled','homologated'].includes(m.state)).length,
    live:matches.filter(m=>m.state==='live').length,teams:teams.length,
    players:new Set(teams.flatMap(t=>(t.squad||[]).map(p=>p.playerId))).size};
}
export function scheduleConflicts(matches=[], duration=60, rest=30) {
  const active=matches.filter(m=>time(m)&&!['cancelled','postponed'].includes(m.state));
  const found=[];
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j],delta=Math.abs(time(a)-time(b))/60000;
    const shared=[a.homeId,a.awayId].filter(Boolean).some(id=>[b.homeId,b.awayId].includes(id));
    const sameVenue=a.venue&&b.venue&&a.venue.trim().toLowerCase()===b.venue.trim().toLowerCase();
    if(delta<duration&&sameVenue)found.push({kind:'venue',ids:[a.id,b.id],text:`Sobreposição em ${a.venue}`});
    if(shared&&delta<duration+rest)found.push({kind:'rest',ids:[a.id,b.id],text:`Equipa com menos de ${rest} min de descanso`});
    const official=(a.officials||[]).some(x=>x.playerId&&(b.officials||[]).some(y=>y.playerId===x.playerId));
    if(official&&delta<duration)found.push({kind:'referee',ids:[a.id,b.id],text:'Árbitro em jogos simultâneos'});
  }
  return found;
}
export function matchLabel(m) { return `${m.home?.name||'Por definir'} × ${m.away?.name||'Por definir'}`; }
export function roundRecap(matches=[],competition='Liga') {
  const rows=matches.filter(isOfficial);
  if(!rows.length)return `${competition}\nAinda não há resultados homologados nesta seleção.`;
  return `${competition} · Resumo da jornada\n\n${rows.map(m=>`${m.home?.name||'—'} ${m.homeScore??'—'}–${m.awayScore??'—'} ${m.away?.name||'—'}`).join('\n')}\n\n${rows.length} resultado(s) homologado(s). Consulte a página da Liga para calendário e classificação.`;
}
export function copilotInsights(matches=[], teams=[]) {
  const s=operationSummary(matches,teams),conflicts=scheduleConflicts(matches);
  return [
    s.pending&&{title:`${s.pending} ${s.pending===1?'ficha':'fichas'} por validar`,text:'Confere resultado, atletas utilizados e ocorrências antes da homologação.',tab:'matchday',tone:'warning'},
    s.unscheduled&&{title:`${s.unscheduled} jogos sem horário`,text:'Define data e local e verifica sobreposições antes de guardar.',tab:'calendar',tone:'warning'},
    conflicts.length&&{title:`${conflicts.length} ${conflicts.length===1?'alerta':'alertas'} no calendário`,text:'Existem possíveis conflitos de campo, descanso ou arbitragem.',tab:'calendar',tone:'warning'},
    {title:'A informação oficial tem uma origem',text:`${s.official} de ${s.matches} jogos homologados. Os restantes não entram no resumo oficial.`,tab:'matchday',tone:'ok'},
    {title:'Estatísticas com contexto',text:'Uma ficha comprova convocatória; não comprova minutos em campo. Correlações e sugestões exigem histórico de participação.',tab:'teams',tone:'neutral'},
  ].filter(Boolean);
}
// Formula injection protection for spreadsheet exports, including after whitespace.
export function csvCell(value) {const s=String(value??'');return `"${(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')}"`;}
export function calendarCsv(matches=[]) {return '\uFEFF'+[['Jornada','Casa','Fora','Início (ISO)','Fuso','Local','Estado','Golos casa','Golos fora'],...matches.map(m=>[m.roundName||m.round,m.home?.name,m.away?.name,m.kickoff,m.timezone||'Europe/Lisbon',m.venue,m.state,m.homeScore,m.awayScore])].map(r=>r.map(csvCell).join(';')).join('\r\n');}
export function rosterCsv(teams=[]) {return '\uFEFF'+[['Clube','Atleta','Número','Posição'],...teams.flatMap(t=>(t.squad||[]).map(p=>[t.team.name,p.name,p.shirtNumber,p.position]))].map(r=>r.map(csvCell).join(';')).join('\r\n');}
export function downloadText(name,text,type='text/plain;charset=utf-8') {const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export const matchDate=(m)=> m.kickoff?new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:m.timezone||'Europe/Lisbon'}).format(new Date(m.kickoff)):'Por agendar';
export function parseSheetText(text) {
  if(typeof text!=='string'||text.length>16000)throw new Error('Usa até 16.000 caracteres.');
  const score=text.match(/(?:resultado|placar)\s*:?\s*(\d{1,2})\s*[-–x×:]\s*(\d{1,2})/i);
  return {homeScore:score?Number(score[1]):null,awayScore:score?Number(score[2]):null,
    observations:text.trim(),warnings:['Transcrição manual: confirmar identidade das equipas, jogadores e ocorrências.'],source:'manual'};
}
export function reviewSheet(draft, match) {
  const problems=[];
  for(const key of ['homeScore','awayScore'])if(!Number.isInteger(draft?.[key])||draft[key]<0||draft[key]>99)problems.push('Confirma os dois valores do resultado (0–99).');
  if(!match?.id)problems.push('Seleciona o jogo a que pertence a ficha.');
  if(!draft?.checked)problems.push('Confirma a conferência da ficha original.');
  return [...new Set(problems)];
}
export function suggestLineup(players=[],availability={},blockedIds=[],size=7,stats=[]) {
  const eligible=players.filter(p=>availability[p.playerId]==='confirmed'&&!blockedIds.includes(p.playerId));
  const rank=p=>{const s=stats.find(s=>s.playerId===p.playerId);return s&&s.apps>=3?(s.goals+s.assists)/s.apps:0};
  const keeper=eligible.find(p=>/guarda|keeper|^gr$/i.test(p.position||''));
  const others=eligible.filter(p=>p!==keeper).sort((a,b)=>rank(b)-rank(a)||String(a.name).localeCompare(b.name));
  const selected=[...(keeper?[keeper]:[]),...others].slice(0,size);
  const warnings=[];
  if(selected.length<size)warnings.push(`Faltam ${size-selected.length} atletas confirmados e elegíveis.`);
  if(!keeper)warnings.push('Falta um guarda-redes confirmado.');
  return {selected,warnings,canSave:selected.length===size&&Boolean(keeper),basis:'Disponibilidade confirmada, posição e produção por ficha (mínimo 3 fichas). Sem avaliação de minutos ou causalidade.'};
}
