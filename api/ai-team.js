import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { validateEntry, STATUSES } from '../src/lib/aiTeam.js';
function same(a,b){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function identifyAgent(header,env=process.env){
 if(!/^Bearer \S+$/.test(String(header||'')))return undefined;
 const token=String(header||'').replace(/^Bearer /,'');
 return ['ney','leo','cris'].find(id=>same(token,env[`AI_TEAM_TOKEN_${id.toUpperCase()}`]));
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Método não suportado.'});}
 if(req.method==='GET'&&req.query?.connection==='1'){
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key)return res.status(503).json({error:'Ligação ainda não configurada.'});
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!token)return res.status(401).json({error:'Inicia sessão.'});
  try{
   const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.auth.getUser(token);
   const admins=(process.env.VITE_ADMIN_EMAILS||'capella.vinicius@gmail.com').toLowerCase().split(',').map(s=>s.trim());
   if(error||!data.user||!admins.includes(data.user.email?.toLowerCase()))return res.status(403).json({error:'Acesso restrito ao administrador.'});
   return res.status(200).json({agents:['ney','leo','cris'].map(id=>({id,configured:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env['AI_TEAM_TOKEN_'+id.toUpperCase()])}))});
  }catch{return res.status(503).json({error:'Não foi possível verificar as ligações.'});}
 }
 const author=identifyAgent(req.headers.authorization);
 if(!author)return res.status(401).json({error:'Credencial do agente inválida ou não configurada.'});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(503).json({error:'Ligação do mural ainda não configurada.'});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(req.method==='GET'){
   const inbox=req.query?.inbox==='1';
   let query=db.from('ai_team_entries').select('*').order('created_at',{ascending:false}).limit(500);
   if(inbox)query=query.in('recipient',[author,'all']).neq('status','done');
   const {data,error}=await query;if(error)throw error;
   return res.status(200).json({agent:author,entries:data});
  }
  let input;try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'JSON inválido.'});}
  if(!input||typeof input!=='object')return res.status(400).json({error:'Corpo inválido.'});
  if(req.method==='POST'){
   let entry;try{entry=validateEntry(input,author);}catch(e){return res.status(400).json({error:e.message});}
   if(entry.parent_id){const {data,error}=await db.from('ai_team_entries').select('id,parent_id').eq('id',entry.parent_id).maybeSingle();if(error)throw error;if(!data||data.parent_id)return res.status(400).json({error:'Responde ao identificador do assunto principal.'});}
   const {data,error}=await db.from('ai_team_entries').insert(entry).select().single();if(error)throw error;
   return res.status(201).json({entry:data});
  }
  if(!Object.hasOwn(STATUSES,input.status)||!input.id||!/^[0-9a-f-]{36}$/i.test(input.id))return res.status(400).json({error:'Estado ou identificador inválido.'});
  const {data:entry,error:readError}=await db.from('ai_team_entries').select('*').eq('id',input.id).maybeSingle();if(readError)throw readError;
  if(!entry||entry.kind!=='request'||![entry.author,entry.recipient].includes(author))return res.status(403).json({error:'Só o autor ou destinatário pode atualizar este pedido.'});
  const {data,error}=await db.from('ai_team_entries').update({status:input.status}).eq('id',input.id).select().single();if(error)throw error;
  return res.status(200).json({entry:data});
 }catch(e){console.error('AI team operation failed:',e.code||'unknown');return res.status(500).json({error:'Não foi possível guardar ou carregar o mural.'});}
}
