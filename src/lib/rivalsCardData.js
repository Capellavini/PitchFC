// ─────────────────────────────────────────────────────────
// PITCH Rivals — what the share cards show (PR9). Pure: no canvas, no React,
// no i18n — the renderers in rivalsCards.js translate and draw. Everything
// here comes from CONFIRMED data only: a provisional score never reaches a card.
// ─────────────────────────────────────────────────────────

import { hasPlayed, teamMilestones } from "./rivals.js";

export const MAX_SCORERS_PER_SIDE = 4;
export const MAX_CARD_MILESTONES = 4;

const side = (tm) => ({
  id: tm?.id ?? null, name: tm?.name || "—", color: tm?.color || null, secondaryColor: tm?.secondaryColor || null, logoUrl: tm?.logoUrl || null,
});

/** Goal scorers of one team out of get_match_player_stats items: best first, capped, with the overflow count. */
export function scorersOf(items, teamId, max = MAX_SCORERS_PER_SIDE) {
  const all = (items || [])
    .filter((r) => r.teamId === teamId && Number(r.goals) > 0)
    .map((r) => ({ nick: r.nick || "—", goals: Number(r.goals) }))
    .sort((a, b) => (b.goals - a.goals) || a.nick.localeCompare(b.nick, "pt"));
  return { list: all.slice(0, max), more: Math.max(0, all.length - max) };
}

/**
 * The confirmed-result card of one match. `ch` = a normalised challenge with
 * its match; `stats` = get_match_player_stats items; `h2h` = normH2H (played
 * includes this match). → null unless the result is OFFICIAL (confirmed by
 * both teams). Home is the challenger, as everywhere in Rivals.
 */
export function resultCardData(ch, { stats = [], h2h = null } = {}) {
  const m = ch?.match;
  if (!m || m.officialHomeScore == null || m.officialAwayScore == null || m.resultStatus !== "confirmed") return null;
  const byId = new Map([[ch.challenger?.id, ch.challenger], [ch.challenged?.id, ch.challenged]]);
  const home = byId.get(m.homeTeamId) ?? ch.challenger;
  const away = byId.get(m.awayTeamId) ?? ch.challenged;
  const hs = Number(m.officialHomeScore);
  const as = Number(m.officialAwayScore);
  return {
    home: side(home), away: side(away), homeScore: hs, awayScore: as,
    winner: hs > as ? "home" : hs < as ? "away" : "draw",
    kickoffAt: m.kickoffAt, timezone: m.timezone || "Europe/Lisbon",
    venue: m.venueName || null, format: m.format || null,
    scorers: { home: scorersOf(stats, home?.id), away: scorersOf(stats, away?.id) },
    // "Confronto #N" is only worth showing from the second meeting on
    confrontoN: h2h && Number(h2h.played) >= 2 ? Number(h2h.played) : null,
  };
}

/**
 * The team card: identity, confirmed record, form, top scorers/assisters and
 * the milestones reached. `detail` = what useTeams.fetchTeam / fetchPublicTeam
 * return ({ team, record, topScorers, topAssisters, members?, memberCount? }).
 */
export function teamCardData(detail) {
  const team = detail?.team;
  if (!team) return null;
  const record = detail.record;
  const played = hasPlayed(record);
  return {
    team: { ...side(team), city: team.city || team.region || null, format: team.format || null },
    memberCount: Number(detail.memberCount ?? detail.members?.length ?? 0),
    played,
    record: played ? {
      played: record.played, wins: record.wins, draws: record.draws, losses: record.losses,
      goalsFor: record.goalsFor, goalsAgainst: record.goalsAgainst, goalDiff: record.goalDiff,
      cleanSheets: record.cleanSheets, streak: record.streak, form: (record.form || []).slice(0, 5),
    } : null,
    scorers: (detail.topScorers || []).filter((p) => p.n > 0).slice(0, 3),
    assisters: (detail.topAssisters || []).filter((p) => p.n > 0).slice(0, 3),
    milestones: played ? teamMilestones(record).slice(0, MAX_CARD_MILESTONES) : [],
  };
}

/** File names for the downloads (ascii slug of the teams). */
const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "equipa";
export const resultCardFile = (d) => `pitch-rivals-${slug(d.home.name)}-${d.homeScore}-${d.awayScore}-${slug(d.away.name)}.png`;
export const teamCardFile = (d) => `pitch-rivals-${slug(d.team.name)}.png`;
