// Treinador Adjunto — what may reach a WhatsApp GROUP. Only these
// template kinds, and only through groupCtx(), which rebuilds the context
// from scratch with names/nicks and the game row's public fields. Model
// text, OVRs, insights, performance gaps never get through (plan §13).

export const GROUP_SAFE_KINDS = Object.freeze(["adj_reminder", "open_spots", "teams_confirmed", "rescheduled"]);

const str = (s, max = 40) => String(s ?? "").replace(/[\r\n]+/g, " ").slice(0, max);
const nicks = (xs) => (Array.isArray(xs) ? xs : []).map((x) => str(x)).filter(Boolean).slice(0, 40);
const gameOf = (g) => ({ scheduled_at: g?.scheduled_at, venue: g?.venue ? str(g.venue, 60) : null });
const int = (n) => (Number.isInteger(n) ? n : 0);

/** Sanitised ctx for a group kind; throws on any other kind. */
export function groupCtx(kind, raw = {}) {
  switch (kind) {
    case "adj_reminder": return { game: gameOf(raw.game), confirmed: int(raw.confirmed), spots: int(raw.spots), pending: nicks(raw.pending) };
    case "open_spots": return { game: gameOf(raw.game), confirmed: int(raw.confirmed), spots: int(raw.spots), inviteLink: typeof raw.inviteLink === "string" && /^https:\/\//.test(raw.inviteLink) ? raw.inviteLink : null };
    case "teams_confirmed": return { teams: (raw.teams ?? []).slice(0, 6).map((t) => ({ name: str(t?.name), nicks: nicks(t?.nicks) })) };
    case "rescheduled": return { game: gameOf(raw.game) };
    default: throw new Error(`not a group-safe kind: ${kind}`);
  }
}
