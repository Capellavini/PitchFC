import fs from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'review','league-operations');
await fs.mkdir(out,{recursive:true});
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import LeagueOperationsDemo from './src/components/league/operations/LeagueOperationsDemo';createRoot(document.getElementById('root')).render(<LeagueOperationsDemo/>);`,resolveDir:root,sourcefile:'review-entry.jsx',loader:'jsx'},bundle:true,minify:true,jsx:'automatic',format:'esm',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await fs.mkdir(path.join(out,'brand'),{recursive:true});await fs.copyFile(path.join(root,'public','brand','logo.png'),path.join(out,'brand','logo.png'));
await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>PITCH Leagues · Central da Liga</title><link rel="stylesheet" href="app.css"><style>body{margin:0;background:#0A0F18}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>');
console.log(out);
