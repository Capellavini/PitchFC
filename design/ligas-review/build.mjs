import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const dir=path.resolve('design/ligas-review/dist');
await fs.mkdir(dir,{recursive:true});
await build({entryPoints:['design/ligas-review/main.jsx'],outfile:dir+'/review.js',bundle:true,format:'esm',jsx:'automatic',platform:'browser',minify:true,external:['/apresentacao/*'],define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'}});
const html=await fs.readFile('design/ligas-review/index.html','utf8');
await fs.writeFile(dir+'/index.html',html.replace('<script type="module" src="./main.jsx"></script>','<link rel="stylesheet" href="./review.css"><script type="module" src="./review.js"></script>'));
for(const item of ['brand','apresentacao/assets']){await fs.mkdir(path.join(dir,path.dirname(item)),{recursive:true});await fs.cp('public/'+item,dir+'/'+item,{recursive:true});}
console.log('Prévia pronta em '+dir);
const css = await fs.readFile(dir+'/review.css','utf8');
let code = await fs.readFile(dir+'/review.js','utf8');
const data = async (p,type) => 'data:'+type+';base64,'+(await fs.readFile(p)).toString('base64');
for(const [url,type] of [['/brand/logo.png','image/png'],['/brand/field.jpg','image/jpeg']]){try{code=code.replaceAll(url,await data('public'+url,type));}catch{}}
const embeddedCss=css.replaceAll('/apresentacao/assets/heading.ttf',await data('public/apresentacao/assets/heading.ttf','font/ttf'));
const standalone=html.replace('<script type="module" src="./main.jsx"></script>',()=>`<style>${embeddedCss}</style><script type="module">${code.replaceAll('</script','<\\/script')}</script>`);
await fs.writeFile(dir+'/pitch-ligas-previa.html',standalone);
