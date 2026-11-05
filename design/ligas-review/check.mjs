import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['design/ligas-review/checks.test.jsx'],outfile:'design/ligas-review/dist/checks.test.cjs',bundle:true,jsx:'automatic',format:'cjs',platform:'node',loader:{'.css':'empty'},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'error'});
const r=spawnSync(process.execPath,['--test','design/ligas-review/dist/checks.test.cjs'],{stdio:'inherit'});process.exit(r.status??1);
