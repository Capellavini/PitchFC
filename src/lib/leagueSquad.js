// PITCH Ligas — the captain's squad editor, as pure functions: rows ↔ players, what is wrong
// with the rows, what is sent to the server and whether anything changed. The server
// (league_captain_save_squad) re-checks everything; this only spares a round trip.

const pad = (n) => (n === null || n === undefined ? "" : String(n));

/** Editor rows from the team's players (stable key per row, id kept so history survives). */
export const draftFromPlayers = (players = []) =>
  players.map((p) => ({ key: p.id, id: p.id, name: p.name || "", number: pad(p.number), position: p.position || "", captain: Boolean(p.captain) }));

/** What is wrong with the rows, as PT-PT sentences (empty = can be saved). */
export function squadProblems(rows = []) {
  const out = [];
  if (rows.some((r) => !String(r.name).trim())) out.push("Há atletas sem nome.");
  const nums = rows.map((r) => String(r.number).trim()).filter(Boolean);
  if (nums.some((n) => !/^\d{1,2}$/.test(n))) out.push("O número tem de estar entre 0 e 99.");
  if (new Set(nums).size !== nums.length) out.push("Dois atletas têm o mesmo número.");
  if (rows.length > 40) out.push("O plantel pode ter no máximo 40 atletas.");
  return out;
}

/** The array the server takes: existing athletes keep their id, new ones have none. */
export const squadPayload = (rows = []) =>
  rows.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    name: String(r.name).trim(), number: String(r.number).trim() === "" ? null : Number(r.number),
    position: String(r.position).trim(), captain: Boolean(r.captain),
  }));

const sig = (list) => JSON.stringify(list.map((r) => [r.id || "", String(r.name).trim(), String(r.number).trim(), String(r.position).trim(), Boolean(r.captain)]));
/** True when the rows differ from the saved players (order included). */
export const isSquadDirty = (rows, players) => sig(rows) !== sig(draftFromPlayers(players));
