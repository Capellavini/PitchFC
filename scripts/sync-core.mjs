#!/usr/bin/env node
// Copies the shared pure-ESM core (src/lib/core/*.js, minus tests and the
// fixtures/ folder) into wa-bot/src/core/, so the bot — which is deployed
// on its own, without the app's src/ — runs the exact same stats / team
// draw / standings logic as the app.
//
//   node scripts/sync-core.mjs          write wa-bot/src/core/
//   node scripts/sync-core.mjs --check  exit 1 if wa-bot/src/core has drifted
//
// Output is always LF; comparisons ignore CRLF so Windows checkouts with
// core.autocrlf don't report false drift.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "lib", "core");
const DEST = join(ROOT, "wa-bot", "src", "core");
export const HEADER = "// GENERATED from src/lib/core — do not edit; run npm run sync:core\n";

const lf = (s) => s.replace(/\r\n/g, "\n");
const isCoreModule = (f) => f.endsWith(".js") && !f.endsWith(".test.js");

export function expectedFiles(srcDir = SRC) {
  return Object.fromEntries(
    readdirSync(srcDir, { withFileTypes: true })
      .filter((d) => d.isFile() && isCoreModule(d.name))
      .map((d) => [d.name, HEADER + lf(readFileSync(join(srcDir, d.name), "utf8"))]),
  );
}

function main() {
  const check = process.argv.includes("--check");
  const want = expectedFiles();
  const have = existsSync(DEST) ? readdirSync(DEST).filter((f) => f.endsWith(".js")) : [];
  const problems = [];
  for (const [name, content] of Object.entries(want)) {
    const path = join(DEST, name);
    if (!existsSync(path)) problems.push(`missing ${name}`);
    else if (lf(readFileSync(path, "utf8")) !== content) problems.push(`out of date ${name}`);
  }
  for (const name of have) if (!(name in want)) problems.push(`stale ${name}`);

  if (check) {
    if (problems.length) {
      console.error(`wa-bot/src/core is out of sync with src/lib/core:\n  ${problems.join("\n  ")}\nRun: npm run sync:core`);
      process.exit(1);
    }
    console.log(`wa-bot/src/core in sync (${Object.keys(want).length} files)`);
    return;
  }
  mkdirSync(DEST, { recursive: true });
  for (const name of have) if (!(name in want)) rmSync(join(DEST, name));
  for (const [name, content] of Object.entries(want)) writeFileSync(join(DEST, name), content);
  console.log(`synced ${Object.keys(want).length} files → wa-bot/src/core${problems.length ? ` (${problems.join(", ")})` : " (no changes)"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
