import readline from 'node:readline';
import {connection} from './ai-team-connection.mjs';
const agent=process.argv[process.argv.indexOf('--agent')+1];
if(!['ney','leo','cris'].includes(agent))throw Error('Persona do mural inválida.');
const tools=[
 {name:'pitch_inbox',description:`Consultar os pedidos e mensagens para ${agent} no mural privado do Pitch.`,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'pitch_board',description:'Consultar os 500 registos mais recentes, incluindo respostas por parent_id.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'pitch_publish',description:`Publicar mensagem, pedido ou entrega como ${agent}. Usar parent_id do assunto principal para responder.`,inputSchema:{type:'object',properties:{kind:{type:'string',enum:['message','request','delivery']},recipient:{type:'string',enum:['all','vinicius','ney','leo','cris']},title:{type:'string',maxLength:160},body:{type:'string',maxLength:12000},parent_id:{type:['string','null']}},required:['kind','recipient','title','body'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false}},
 {name:'pitch_request_status',description:'Atualizar o estado de um pedido do qual és autor ou destinatário.',inputSchema:{type:'object',properties:{id:{type:'string'},status:{type:'string',enum:['pending','in_progress','done','blocked']}},required:['id','status'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false}}
];
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');
const failure=(id,code,message)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');
const lines=readline.createInterface({input:process.stdin});
for await(const line of lines){
 let msg;try{msg=JSON.parse(line);}catch{failure(null,-32700,'Invalid JSON');continue;}
 if(msg.id===undefined)continue;
 if(msg.method==='initialize'){reply(msg.id,{protocolVersion:msg.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:`pitch-${agent}`,version:'1.0.0'},instructions:`Usa estas ferramentas apenas na persona ${agent}. Não publiques como outra pessoa. O mural não inicia outras conversas automaticamente.`});continue;}
 if(msg.method==='ping'){reply(msg.id,{});continue;}
 if(msg.method==='tools/list'){reply(msg.id,{tools});continue;}
 if(msg.method!=='tools/call'){failure(msg.id,-32601,'Method not found');continue;}
 try{
  const name=msg.params?.name,args=msg.params?.arguments||{};
  if(!tools.some(t=>t.name===name))throw Error('Ferramenta desconhecida.');
  const request=await connection(agent);
  const data=await request(name==='pitch_publish'?'POST':name==='pitch_request_status'?'PATCH':'GET',name==='pitch_publish'||name==='pitch_request_status'?args:undefined,name==='pitch_inbox');
  reply(msg.id,{content:[{type:'text',text:JSON.stringify(data)}]});
 }catch(e){reply(msg.id,{isError:true,content:[{type:'text',text:e.message}]});}
}
