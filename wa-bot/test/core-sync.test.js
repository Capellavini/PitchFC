// wa-bot/src/core is GENERATED from the app's src/lib/core by
// scripts/sync-core.mjs. When the app sources are around (monorepo
// checkout, CI), require the copies to match byte-for-byte (header + LF
// content); in a standalone bot deploy there's nothing to compare, so skip.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP_CORE = fileURLToPath(new URL("../../src/lib/core/", import.meta.url));
const BOT_CORE = fileURLToPath(new URL("../src/core/", import.meta.url));
const HEADER = "// GENERATED from src/lib/core — do not edit; run npm run sync:core\n";
const lf = (s) => s.replace(/\r\n/g, "\n");
const modules = (dir) => readdirSync(dir).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js")).sort();

test("wa-bot/src/core matches src/lib/core", { skip: !existsSync(APP_CORE) && "app src/lib/core not present" }, () => {
  assert.deepEqual(modules(BOT_CORE), modules(APP_CORE), "file list differs — run npm run sync:core");
  for (const f of modules(APP_CORE)) {
    const want = HEADER + lf(readFileSync(APP_CORE + f, "utf8"));
    assert.equal(lf(readFileSync(BOT_CORE + f, "utf8")), want, `${f} drifted — run npm run sync:core`);
  }
});

test("bot copy of the core is importable and works", async () => {
  const { drawTeams } = await import("../src/core/teamDraw.js");
  const { computeTable } = await import("../src/core/standings.js");
  const { hashId } = await import("../src/core/ids.js");
  const players = ["Guarda-redes", "Guarda-redes", "Defesa", "Defesa", "Médio", "Médio", "Avançado", "Avançado"]
    .map((position, i) => ({ id: hashId(`p-${i}`), position }));
  const teams = drawTeams(players, 2);
  assert.equal(teams.flatMap((t) => t.players).length, 8);
  assert.equal(computeTable(["t1", "t2"], []).length, 2);
});
