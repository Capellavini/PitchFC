import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

// Bundle the browser-facing helpers so Node can test their real imports too.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(os.tmpdir(), `pitch-home-feed-${process.pid}-${Date.now()}.test.mjs`);
try {
  await build({ entryPoints: [path.join(root, 'src/lib/homeFeed.test.js')], bundle: true, platform: 'node', format: 'esm', outfile: output, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' });
  const result = spawnSync(process.execPath, ['--test', output], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (fs.existsSync(output)) fs.unlinkSync(output);
}
