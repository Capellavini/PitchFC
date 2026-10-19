import {readFile} from 'node:fs/promises';
import {connection} from './ai-team-connection.mjs';
const args=process.argv.slice(2),flag=args.indexOf('--agent');
const agent=flag>=0?args.splice(flag,2)[1]:process.env.AI_TEAM_AGENT;
const [command='inbox',file]=args;
if(!['inbox','list','publish','status'].includes(command))throw Error('Use --agent leo|cris|ney inbox|list|publish <json-file>|status <json-file>.');
const request=await connection(agent);
const body=['publish','status'].includes(command)?JSON.parse(await readFile(file,'utf8')):undefined;
console.log(JSON.stringify(await request(command==='publish'?'POST':command==='status'?'PATCH':'GET',body,command==='inbox'),null,2));
