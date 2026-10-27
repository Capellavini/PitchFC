// AFPCE participant bulletin: one club per sheet, NOT a two-team event timeline.
// Headings transcribed from the user's blank Mod. 9 screenshot. Legend unconfirmed.
export const AFPCE_TEMPLATE={id:'afpce_participants_f11_v1',name:'AFPCE · Boletim de participantes',modality:'F11',starters:11,substitutes:7,
 columns:['Am','A/V','Vm','Gl','SB'],legendConfirmed:false};
export const AFPCE_TECHNICAL_ROLES=['Treinador','Delegado ao jogo','Delegado / treinador adjunto','Massagista'];
const str=(v,n=150)=>typeof v==='string'?v.slice(0,n):'';
const score=v=>Number.isInteger(v)&&v>=0&&v<=99?v:null;
const mark=v=>typeof v==='string'?v.slice(0,30):null;
export function emptyAfpceSheet(){return {templateId:AFPCE_TEMPLATE.id,season:'',clubName:'',competitionName:'',gameNumber:'',venue:'',date:'',time:'',
 results:{interval:{left:null,right:null},final:{left:null,right:null},extraTime:{left:null,right:null},penalties:{left:null,right:null}},
 starters:[],substitutes:[],technicalStaff:[],captainLicense:'',viceCaptainLicense:'',refereeObservations:'',delegateObservations:'',
 authorizationPresence:{clubStamp:null,clubOfficialSignature:null,delegateAcknowledgment:null,refereeVisa:null},
 unreadableFields:[],warnings:[],source:'manual',official:false};}
