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

// PITCH Ligas: the Adjunto's proposal catalog and request contract are shared with the app, so the
// WhatsApp side means exactly what the in-app chat means. They sit in wa-bot/src/leaguelib/ (a sibling
// of core/), so the one relative import into core is rewritten.
const LIB = join(ROOT, "src", "lib");
const LIB_DEST = join(ROOT, "wa-bot", "src", "leaguelib");
export const LEAGUE_LIB = ["leagueAdjuntoActions", "leagueAdjuntoRequest", "leagueAdjuntoPrivacy", "leagueSetup", "leagueSetupCopy", "leagueResults", "leagueModules"];
export const LIB_HEADER = "// GENERATED from src/lib — do not edit; run npm run sync:core\n";
export function expectedLeagueFiles(libDir = LIB) {
  return Object.fromEntries(LEAGUE_LIB.map((n) => [`${n}.js`, LIB_HEADER + lf(readFileSync(join(libDir, `${n}.js`), "utf8")).replace(/from "\.\/core\//g, 'from "../core/')]));
}

export function expectedFiles(srcDir = SRC) {
  return Object.fromEntries(
    readdirSync(srcDir, { withFileTypes: true })
      .filter((d) => d.isFile() && isCoreModule(d.name))
      .map((d) => [d.name, HEADER + lf(readFileSync(join(srcDir, d.name), "utf8"))]),
  );
}

function sync(want, dest, label, check) {
  const have = existsSync(dest) ? readdirSync(dest).filter((f) => f.endsWith(".js")) : [];
  const problems = [];
  for (const [name, content] of Object.entries(want)) {
    const path = join(dest, name);
    if (!existsSync(path)) problems.push(`missing ${name}`);
    else if (lf(readFileSync(path, "utf8")) !== content) problems.push(`out of date ${name}`);
  }
  for (const name of have) if (!(name in want)) problems.push(`stale ${name}`);

  if (check) {
    if (problems.length) {
      console.error(`${label} is out of sync:\n  ${problems.join("\n  ")}\nRun: npm run sync:core`);
      process.exit(1);
    }
    console.log(`${label} in sync (${Object.keys(want).length} files)`);
    return;
  }
  mkdirSync(dest, { recursive: true });
  for (const name of have) if (!(name in want)) rmSync(join(dest, name));
  for (const [name, content] of Object.entries(want)) writeFileSync(join(dest, name), content);
  console.log(`synced ${Object.keys(want).length} files → ${label}${problems.length ? ` (${problems.join(", ")})` : " (no changes)"}`);
}

function main() {
  const check = process.argv.includes("--check");
  sync(expectedFiles(), DEST, "wa-bot/src/core", check);
  sync(expectedLeagueFiles(), LIB_DEST, "wa-bot/src/leaguelib", check);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
