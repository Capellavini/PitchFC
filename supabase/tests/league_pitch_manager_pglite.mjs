// Executes supabase/migrations/20261105150000_league_pitch_manager.sql in an in-process Postgres (PGlite) with stubs for
// auth.uid(), league_workspaces and league_workspace_members, then checks rounds, access, validation, the lock at
// kick-off, ownership counts, module switch and grants. Not part of CI (the repo has no Postgres service):
//   npm i --no-save @electric-sql/pglite && node supabase/tests/league_pitch_manager_pglite.mjs
// The path of the migration may be passed as the first argument (default: the file above).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const mig = fs.readFileSync(process.argv[2] || new URL("../migrations/20261105150000_league_pitch_manager.sql", import.meta.url), "utf8");
const db = new PGlite();
const A = "00000000-0000-0000-0000-00000000000a"; // owner
const B = "00000000-0000-0000-0000-00000000000b"; // member
const C = "00000000-0000-0000-0000-00000000000c"; // outsider

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
insert into auth.users values ('${A}'), ('${B}'), ('${C}');
create table public.league_workspaces (id uuid primary key default gen_random_uuid(), owner_user_id uuid not null unique references auth.users(id), state jsonb not null);
create table public.league_workspace_members (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.league_workspaces(id), user_id uuid references auth.users(id), role text, status text default 'active');
`);
await db.exec(mig);
// idempotent re-run
await db.exec(mig);

const past = "2020-01-01T20:00:00";
const future = "2099-01-01T20:00:00";
const state = (fantasy) => JSON.stringify({
  modules: fantasy === undefined ? {} : { fantasy },
  matches: [
    { id: "m1", competitionId: "c1", round: 1, kickoff: past, state: "homologated" },
    { id: "m2", competitionId: "c1", round: 1, kickoff: "2020-01-01T22:00:00", state: "homologated" },
    { id: "m3", competitionId: "c1", round: 2, kickoff: future, state: "scheduled" },
    { id: "m4", competitionId: "cup", round: 1, kickoff: "2019-01-01T20:00:00", state: "homologated" },
    { id: "m5", competitionId: "c1", round: 3, kickoff: "2099-02-01T20:00:00", state: "cancelled" },
    { id: "m6", competitionId: "c1", round: "x", kickoff: past, state: "scheduled" },
  ],
  data: {
    competitions: [{ id: "c1", kind: "league" }, { id: "cup", kind: "cup" }],
    players: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map((id) => ({ id, teamId: "t1" })),
  },
});
const ws = (await db.query(`insert into public.league_workspaces (owner_user_id, state) values ('${A}', '${state(true)}') returning id`)).rows[0].id;
await db.exec(`insert into public.league_workspace_members (workspace_id, user_id, role) values ('${ws}', '${B}', 'captain')`);

const as = async (uid) => db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
let fails = 0;
const ok = (name, cond, detail) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : "  → " + JSON.stringify(detail)}`); if (!cond) fails++; };
const call = async (sql, params = []) => { try { const r = await db.query(sql, params); return { data: r.rows[0] && Object.values(r.rows[0])[0] }; } catch (e) { return { error: e.message }; } };

const good = { player_ids: ["p1", "p2", "p3", "p4", "p5", "p6"], reserve_ids: ["p6"], captain_id: "p1", vice_captain_id: "p2", prices_paid: { p1: 10, p9: 5, p2: "x" }, connection: { creator_id: "p1", finisher_id: "p2" } };

// rounds from the state
await db.exec(`reset role`);
const rounds = (await db.query(`select public.league_pm_rounds(state) r from public.league_workspaces where id='${ws}'`)).rows[0].r;
ok("rounds: 2 league rounds (cup/cancelled/bad row skipped)", rounds.length === 2 && rounds[0].round === 1 && rounds[1].round === 2, rounds);
ok("round 1 kickoff = earliest match (Lisbon, winter = UTC)", rounds[0].kickoff_at.startsWith("2020-01-01 20:00:00"), rounds[0]);

await as(C);
let r = await call(`select public.league_pm_board($1)`, [ws]);
ok("outsider forbidden", r.error?.includes("league:forbidden"), r);
await as(null);
r = await call(`select public.league_pm_board($1)`, [ws]);
ok("anon not authenticated", r.error?.includes("not_authenticated"), r);

await as(A);
r = await call(`select public.league_pm_board(null)`);
ok("owner board (null = own league) enabled, no squad", r.data?.enabled === true && r.data.mine === null && r.data.locks.length === 1, r);
ok("round 1 locked empty on first read", r.data?.locks?.[0]?.round === 1 && Object.keys(r.data.locks[0].lineups).length === 0, r.data?.locks);

r = await call(`select public.league_pm_save_squad($1, $2::jsonb, $3)`, [null, JSON.stringify(good), "Os Gestores"]);
ok("save ok", r.data?.saved === true, r);
ok("prices_paid sanitized (unknown id + non-number dropped)", JSON.stringify(r.data?.squad?.prices_paid) === '{"p1": 10}' || JSON.stringify(r.data?.squad?.prices_paid) === '{"p1":10}', r.data?.squad?.prices_paid);
ok("connection stored", r.data?.squad?.connection?.finisher_id === "p2", r.data?.squad);

