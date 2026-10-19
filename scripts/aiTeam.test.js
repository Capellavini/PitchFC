import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../src/lib/aiTeam.js';
import handler,{identifyAgent} from '../api/ai-team.js';
test('author comes from credential, never payload',()=>{
 assert.equal(identifyAgent('Bearer leo-secret',{AI_TEAM_TOKEN_LEO:'leo-secret'}),'leo');
 assert.equal(identifyAgent('Bearer bad',{AI_TEAM_TOKEN_LEO:'leo-secret'}),undefined);
 assert.equal(identifyAgent('',{}),undefined);
 assert.equal(identifyAgent('leo-secret',{AI_TEAM_TOKEN_LEO:'leo-secret'}),undefined);
 assert.equal(validateEntry({kind:'request',recipient:'cris',author:'cris',title:'Test',body:'Work'},'ney').author,'ney');
});
test('reject malformed records',()=>{
 const valid={kind:'message',recipient:'ney',title:'Title',body:'Body'};
 for(const patch of [{kind:'invalid'},{kind:'toString'},{recipient:'unknown'},{recipient:'constructor'},{title:' '},{body:'x'.repeat(12001)},{parent_id:'bad'}])assert.throws(()=>validateEntry({...valid,...patch},'leo'));
 assert.throws(()=>validateEntry(valid,'unknown'));
});
test('endpoint denies unauthenticated requests before database access',async()=>{
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({method:'GET',headers:{}},res);assert.equal(res.code,401);
 await handler({method:'DELETE',headers:{}},res);assert.equal(res.code,405);
});
