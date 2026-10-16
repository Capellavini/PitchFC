// /league pilot request → submit_lead() payload (pure, tested).
//
// The `leads` table predates leagues (columns: name, whatsapp, email,
// city, role, has_team, team_name, players_count, modality, best_day,
// best_time, interest[], message, source). Without a migration the
// organizer fields map onto it:
//   role       = "Organizador de liga"
//   team_name  = league name
//   interest   = ["Piloto de liga"]
//   message    = "Liga: …\nEquipas: N\n<free text>" (players_count stays
//                for players — not overloaded with a team count)
//   source     = "league" (unchanged, backward compatible)
export const LEAD_ROLE = "Organizador de liga";
export const LEAD_INTEREST = "Piloto de liga";

export const EMPTY_LEAGUE_LEAD = Object.freeze({ name: "", email: "", whatsapp: "", league: "", city: "", teams: "", modality: "", message: "" });

/** Required: name + league + (email or WhatsApp). */
export const leagueLeadValid = (f) => Boolean(f.name.trim() && f.league.trim() && (f.email.trim() || String(f.whatsapp || "").trim()));

export function leagueLeadPayload(f) {
  const teams = String(f.teams ?? "").trim();
  const lines = [
    f.league.trim() && `Liga: ${f.league.trim()}`,
    teams && `Equipas: ${teams}`,
    f.message.trim(),
  ].filter(Boolean);
  return {
    name: f.name.trim(), email: f.email.trim(), whatsapp: String(f.whatsapp || "").trim(), city: f.city.trim(),
    role: LEAD_ROLE, team_name: f.league.trim(), modality: f.modality,
    interest: [LEAD_INTEREST], message: lines.join("\n"), source: "league",
  };
}