for (const [name, sq, needle] of [
  ["unknown athlete", { ...good, player_ids: ["p1", "zz"], reserve_ids: [] }, "pm_unknown_athlete"],
  ["duplicates", { ...good, player_ids: ["p1", "p1"], reserve_ids: [] }, "pm_invalid"],
  ["captain on bench", { ...good, captain_id: "p6", connection: null }, "pm_invalid"],
  ["vice = captain", { ...good, vice_captain_id: "p1", connection: null }, "pm_invalid"],
  ["6 starters", { player_ids: ["p1", "p2", "p3", "p4", "p5", "p6"], reserve_ids: [], captain_id: null, vice_captain_id: null }, "pm_invalid"],
  ["connection same player", { ...good, connection: { creator_id: "p1", finisher_id: "p1" } }, "pm_connection_invalid"],
  ["connection bench player", { ...good, connection: { creator_id: "p1", finisher_id: "p6" } }, "pm_connection_invalid"],
  ["not an object", [1, 2], "pm_invalid"],
]) {
  r = await call(`select public.league_pm_save_squad($1, $2::jsonb, 'x')`, [ws, JSON.stringify(sq)]);
  ok(`reject: ${name}`, r.error?.includes(needle), r);
}

// member plays too, round 1 already locked (empty lineup — nobody had a squad), edit goes to the NEXT round
await as(B);
r = await call(`select public.league_pm_save_squad($1, $2::jsonb, $3)`, [ws, JSON.stringify({ player_ids: ["p1", "p2", "p3", "p4", "p5"], reserve_ids: [], captain_id: "p3", vice_captain_id: null }), "Capitães"]);
ok("member saves", r.data?.saved === true, r);
r = await call(`select public.league_pm_board($1)`, [ws]);
ok("member sees ownership counts of OTHERS only (p1 owned by owner)", r.data?.ownership?.p1 === 1 && r.data?.ownership?.p3 === 1 && r.data?.ownership?.p6 === 1, r.data?.ownership);
ok("member board lists both managers", r.data?.managers?.length === 2, r.data?.managers);
ok("round 1 lock still empty (edits came after the kick-off)", Object.keys(r.data?.locks?.[0]?.lineups || {}).length === 0, r.data?.locks);

// make round 2 kick off now → snapshot with both squads, later edit doesn't leak
await db.exec(`update public.league_workspaces set state = jsonb_set(state, '{matches,2,kickoff}', '"2020-02-01T20:00:00"') where id='${ws}'`);
await as(A);
r = await call(`select public.league_pm_board(null)`);
const lock2 = r.data?.locks?.find((l) => l.round === 2);
ok("round 2 locked with both lineups", lock2 && Object.keys(lock2.lineups).length === 2, r.data?.locks);
ok("snapshot carries name + squad + Conexão", lock2?.lineups?.[A]?.name === "Os Gestores" && lock2.lineups[A].squad.connection?.creator_id === "p1", lock2?.lineups?.[A]);
await call(`select public.league_pm_save_squad(null, $1::jsonb, 'Os Gestores')`, [JSON.stringify({ player_ids: ["p7"], reserve_ids: [], captain_id: "p7", vice_captain_id: null })]);
r = await call(`select public.league_pm_board(null)`);
const lock2b = r.data?.locks?.find((l) => l.round === 2);
ok("edit after lock never changes the snapshot", JSON.stringify(lock2b.lineups[A].squad.player_ids) === JSON.stringify(lock2.lineups[A].squad.player_ids), lock2b.lineups[A]);
ok("…but my current squad is the new one", JSON.stringify(r.data?.mine?.player_ids) === '["p7"]', r.data?.mine);

// module off
await db.exec(`update public.league_workspaces set state = jsonb_set(state, '{modules,fantasy}', 'false') where id='${ws}'`);
r = await call(`select public.league_pm_board(null)`);
ok("module off → enabled false", r.data?.enabled === false, r);
r = await call(`select public.league_pm_save_squad(null, $1::jsonb, 'x')`, [JSON.stringify(good)]);
ok("module off → save refused", r.error?.includes("module_off"), r);

// direct table access closed to API roles
await db.exec(`reset role`);
r = await call(`select has_table_privilege('authenticated', 'public.league_pm_squads', 'select') or has_table_privilege('anon', 'public.league_pm_locks', 'select')`);
ok("no direct table access for authenticated/anon", r.data === false, r);
r = await call(`select has_function_privilege('authenticated', 'public.league_pm_board(uuid)', 'execute') and has_function_privilege('authenticated', 'public.league_pm_save_squad(uuid, jsonb, text)', 'execute') and not has_function_privilege('authenticated', 'public.league_pm_lock_due(uuid)', 'execute') and not has_function_privilege('anon', 'public.league_pm_board(uuid)', 'execute')`);
ok("execute grants: board/save only, to authenticated only", r.data === true, r);

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
