import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('MCP exposes fixed persona tools and starts without publishing or a credential',async()=>{
 const child=spawn(process.execPath,['scripts/ai-team-mcp.mjs','--agent','leo'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let output='',stderr='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>stderr+=d);
 child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05'}})+'\n'+JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error(stderr)));});
 const responses=output.trim().split('\n').map(JSON.parse);
 assert.equal(responses[0].result.serverInfo.name,'pitch-leo');
 assert.equal(responses[1].result.tools.length,4);
 assert.equal(responses[1].result.tools[2].inputSchema.properties.author,undefined);
});
