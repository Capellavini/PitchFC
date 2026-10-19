import {readFile} from 'node:fs/promises';
const agents=['ney','leo','cris'];
export async function connection(agent){
 if(!agents.includes(agent))throw Error('Escolhe --agent ney, leo ou cris.');
 let local={};
 try{const raw=await readFile(new URL(`../.env.ai-team.${agent}.local`,import.meta.url),'utf8');for(const line of raw.split(/\r?\n/)){const m=/^([A-Z_]+)=(.*)$/.exec(line);if(m)local[m[1]]=m[2].trim();}}catch(e){if(e.code!=='ENOENT')throw e;}
 const token=local.AI_TEAM_TOKEN||process.env.AI_TEAM_TOKEN;
 const base=local.AI_TEAM_URL||process.env.AI_TEAM_URL||'https://pitch-fc.com';
 if(!token)throw Error(`Conexão ${agent} ainda não ativada. Falta a credencial privada; consulta docs/AI-TEAM.md.`);
 const endpoint=new URL('/api/ai-team',base);
 if(endpoint.protocol!=='https:'&&endpoint.hostname!=='localhost')throw Error('A conexão exige HTTPS.');
 return async function request(method='GET',body,inbox=false){
  const url=new URL(endpoint);if(inbox)url.searchParams.set('inbox','1');
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);return result;
 };
}
