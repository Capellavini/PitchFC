import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../src/crm/main.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const moduleBody=source.slice(0,source.indexOf("if(supabase)supabase.auth.onAuthStateChange"));
function harness(responses=[]){
 const calls=[],messages=[],label={textContent:''};
 const supabase={from(table){return {update(payload){const call={table,payload,filters:{}};calls.push(call);const chain={eq(key,value){call.filters[key]=value;return chain},select(){return chain},async maybeSingle(){await Promise.resolve();const result=responses.shift();return result??{data:{revision:call.filters.revision+1},error:null}}};return chain}}}};
 const context=vm.createContext({supabase,structuredClone,Intl,console,setTimeout,clearTimeout,window:{addEventListener(){}},document:{querySelector(selector){return selector==='.save-label'?label:null}}});
 // Module initialization must be safe before authenticated markup is mounted.
 vm.runInContext(moduleBody,context);
 vm.runInContext('showSyncFailure=message=>messages.push(message);toast=message=>messages.push(message);',Object.assign(context,{messages}));
 const api=vm.runInContext('({queueSave,initializeRevision:n=>cloudRevision=n,idle:()=>saveQueue,state:()=>({cloudRevision,pendingSaves,saveBlocked,cloudLeagues})})',context);
 return {api,calls,messages,label};
}
test('module initializes before any CRM form is mounted',()=>{assert.doesNotThrow(()=>harness())});
test('rapid edits save snapshots serially against the last acknowledged revision',async()=>{const {api,calls}=harness();api.initializeRevision(7);const draft=[{name:'first'}];api.queueSave(draft);draft[0].name='second';api.queueSave(draft);await api.idle();assert.deepEqual(calls.map(c=>c.filters.revision),[7,8]);assert.equal(calls[0].payload.leagues[0].name,'first');assert.equal(calls[1].payload.leagues[0].name,'second');assert.equal(api.state().cloudRevision,9);assert.equal(api.state().pendingSaves,0)});
test('stale revisions stop subsequent writes and retain the last acknowledged cloud state',async()=>{const {api,calls,messages}=harness([{data:null,error:null}]);api.initializeRevision(3);api.queueSave([{name:'unsaved'}]);await api.idle();api.queueSave([{name:'must not overwrite'}]);await api.idle();assert.equal(calls.length,1);assert.equal(api.state().saveBlocked,true);assert.equal(api.state().cloudRevision,3);assert.ok(messages.some(m=>m.includes('Outra sessão')))});
test('network errors remain visible and never report the draft as synchronized',async()=>{const {api,label}=harness([{data:null,error:{message:'network unavailable'}}]);api.initializeRevision(2);api.queueSave([{name:'pending'}]);await api.idle();assert.equal(api.state().saveBlocked,true);assert.equal(api.state().cloudRevision,2);assert.equal(label.textContent,'⚠ Não sincronizado')});
