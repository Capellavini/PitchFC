// Servidor apenas para desenvolvimento/distribuição de arquivos. Nenhuma captura ocorre aqui.
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const tls=process.env.TLS_CERT&&process.env.TLS_KEY?{cert:readFileSync(process.env.TLS_CERT),key:readFileSync(process.env.TLS_KEY)}:undefined;
const app=Fastify({logger:false,...(tls?{https:tls}:{})});
await app.register(staticPlugin,{root:path.join(root,'dist')});
await app.register(staticPlugin,{root:path.join(root,'dist'),prefix:'/VAR/',decorateReply:false});
app.setNotFoundHandler((r,reply)=>r.url.startsWith('/api/')?reply.code(404).send({error:'A versão móvel não usa API de gravador.'}):reply.sendFile('index.html'));
const port=Number(process.env.PORT||3333);await app.listen({port,host:process.env.HOST||'127.0.0.1'});
console.log(`Pitch VAR: ${tls?'https':'http'}://localhost:${port} — vídeo e replay processados no navegador`);
for(const signal of ['SIGINT','SIGTERM']as const)process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
