import {test} from 'node:test';import assert from 'node:assert/strict';
import {stampVarGoal,syncVarClock,varTimestamp} from './varProtocol.js';
test('marca horário do toque, resolve jogador permanente e conserva minuto e autogolo',()=>{
 const event=Object.freeze({scorerId:42,minute:8,ownGoal:true,occurredAt:'2026-10-13T10:00:05.123Z'});
 const goal=stampVarGoal(event,[{id:42,uuid:'player-uuid'}],'event-uuid','2026-10-13T10:00:09.456Z');
 assert.equal(goal.occurredAt,event.occurredAt);assert.equal(goal.recordedAt,'2026-10-13T10:00:09.456Z');
 assert.equal(goal.scorerPlayerId,'player-uuid');assert.equal(goal.minute,8);assert.equal(goal.ownGoal,true);assert.equal(goal.eventId,'event-uuid');
 assert.equal(event.eventId,undefined);
});
test('relógio sincronizado mantém carimbo ISO com milissegundos',async()=>{
 await syncVarClock({rpc:async()=>({data:{serverMs:Date.now()+5000},error:null})});
 const delta=Date.parse(varTimestamp())-Date.now();assert.ok(delta>=4900&&delta<=5100);
});
test('jogador não mapeado não é confundido com ID numérico da tela',()=>{
 assert.equal(stampVarGoal({scorerId:42},[],'goal','2026-10-13T10:00:00.000Z').scorerPlayerId,null);
});
