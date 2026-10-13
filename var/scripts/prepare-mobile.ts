import { copyFileSync,mkdirSync,writeFileSync,readdirSync,readFileSync } from 'node:fs';
import path from 'node:path';
const core='public/media-core';mkdirSync(core,{recursive:true});
for(const f of ['ffmpeg-core.js','ffmpeg-core.wasm'])copyFileSync(path.join('node_modules/@ffmpeg/core/dist/esm',f),path.join(core,f));
// Executado após Vite: manifesto próprio cobre os workers, core e os assets locais para uso offline.
const files:string[]=[];
const base=process.env.VAR_BASE || '/';
function scan(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(!['sw.js','offline-files.json'].includes(e.name))files.push(base+p.replaceAll('\\','/').slice(5));}}
if(process.argv.includes('--manifest')){scan('dist');writeFileSync('dist/offline-files.json',JSON.stringify({version:Date.now(),files}));}
