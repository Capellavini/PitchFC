import { copyFileSync,mkdirSync,writeFileSync,readdirSync,rmSync } from 'node:fs';
import path from 'node:path';
const CORE_FILES=['ffmpeg-core.js','ffmpeg-core.wasm'];
// VITE_FFMPEG_CORE_BASE (definido no shell do build): processador hospedado fora do bundle (ex.: Storage público do Supabase).
// Sem ele, o core é copiado para public/media-core e servido junto com o build (padrão do /VAR integrado).
const remoteCore=(process.env.VITE_FFMPEG_CORE_BASE||'').replace(/\/?$/,'/');
const core='public/media-core';
if(remoteCore!=='/'){rmSync(core,{recursive:true,force:true});rmSync('dist/media-core',{recursive:true,force:true});}
else{mkdirSync(core,{recursive:true});for(const f of CORE_FILES)copyFileSync(path.join('node_modules/@ffmpeg/core/dist/esm',f),path.join(core,f));}
// Executado após Vite: manifesto próprio cobre os workers, core e os assets locais para uso offline.
const files:string[]=[];
const base=process.env.VAR_BASE || '/';
function scan(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(!['sw.js','offline-files.json'].includes(e.name))files.push(base+p.replaceAll('\\','/').slice(5));}}
if(process.argv.includes('--manifest')){scan('dist');if(remoteCore!=='/')files.push(...CORE_FILES.map(f=>remoteCore+f));writeFileSync('dist/offline-files.json',JSON.stringify({version:Date.now(),files}));}
