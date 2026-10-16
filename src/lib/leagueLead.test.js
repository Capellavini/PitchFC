// node --test src/lib/leagueLead.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueLeadPayload, leagueLeadValid, EMPTY_LEAGUE_LEAD } from "./leagueLead.js";

// Every key submit_lead() reads (supabase/migrations/20260101001100_leads.sql).
const RPC_KEYS = new Set(["name", "whatsapp", "email", "city", "role", "has_team", "team_name", "players_count", "modality", "best_day", "best_time", "interest", "message", "source"]);

test("payload only uses keys submit_lead() understands and keeps source=league", () => {
  const p = leagueLeadPayload({ ...EMPTY_LEAGUE_LEAD, name: " Ana ", email: "a@b.pt", league: " Liga X ", teams: "8", modality: "Futebol 7", city: "Porto", message: "Sábados" });
  for (const k of Object.keys(p)) assert.ok(RPC_KEYS.has(k), k);
  assert.equal(p.source, "league");
  assert.equal(p.name, "Ana");
  assert.equal(p.team_name, "Liga X");
  assert.equal(p.role, "Organizador de liga");
  assert.deepEqual(p.interest, ["Piloto de liga"]);
  assert.equal(p.message, "Liga: Liga X\nEquipas: 8\nSábados");
  assert.equal("players_count" in p, false); // never a non-integer / overloaded value
});

test("validation: name + league + (email or WhatsApp)", () => {
  const base = { ...EMPTY_LEAGUE_LEAD, name: "Ana", league: "Liga X" };
  assert.equal(leagueLeadValid(base), false);
  assert.equal(leagueLeadValid({ ...base, email: "a@b.pt" }), true);
  assert.equal(leagueLeadValid({ ...base, whatsapp: "+351912345678" }), true);
  assert.equal(leagueLeadValid({ ...base, league: " ", email: "a@b.pt" }), false);
});
