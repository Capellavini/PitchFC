import fs from 'node:fs/promises';import path from 'node:path';
import {emptyAfpceSheet,AFPCE_TEMPLATE,AFPCE_TECHNICAL_ROLES} from '../src/lib/afpceBoletim.js';
import {renderAfpceHtml} from '../src/lib/afpceBoletimPrint.js';
const output=path.resolve('../afpce-boletim-2026-10-27');await fs.mkdir(output,{recursive:true});
const d=emptyAfpceSheet();Object.assign(d,{season:'2026/27',clubName:'Clube Exemplo (TESTE)',competitionName:'Liga de Futebol 11 (TESTE)',gameNumber:'EXEMPLO-01',venue:'Campo Exemplo',date:'29/11/2026',time:'10:00',captainLicense:'TEST-0001',viceCaptainLicense:'TEST-0002',refereeObservations:'Campo reservado para transcricao fiel da ficha recebida. Este texto e apenas um exemplo ficticio.',delegateObservations:'Exemplo de preenchimento para conferencia. Sem assinatura ou validacao oficial.'});
const player=n=>({shirtNumber:n,name:`Atleta de Teste ${String(n).padStart(2,'0')}`,licenseNumber:`TEST-${String(n).padStart(4,'0')}`,marks:Object.fromEntries(AFPCE_TEMPLATE.columns.map(k=>[k,null]))});
d.starters=Array.from({length:11},(_,i)=>player(i+1));d.substitutes=Array.from({length:7},(_,i)=>player(i+12));d.technicalStaff=AFPCE_TECHNICAL_ROLES.map((role,i)=>({role,name:`Responsavel de teste ${i+1}`,licenseNumber:`TEST-T${i+1}`}));d.results.interval={left:1,right:0};d.results.final={left:2,right:1};d.source='example';
await fs.writeFile(path.join(output,'boletim-afpce-exemplo.html'),renderAfpceHtml(d,{demo:true}));await fs.writeFile(path.join(output,'boletim-afpce-exemplo.json'),JSON.stringify(d,null,2));console.log(output);
