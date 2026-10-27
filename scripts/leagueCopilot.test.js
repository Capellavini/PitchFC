import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../api/league-copilot.js';
import {sanitizeCopilotDraft} from '../src/lib/leagueCopilot.js';
const env={LEAGUE_COPILOT_ENABLED:'true',ANTHROPIC_API_KEY:'test',SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon'};
const request={method:'POST',headers:{authorization:'Bearer token'},body:{task:'recap',leagueSlug:'liga',competitionSlug:'divisao'}};
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(x){this.body=x;return this}});
function fixture({manager=true,quota=true,user=true,quotaError=false,foreignMatch=false}={}) {
 const calls=[];
 const handler=createHandler({env,
  createSupabase:()=>({
   auth:{getUser:async()=>({data:{user:user?{id:'u'}:null}})},
   rpc:async(name,args)=>{
    calls.push(name);
    switch(name){
     case 'competition_page':return {data:{id:'c',league_id:'l',name:'Liga'}};
     case 'is_league_manager':return {data:manager};
     case 'competition_matches':return {data:{items:[{result_status:'homologated',home:{name:'A'},away:{name:'B'},home_score:1,away_score:0},{result_status:'submitted',home:{name:'Secret provisional'},home_score:9}]}};
     case 'match_page':return {data:{match:{competition_id:foreignMatch?'foreign':'c'}}};
     case 'league_copilot_take_slot':return {data:quota,error:quotaError?'error':null};
     default:throw Error(name);
    }
   }
  }),
  createAnthropic:()=>({messages:{create:async(params)=>{
   calls.push('model');assert.doesNotMatch(JSON.stringify(params),/Secret provisional/);
   return {content:[{type:'tool_use',name:'propose_league_draft',input:{text:'A venceu B por 1–0.'}}]};
  }}})
 });
 return {handler,calls};
}
test('unauthenticated and unsupported methods never reach the model',async()=>{const f=fixture();for(const req of [{...request,method:'GET'},{...request,headers:{}}]){const res=response();await f.handler(req,res);assert.ok([401,405].includes(res.code))}assert.deepEqual(f.calls,[])});
test('server rechecks manager permission independently of public competition access',async()=>{const f=fixture({manager:false}),res=response();await f.handler(request,res);assert.equal(res.code,403);assert.ok(!f.calls.includes('model'));assert.ok(!f.calls.includes('league_copilot_take_slot'))});
test('expired sessions are rejected',async()=>{const f=fixture({user:false}),res=response();await f.handler(request,res);assert.equal(res.code,401);assert.deepEqual(f.calls,[])});
test('quota refuses paid inference and fails closed on database errors',async()=>{for(const opts of [{quota:false},{quotaError:true}]){const f=fixture(opts),res=response();await f.handler(request,res);assert.ok([429,503].includes(res.code));assert.ok(!f.calls.includes('model'))}});
test('recap receives only server-authorized official data and cannot write records',async()=>{const f=fixture(),res=response();await f.handler(request,res);assert.equal(res.code,200);assert.equal(res.body.reviewRequired,true);assert.deepEqual(f.calls,['competition_page','is_league_manager','competition_matches','league_copilot_take_slot','model'])});
test('image is bounded and invalid requests never reach DB',async()=>{const f=fixture(),res=response();await f.handler({...request,body:{...request.body,task:'sheet',matchId:'10000000-0000-4000-8000-000000000001',image:'data:image/png;base64,YQ=='}},res);assert.equal(res.code,400);assert.deepEqual(f.calls,[])});
test('photo cannot be attached to another competition',async()=>{const f=fixture({foreignMatch:true}),res=response();await f.handler({...request,body:{...request.body,task:'sheet',matchId:'10000000-0000-4000-8000-000000000001',image:'data:image/png;base64,iVBORw0KGgo='}},res);assert.equal(res.code,403);assert.ok(!f.calls.includes('model'))});
test('model cannot mark extracted data official or insert unknown event kinds',()=>{const d=sanitizeCopilotDraft('sheet',{homeScore:-1,awayScore:2,official:true,events:[{type:'homologate'},{type:'goal',playerName:'A',minute:400}]});assert.equal(d.official,false);assert.equal(d.homeScore,null);assert.equal(d.events.length,1);assert.equal(d.events[0].minute,null)});