export function sanitizeAfpceSheet(raw={}){
 const d=emptyAfpceSheet();
 for(const key of ['season','clubName','competitionName','gameNumber','venue','date','time','captainLicense','viceCaptainLicense'])d[key]=str(raw[key]);
 for(const key of Object.keys(d.results))d.results[key]={left:score(raw.results?.[key]?.left),right:score(raw.results?.[key]?.right)};
 const cleanRow=r=>({shirtNumber:Number.isInteger(r.shirtNumber)&&r.shirtNumber>=0&&r.shirtNumber<=999?r.shirtNumber:null,name:str(r.name),licenseNumber:str(r.licenseNumber,50),marks:Object.fromEntries(AFPCE_TEMPLATE.columns.map(k=>[k,mark(r.marks?.[k])]))});
 // Preserve all rows within a hard bound; overflow is flagged, never silently truncated to paper capacity.
 for(const key of ['starters','substitutes'])d[key]=(Array.isArray(raw[key])?raw[key]:[]).filter(r=>r&&typeof r==='object').slice(0,60).map(cleanRow);
 d.technicalStaff=(Array.isArray(raw.technicalStaff)?raw.technicalStaff:[]).filter(r=>r&&typeof r==='object').slice(0,20).map(r=>({role:str(r.role,80),name:str(r.name),licenseNumber:str(r.licenseNumber,50)}));
 d.refereeObservations=str(raw.refereeObservations,4000);d.delegateObservations=str(raw.delegateObservations,4000);
 for(const key of Object.keys(d.authorizationPresence))d.authorizationPresence[key]=typeof raw.authorizationPresence?.[key]==='boolean'?raw.authorizationPresence[key]:null;
 d.unreadableFields=(Array.isArray(raw.unreadableFields)?raw.unreadableFields:[]).slice(0,100).map(v=>str(v,150));
 d.warnings=(Array.isArray(raw.warnings)?raw.warnings:[]).slice(0,30).map(v=>str(v,350));
 d.warnings.push('Legenda Am / A/V / Vm / Gl / SB por confirmar. Preservar marcas; não criar lances ou sanções automaticamente.');
 if(d.starters.length>11||d.substitutes.length>7)d.warnings.push('Há mais linhas do que o modelo comporta. Conferir o documento antes de imprimir.');
 return d;
}
export function prefillAfpceSheet({league,competition,match,team,selection=[]}){
 const d=emptyAfpceSheet();d.season=competition.season||'';d.clubName=team?.team?.name||'';d.competitionName=competition.name||'';
 d.gameNumber=match?.gameNumber||'';d.venue=match?.venue||'';
 if(match?.kickoff){const f=new Intl.DateTimeFormat('en-GB',{timeZone:match.timezone||'Europe/Lisbon',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(match.kickoff));const p=Object.fromEntries(f.map(x=>[x.type,x.value]));d.date=`${p.day}/${p.month}/${p.year}`;d.time=`${p.hour}:${p.minute}`;}
 const squad=team?.squad||[];
 for(const entry of selection){const p=squad.find(p=>p.playerId===entry.playerId);if(!p||!['starter','substitute'].includes(entry.role))continue;
   d[entry.role==='starter'?'starters':'substitutes'].push({shirtNumber:p.shirtNumber??null,name:p.name||'',licenseNumber:p.licenseNumber||'',marks:Object.fromEntries(AFPCE_TEMPLATE.columns.map(k=>[k,null]))});}
 // Do not turn a roster into participation, UUIDs into licenses, or a score into an oriented pair.
 if(competition.format!=='F11')d.warnings.push('Este boletim identifica Futebol 11 Sénior. Confirmar o modelo correto para a modalidade/categoria selecionada.');
 if(!d.gameNumber)d.warnings.push('Número oficial do jogo por preencher. O identificador interno não é uma licença nem um número oficial.');
 if([...d.starters,...d.substitutes].some(p=>!p.licenseNumber))d.warnings.push('Existem licenças por preencher. Não foram inferidas a partir dos identificadores PITCH.');
 return d;
}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
export function reconcileAfpceRows(sheet,team){return [...sheet.starters,...sheet.substitutes].map((row,index)=>{
 const squad=team?.squad||[],license=normalize(row.licenseNumber),name=normalize(row.name);
 const candidates=license?squad.filter(p=>normalize(p.licenseNumber)===license):name?squad.filter(p=>normalize(p.name)===name):[];
 const mismatch=license&&candidates.length===1&&name&&normalize(candidates[0].name)!==name;
 return {index,name:row.name,licenseNumber:row.licenseNumber,candidates:candidates.map(p=>({playerId:p.playerId,name:p.name})),status:mismatch?'conflict':candidates.length===1?'candidate':candidates.length>1?'ambiguous':'unresolved'};
});}
export function afpceIssues(sheet){
 const issues=[];if(!sheet.clubName.trim())issues.push('Indica o clube.');
 if(sheet.starters.length>11)issues.push('O modelo tem 11 linhas para efetivos.');if(sheet.substitutes.length>7)issues.push('O modelo tem 7 linhas para suplentes.');
 const all=[...sheet.starters,...sheet.substitutes];const licenses=all.map(p=>normalize(p.licenseNumber)).filter(Boolean);
 if(new Set(licenses).size!==licenses.length)issues.push('A mesma licença aparece mais de uma vez.');
 for(const row of all)if(!row.name.trim())issues.push('Há um participante sem nome.');
 for(const key of ['captainLicense','viceCaptainLicense'])if(sheet[key]&&!licenses.includes(normalize(sheet[key])))issues.push('A licença de capitão/subcapitão não consta da lista.');
 if(sheet.captainLicense&&sheet.captainLicense===sheet.viceCaptainLicense)issues.push('Capitão e subcapitão devem ser pessoas distintas.');
 for(const pair of Object.values(sheet.results||{}))for(const value of [pair.left,pair.right])if(value!==null&&(!Number.isInteger(value)||value<0||value>99))issues.push('Confirma os resultados: números inteiros entre 0 e 99 ou campos vazios.');
 for(const row of all)if(row.shirtNumber!==null&&(!Number.isInteger(row.shirtNumber)||row.shirtNumber<0||row.shirtNumber>999))issues.push('Confirma os números das camisolas.');
 return [...new Set(issues)];
}
