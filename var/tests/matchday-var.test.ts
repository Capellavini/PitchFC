import {test} from 'node:test';import assert from 'node:assert/strict';
import {MATCHDAY_VAR_ENABLED,planGoalReplay,stampMatchdayGoal,fanOutMatchdayGoal,type EligibleVarDevice,type GoalReplayRequest,type VarCaptureContext} from '../src/mobile/matchday-var.ts';
import {PhoneRecorder} from '../src/mobile/recorder.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const start=Date.parse('2026-10-13T12:00:00Z');
const request:GoalReplayRequest={version:1,groupId:id(1),gameId:id(2),matchId:'179000001',goalId:id(3),scorerPlayerId:id(4),sessionId:id(5),occurredAt:new Date(start+95000).toISOString(),recordedAt:new Date(start+100000).toISOString(),ownGoal:false,revision:1};
const context:VarCaptureContext={enabled:true,armed:true,active:true,groupId:id(1),gameId:id(2),matchId:request.matchId,sessionId:id(5),deviceId:id(6),startServerMs:start,clockUncertaintyMs:200,elapsedSeconds:103,earliestSeconds:60,preSeconds:20,postSeconds:10};
test('organizador libera uma partida: gol chega a todos os dispositivos ativos dos confirmados',()=>{
  const first:EligibleVarDevice={groupId:id(1),gameId:id(2),matchId:request.matchId,sessionId:id(5),deviceId:id(6),operatorPlayerId:id(7),armed:true,active:true,captureStartedServerMs:start,leaseExpiresServerMs:start+120000};
  const second={...first,sessionId:id(8),deviceId:id(9),operatorPlayerId:id(10)};
  const options={enabled:true,nowServerMs:start+103000,confirmedPlayerIds:new Set([id(7),id(10)])};
  const targets=fanOutMatchdayGoal(request,[first,second,first,{...first,sessionId:id(11),operatorPlayerId:id(99)},{...first,sessionId:id(12),gameId:id(99)},{...first,sessionId:id(13),groupId:id(99)},{...first,sessionId:id(14),active:false},{...first,sessionId:id(15),armed:false},{...first,sessionId:id(16),leaseExpiresServerMs:start}],options);
  assert.equal(targets.length,2);assert.equal(fanOutMatchdayGoal(request,[first],{...options,enabled:false}).length,0);
  const p1=planGoalReplay(targets[0].request,context);
  const p2=planGoalReplay(targets[1].request,{...context,sessionId:second.sessionId,deviceId:second.deviceId});
  assert.equal(p1.status,'ready');assert.equal(p2.status,'ready');
  if(p1.status==='ready'&&p2.status==='ready'){
    assert.equal(p1.association.goalId,p2.association.goalId);assert.equal(p1.association.scorerPlayerId,id(4));assert.equal(p2.association.scorerPlayerId,id(4));
    assert.notEqual(p1.key,p2.key);assert.notEqual(p1.association.deviceId,p2.association.deviceId);
  }
});
test('Lukas para entre jogos: nenhuma câmera ativa não cria pedido; reinício não recupera gol anterior',()=>{
  const session:EligibleVarDevice={groupId:id(1),gameId:id(2),matchId:request.matchId,sessionId:id(5),deviceId:id(6),operatorPlayerId:id(7),armed:true,active:true,captureStartedServerMs:start,leaseExpiresServerMs:start+120000};
  const options={enabled:true,nowServerMs:start+103000,confirmedPlayerIds:new Set([id(7)])};
  assert.equal(fanOutMatchdayGoal(request,[{...session,active:false}],options).length,0);
  assert.equal(fanOutMatchdayGoal(request,[],options).length,0);
  assert.equal(fanOutMatchdayGoal(request,[{...session,matchId:'outro-jogo'}],options).length,0);
  assert.equal(fanOutMatchdayGoal(request,[{...session,sessionId:id(20),captureStartedServerMs:start+100000}],options).length,0);
  const nextGoal={...request,goalId:id(21),occurredAt:new Date(start+102000).toISOString()};
  assert.equal(fanOutMatchdayGoal(nextGoal,[{...session,sessionId:id(20),captureStartedServerMs:start+100000}],options).length,1);
});
test('gol do Lukas recebido com atraso salva janela do gol, não da chegada, e mantém vínculo',()=>{
  const p=planGoalReplay(request,context);assert.equal(p.status,'ready');if(p.status!=='ready')return;
  assert.equal(p.at,95);assert.equal(p.start,75);assert.equal(p.end,105);assert.equal(p.association.scorerPlayerId,id(4));assert.equal(p.association.deviceId,id(6));
});
test('integração exige opt-in; desligado, sem gravação e outro grupo/jogo/sessão não acionam VAR',()=>{
  assert.equal(MATCHDAY_VAR_ENABLED,true);
  assert.equal(planGoalReplay(request,{...context,enabled:false}).status,'disabled');
  assert.equal(planGoalReplay(request,{...context,armed:false}).status,'disabled');
  assert.equal(planGoalReplay(request,{...context,active:false}).status,'not_recording');
  for(const key of ['groupId','gameId','matchId','sessionId'] as const)assert.equal(planGoalReplay({...request,[key]:id(99)},context).status,'wrong_session');
});
test('retry e revisão da mesma identidade não duplicam o vídeo',()=>{
  const known=new Set([`${request.sessionId}:${request.goalId}`]);
  assert.equal(planGoalReplay(request,context,known).status,'duplicate');
  assert.equal(planGoalReplay({...request,revision:2},context,known).status,'duplicate');
});
test('histórico perdido, relógios incertos, hora futura e IDs locais são rejeitados',()=>{
  assert.equal(planGoalReplay(request,{...context,earliestSeconds:96}).status,'expired');
  assert.equal(planGoalReplay(request,{...context,clockUncertaintyMs:2000}).status,'clock_uncertain');
  assert.equal(planGoalReplay({...request,occurredAt:new Date(start+200000).toISOString()},context).status,'future');
  assert.equal(planGoalReplay({...request,scorerPlayerId:4},context).status,'invalid');
  assert.equal(planGoalReplay({...request,occurredAt:'minuto 8'},context).status,'invalid');
});
test('histórico parcialmente disponível avisa janela reduzida; o evento conserva identidade e minuto',()=>{
  const p=planGoalReplay(request,{...context,earliestSeconds:80});assert.equal(p.status,'ready');if(p.status==='ready'){assert.equal(p.start,80);assert.equal(p.shortened,true);}
  const event=stampMatchdayGoal({scorerId:4,minute:8},id(3),request.recordedAt);
  assert.equal(event.eventId,id(3));assert.equal(event.minute,8);assert.equal(event.recordedAt,request.recordedAt);
});
test('gancho do gravador carrega vínculo antes da coleta e mantém a janela anterior/posterior',()=>{
  const engine=new PhoneRecorder();engine.time=()=>103;engine.status.active=true;
  engine.settings={quality:'economy',pre:20,post:10,audio:false,demo:false};
  engine.parts=[{id:'part',start:60,end:100,blob:new Blob(['video'])}];
  let associated=false;engine.onClip=c=>{associated=c.association?.scorerPlayerId===id(4);};
  const p=planGoalReplay(request,context);assert.equal(p.status,'ready');if(p.status!=='ready')return;
  const clip=engine.commandMatchday(p);
  assert.equal(associated,true);assert.equal(clip.source,'matchday');assert.equal(clip.start,75);assert.equal(clip.end,105);
  assert.equal(clip.association?.goalId,id(3));
  assert.throws(()=>engine.commandMatchday({...p,at:10}),/histórico/);
});
