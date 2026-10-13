import {test} from 'node:test';import assert from 'node:assert/strict';
import {currentMatch,concludeMatch} from './currentMatch.js';
const matches=[{id:1,n:1},{id:2,n:2},{id:3,n:3,isBye:true}];
test('scheduled round uses first unfinished fixture instead of last scheduled fixture',()=>{assert.equal(currentMatch({mode:'personalizado',matches}).id,1);assert.equal(currentMatch({mode:'campeonato',matches}).id,1);});
test('organizer live selection overrides default and concluded selection is ignored',()=>{assert.equal(currentMatch({matches,activeMatchId:2}).id,2);assert.equal(currentMatch({mode:'personalizado',matches:[{...matches[0],concluded:true},matches[1]],activeMatchId:1}).id,2);});
test('concluding one fixture advances current match and interval has no selected fixture',()=>{const first=concludeMatch({mode:'personalizado',activeMatchId:1,matches},1,true);assert.equal(first.activeMatchId,2);assert.equal(concludeMatch(first,2,true).activeMatchId,null);assert.equal(first.matches[0].concluded,true);assert.equal(matches[0].concluded,undefined);});
test('legacy standalone matches keep latest fixture; no fixtures wait safely',()=>{assert.equal(currentMatch({mode:'avulsa',matches}).id,2);assert.equal(currentMatch(null),null);assert.equal(currentMatch({matches:[]}),null);});
