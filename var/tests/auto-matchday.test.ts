import {test} from 'node:test';import assert from 'node:assert/strict';
import {planGoalReplay,fanOutMatchdayGoal,type GoalReplayRequest,type VarCaptureContext} from '../src/mobile/matchday-var';
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const started=Date.parse('2026-10-13T15:00:00Z');
const goal:GoalReplayRequest={version:1,groupId:uuid(1),gameId:uuid(2),sessionId:uuid(3),goalId:uuid(4),scorerPlayerId:uuid(5),matchId:'previous-fixture',occurredAt:new Date(started+30000).toISOString(),recordedAt:new Date(started+31000).toISOString(),ownGoal:false,revision:1};
const context:VarCaptureContext={followMatchday:true,enabled:true,armed:true,active:true,groupId:goal.groupId,gameId:goal.gameId,sessionId:goal.sessionId,deviceId:uuid(6),matchId:'next-fixture',startServerMs:started,clockUncertaintyMs:10,elapsedSeconds:32,earliestSeconds:0,preSeconds:20,postSeconds:10};
test('automatic camera accepts delayed goal from prior fixture without resetting its timestamp or identity',()=>{
 const plan=planGoalReplay(goal,context);assert.equal(plan.status,'ready');if(plan.status!=='ready')return;assert.equal(plan.at,30);assert.equal(plan.association.matchId,'previous-fixture');assert.equal(plan.start,10);
 assert.equal(planGoalReplay(goal,{...context,followMatchday:false}).status,'wrong_session');
 for(const key of ['groupId','gameId','sessionId']as const)assert.equal(planGoalReplay({...goal,[key]:uuid(99)},context).status,'wrong_session');
 assert.equal(planGoalReplay(goal,context,new Set([`${goal.sessionId}:${goal.goalId}`])).status,'duplicate');
});
test('automatic fanout stays within the same Matchday and excludes stopped devices',()=>{
 const device={followMatchday:true,groupId:goal.groupId,gameId:goal.gameId,matchId:'next-fixture',sessionId:goal.sessionId,deviceId:uuid(6),operatorPlayerId:uuid(7),armed:true,active:true,captureStartedServerMs:started,leaseExpiresServerMs:started+60000};
 const options={enabled:true,nowServerMs:started+32000,confirmedPlayerIds:new Set([uuid(7)])};
 assert.equal(fanOutMatchdayGoal(goal,[device],options).length,1);
 assert.equal(fanOutMatchdayGoal(goal,[{...device,gameId:uuid(99)}],options).length,0);
 assert.equal(fanOutMatchdayGoal(goal,[{...device,active:false}],options).length,0);
});
