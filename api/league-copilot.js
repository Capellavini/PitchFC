import Anthropic from '@anthropic-ai/sdk';
import {createClient} from '@supabase/supabase-js';
import {validateCopilotRequest,sanitizeCopilotDraft,SHEET_SCHEMA,RECAP_SCHEMA,COPILOT_SYSTEM} from '../src/lib/leagueCopilot.js';
import {AFPCE_SHEET_SCHEMA,AFPCE_EXTRACTION_INSTRUCTIONS} from '../src/lib/afpceBoletimSchema.js';
import {adjuntoChatContext,ADJUNTO_CHAT_SYSTEM,ADJUNTO_CHAT_SCHEMA,sanitizeAdjuntoChat} from '../src/lib/leagueAdjuntoChat.js';
import {ONBOARDING_SCHEMA,ONBOARDING_SYSTEM,sanitizeOnboarding} from '../src/lib/leagueOnboarding.js';
const deps={env:process.env,createSupabase:(url,key,token)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}}),createAnthropic:key=>new Anthropic({apiKey:key,timeout:25000,maxRetries:0})};
export function createHandler(overrides={}){const d={...deps,...overrides};return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const fail=(status,message)=>res.status(status).json({error:true,message});
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'Método não permitido.')}
 const token=/^Bearer (\S+)$/.exec(req.headers?.authorization||'')?.[1];if(!token)return fail(401,'Inicia sessão para utilizar o Adjunto.');
 if(d.env.LEAGUE_COPILOT_ENABLED!=='true'||!d.env.ANTHROPIC_API_KEY)return fail(503,'O Adjunto com IA ainda não está ativado. Continua pelas ferramentas.');
 const url=d.env.SUPABASE_URL||d.env.VITE_SUPABASE_URL,key=d.env.SUPABASE_ANON_KEY||d.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)return fail(503,'A IA não está configurada.');
 let input;try{input=validateCopilotRequest(typeof req.body==='string'?JSON.parse(req.body):req.body)}catch(e){return fail(400,e.message==='private_chat_data'?'Remove contatos e números de licença da mensagem antes de enviar.':'Pedido inválido. Confirma os campos e o limite da mensagem ou fotografia.')}
 try{
  if(input.image){const bytes=Buffer.from(input.image.data,'base64');const valid=bytes.length<=2_500_000&&((input.image.media_type==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))||(input.image.media_type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(input.image.media_type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'));if(!valid)return fail(400,'Fotografia inválida. Usa JPG, PNG ou WebP até 2,5 MB.')}
  // This client carries the caller JWT throughout; there is no service-role bypass.
  const db=d.createSupabase(url,key,token);const auth=await db.auth.getUser(token);if(auth.error||!auth.data?.user)return fail(401,'A sessão terminou. Inicia sessão novamente.');
  if(input.task==='onboarding'){
   let onboardingCompetition=null;
   if(input.leagueSlug&&input.competitionSlug){const page=await db.rpc('competition_page',{p_league_slug:input.leagueSlug,p_competition_slug:input.competitionSlug,p_key:null});if(page.error||!page.data)return fail(403,'Sem acesso à competição.');const manager=await db.rpc('is_league_manager',{l:page.data.league_id||page.data.league?.id,c:page.data.id});if(manager.error||manager.data!==true)return fail(403,'Sem acesso de gestão.');onboardingCompetition=page.data.id;}
   else{const allowed=await db.rpc('league_onboarding_allowed');if(allowed.error||allowed.data!==true)return fail(403,'A criação por IA requer acesso de piloto aprovado.');}
   const slot=await db.rpc('league_copilot_take_slot',{p_competition_id:onboardingCompetition});if(slot.error||slot.data!==true)return fail(slot.error?503:429,'A cota da IA não está disponível. Continua por etapas.');
   const result=await d.createAnthropic(d.env.ANTHROPIC_API_KEY).messages.create({model:d.env.LEAGUE_COPILOT_MODEL||'claude-haiku-4-5',max_tokens:1500,system:ONBOARDING_SYSTEM,tools:[{name:'propose_league_draft',description:'Propose configuration for human review; never creates records.',input_schema:ONBOARDING_SCHEMA}],tool_choice:{type:'tool',name:'propose_league_draft'},messages:[{role:'user',content:JSON.stringify({conversation:input.messages})}]});
   if(['refusal','max_tokens'].includes(result.stop_reason))return fail(422,'Resposta incompleta. Continua pelo formulário.');
   return res.status(200).json({reply:sanitizeOnboarding(result.content?.find(b=>b.type==='tool_use'&&b.name==='propose_league_draft')?.input),reviewRequired:true});
  }
  const comp=await db.rpc('competition_page',{p_league_slug:input.leagueSlug,p_competition_slug:input.competitionSlug,p_key:null});
  if(comp.error||!comp.data)return fail(403,'Sem acesso a esta competição.');
  const c=comp.data;const access=await db.rpc('is_league_manager',{l:c.league_id||c.league?.id,c:c.id});
  if(access.error||access.data!==true)return fail(403,'O Adjunto administrativo está reservado à direção.');
  let context;
  if(['sheet','afpce_sheet'].includes(input.task)){
    const page=await db.rpc('match_page',{p_match_id:input.matchId,p_key:null});
    if(page.error||!page.data?.match||page.data.match.competition_id!==c.id)return fail(403,'O jogo não pertence a esta competição.');
    context={competition:c.name,matchId:input.matchId,home:page.data.teams?.home?.name,away:page.data.teams?.away?.name};
    if(input.task==='afpce_sheet'){
      const club=[page.data.teams?.home,page.data.teams?.away].find(t=>t?.id===input.teamId);
      if(!club)return fail(403,'O clube não participa neste jogo.');
      context={...context,clubName:club.name,teamId:club.id,format:c.format,template:'afpce_participants_f11_v1'};
    }
  }else{
    const rows=await db.rpc('competition_matches',{p_competition_id:c.id,p_key:null});if(rows.error||!Array.isArray(rows.data?.items))return fail(503,'Não foi possível conferir os resultados oficiais.');
    if(input.task==='chat')context=adjuntoChatContext(rows.data.items);
    else{
    const official=(rows.data?.items||[]).filter(m=>m.result_status==='homologated');if(!official.length)return fail(409,'Ainda não há resultados homologados para resumir.');
    if(official.length>100)return fail(409,'Seleciona um conjunto menor de jogos para preparar o resumo.');
    context={competition:c.name,results:official.map(m=>({home:m.home?.name,away:m.away?.name,homeScore:m.home_score,awayScore:m.away_score,round:m.round}))};
    }
  }
  const quota=await db.rpc('league_copilot_take_slot',{p_competition_id:c.id});if(quota.error)return fail(503,'A cota da IA ainda não está disponível. Usa a transcrição manual.');if(quota.data!==true)return fail(429,'Atingiste o limite diário do Adjunto. Podes continuar manualmente.');
  const content=[{type:'text',text:JSON.stringify({task:input.task,context})},...(input.image?[{type:'image',source:input.image}]:[])];
  if(input.task==='chat'){
   const result=await d.createAnthropic(d.env.ANTHROPIC_API_KEY).messages.create({model:d.env.LEAGUE_COPILOT_MODEL||'claude-haiku-4-5',max_tokens:1200,system:ADJUNTO_CHAT_SYSTEM,tools:[{name:'propose_league_draft',description:'Answer with guidance and navigation only; no writes.',input_schema:ADJUNTO_CHAT_SCHEMA}],tool_choice:{type:'tool',name:'propose_league_draft'},messages:[{role:'user',content:JSON.stringify({context,conversation:input.messages})}]});
   if(['refusal','max_tokens'].includes(result.stop_reason))return fail(422,'A resposta ficou incompleta. Tenta uma pergunta mais curta.');
   const output=result.content?.find(b=>b.type==='tool_use'&&b.name==='propose_league_draft');
   return res.status(200).json({reply:sanitizeAdjuntoChat(output?.input),reviewRequired:true});
  }
  const result=await d.createAnthropic(d.env.ANTHROPIC_API_KEY).messages.create({model:d.env.LEAGUE_COPILOT_MODEL||'claude-haiku-4-5',max_tokens:input.task==='afpce_sheet'?6500:3500,system:COPILOT_SYSTEM+(input.task==='afpce_sheet'?'\n'+AFPCE_EXTRACTION_INSTRUCTIONS:''),tools:[{name:'propose_league_draft',description:'Prepare a draft for human review. Never writes official records.',input_schema:input.task==='afpce_sheet'?AFPCE_SHEET_SCHEMA:input.task==='sheet'?SHEET_SCHEMA:RECAP_SCHEMA}],tool_choice:{type:'tool',name:'propose_league_draft'},messages:[{role:'user',content}]});
  if(['refusal','max_tokens'].includes(result.stop_reason))return fail(422,'A leitura não ficou completa. Usa a transcrição manual.');
  const output=result.content?.find(b=>b.type==='tool_use'&&b.name==='propose_league_draft');if(!output)return fail(422,'Não foi possível extrair um rascunho.');
  return res.status(200).json({draft:sanitizeCopilotDraft(input.task,output.input),reviewRequired:true});
 }catch{return fail(503,'A IA não respondeu. Os registos oficiais não foram alterados. Podes continuar manualmente.')}
}}
export default createHandler();
