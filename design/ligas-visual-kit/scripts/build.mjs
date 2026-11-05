import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depsIndex = process.argv.indexOf('--deps');
const dependencies = depsIndex >= 0 ? process.argv[depsIndex + 1] : null;
if (!dependencies) throw new Error('Pass --deps <existing node_modules directory>. No dependencies are downloaded.');
const dependencyRoot = path.resolve(dependencies);
const resolveFromDeps = createRequire(path.join(dependencyRoot, '__pitch_visual_resolve__.cjs'));
const { build } = await import(pathToFileURL(resolveFromDeps.resolve('esbuild')).href);
const shared = { bundle:true, absWorkingDir:root, nodePaths:[dependencyRoot], jsx:'automatic', logLevel:'info' };
await fs.mkdir(path.join(root, 'preview/dist'), { recursive:true });
await build({ ...shared, entryPoints:['preview/main.jsx'], outfile:'preview/dist/main.js', format:'esm', platform:'browser',
  define:{'process.env.NODE_ENV':'"production"'}, minify:false, sourcemap:false });
await build({ ...shared, entryPoints:['scripts/components.test.jsx'], outfile:'preview/dist/components.test.cjs', format:'cjs', platform:'node',
  packages:'bundle', define:{'process.env.NODE_ENV':'"production"'} });
const template = await fs.readFile(path.join(root, 'preview/index.html'), 'utf8');
const script = (await fs.readFile(path.join(root, 'preview/dist/main.js'), 'utf8')).replaceAll('</script', '<\\/script');
const css = await fs.readFile(path.join(root, 'preview/dist/main.css'), 'utf8');
const standalone = template.replace('<script type="module" src="./dist/main.js"></script>', `<script type="module">${script}</script>`)
  .replace('<link rel="stylesheet" href="./dist/main.css">', `<style>${css}</style>`);
await fs.writeFile(path.join(root, 'preview/pitch-ligas-componentes.html'), standalone);
console.log(JSON.stringify({ status:'built', root, featureCodeChanged:false, preview:'preview/pitch-ligas-componentes.html' }));
