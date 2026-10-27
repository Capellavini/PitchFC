import {operationSummary,roundRecap} from './leagueOperations.js';
export const adjuntoName=lang=>['pt-br','ptbr'].includes(lang)?'Auxiliar técnico':lang==='en'?'Assistant coach':'Adjunto';
export const ADJUNTO_ACTIONS=['afpce','sheet','insights','recap','live','whatsapp','compare','teams','calendar','operations'];
export function validateChatMessages(messages){
 if(!Array.isArray(messages)||!messages.length||messages.length>10)throw Error('invalid_chat');
 const clean=messages.map(m=>{if(!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||!m.text.trim()||m.text.length>1500)throw Error('invalid_chat');return{role:m.role,text:m.text.trim()}});
 if(clean.at(-1).role!=='user')throw Error('invalid_chat');return clean;
}
export function guidedAdjuntoReply(question,{matches=[],teams=[],competition={}}={}){
 const q=String(question).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),s=operationSummary(matches,teams);
 if(/compar|confront|contra| versus| vs /.test(q))return {text:'Abre a comparação para escolher equipas ou jogadores. Os confrontos diretos e as taxas em casa/fora usam só resultados homologados; a amostra e a diferença em pontos percentuais aparecem junto dos valores.',actions:['compare']};
 if(/arbitr|adiam|apto|elegib|recinto|document/.test(q))return {text:'A área Operação permite preparar nomeações, adiamentos, elegibilidade, recintos e documentos. Estes registos são rascunhos desta sessão; confirma as decisões na ficha oficial. Não tenho acesso a um histórico operacional sincronizado.',actions:['operations']};
 if(/calend|agenda/.test(q))return {text:'O calendário tem semana, mês e lista, com filtros e alertas de conflito. Abre um jogo para gerir o horário na ficha.',actions:['calendar']};
 if(/perfil|jogador|atleta|equipa|time/.test(q))return {text:'Nos clubes podes abrir o perfil da equipa, consultar plantel, próximos jogos, forma recente e estatísticas casa/fora, e comparar com outra equipa.',actions:['teams','compare']};
 if(/whats|numero|bot/.test(q))return {text:'O fluxo previsto recebe a ficha em conversa privada, confere o remetente autorizado e devolve a transcrição. Só após a confirmação de quem enviou é criado um rascunho no app. A ligação WhatsApp da Liga ainda não está ativa.',actions:['whatsapp','afpce']};
 if(/live|ao vivo|matchday|lance/.test(q))return {text:`Há ${s.live} jogos ao vivo nesta seleção. A Liga pode optar por registar golos e ocorrências durante o jogo. Os lances continuam provisórios até à homologação.`,actions:['live']};
 if(/ficha|boletim|papel|foto|preench/.test(q))return {text:'Posso ajudar a preparar ou conferir o boletim AFPCE. Escolhe o jogo e o clube, mantém efetivos e suplentes separados e confere licenças e campos ilegíveis. Não reproduzo assinaturas nem homologo resultados.',actions:['afpce','sheet']};
 if(/resumo|resultado/.test(q))return {text:roundRecap(matches,competition.name),actions:['recap']};
 if(/pend|falta|jornada/.test(q))return {text:`Nesta competição há ${s.pending} fichas por validar, ${s.unscheduled} jogos por agendar e ${s.official} resultados homologados. Posso orientar a conferência antes da publicação.`,actions:['insights','afpce']};
 return {text:'Posso ajudar com fichas, pendências da jornada, resumos dos resultados, acesso por WhatsApp e Matchday ao vivo. Sobre qual destes assuntos queres trabalhar?',actions:['afpce','insights','live']};
}
export function validateWaLeaguePolicy(policy){
 if(!policy||!['organizer','allowlist'].includes(policy.mode))throw Error('invalid_policy');
 const numbers=policy.numbers||[];
 if(!Array.isArray(numbers))throw Error('invalid_numbers');
 const clean=numbers.map(normalizeLeaguePhone);
 if(clean.some(n=>!n)||new Set(clean).size!==clean.length)throw Error('invalid_numbers');
 if(policy.mode==='allowlist'&&(clean.length<1||clean.length>2))throw Error('one_or_two_numbers');
 return {mode:policy.mode,numbers:policy.mode==='allowlist'?clean:[]};
}
export function normalizeLeaguePhone(value){
 if(typeof value!=='string'||/[^+\d\s()\-]/.test(value))return null;
 const phone=value.replace(/[\s()\-]/g,'');return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
// Design contract only: sender identity MUST come from a verified transport binding,
// not the caption, a display name, the forwarded author or model output.
export function canUseLeagueAdjunto({leagueId,competitionId,policy,binding,transport}){
 if(!leagueId||binding?.active!==true||binding.verified!==true||!binding.playerId||binding.leagueId!==leagueId||transport?.kind!=='direct'||transport.verified!==true)return false;
 if(binding.competitionId&&binding.competitionId!==competitionId)return false;
 const sender=normalizeLeaguePhone(transport.senderPhone),linked=normalizeLeaguePhone(binding.phone);
 if(!sender||sender!==linked)return false;
 let p;try{p=validateWaLeaguePolicy(policy)}catch{return false}
 if(!Array.isArray(binding.roles))return false;
 const staff=binding.roles.some(r=>['owner','manager','scorer'].includes(r));
 return p.mode==='organizer'?binding.roles?.some(r=>['owner','manager'].includes(r))===true:Boolean(staff&&p.numbers.includes(sender));
}
export function confirmLeagueWaDraft(draft,{leagueId,competitionId,policy,binding,transport,revision,confirmed,now=Date.now()}){
 if(!canUseLeagueAdjunto({leagueId,competitionId,policy,binding,transport}))throw Error('forbidden');
 if(!draft||draft.leagueId!==leagueId||draft.competitionId!==competitionId||!draft.matchId||!draft.teamId||draft.senderPlayerId!==binding.playerId||draft.senderPhone!==normalizeLeaguePhone(transport.senderPhone))throw Error('sender_mismatch');
 if(!Number.isFinite(now)||!Number.isFinite(Date.parse(draft.expiresAt))||Date.parse(draft.expiresAt)<=now)throw Error('expired');
 if(!Number.isInteger(revision)||revision<1||revision!==draft.revision)throw Error('stale_revision');
 if(confirmed!==true)throw Error('review_required');
 if(draft.status!=='awaiting_review')throw Error('invalid_state');
 return {...draft,status:'confirmed_for_import',confirmedBy:binding.playerId,confirmedRevision:revision,official:false};
}
