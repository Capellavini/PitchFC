import { CalendarClock, MapPin } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t, getLang } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { formatKickoff } from "../lib/rivals";
import TeamBadge from "./TeamBadge";

const LOCALE = { pt: "pt-PT", "pt-br": "pt-BR", en: "en-GB" };

/**
 * One team match (from lib/rivals nextTeamMatch): my crest vs the
 * opponent, kickoff in the team's timezone, venue, format and a
 * countdown chip. `eyebrow` overrides the label (e.g. "HOJE HÁ JOGO").
 * Purely presentational — actions live in the parent.
 */
export default function TeamNextMatchCard({ match, eyebrow, children }) {
  if (!match) return null;
  const when = formatKickoff(match.kickoffAt, { timezone: match.timezone, locale: LOCALE[getLang()] || "pt-PT" });
  const countdown = match.isToday ? t(RC.today) : match.daysLeft === 1 ? t(RC.tomorrow) : tf(RC.inDays, { n: match.daysLeft });
  const opp = match.opponent;
  return (
    <div style={{ ...cardStyle, marginBottom: S.lg, borderLeft: `3px solid ${match.isToday ? C.accent : C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.md }}>
        <span style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", color: C.accent }}>{eyebrow || t(RC.nextTeamMatch)}</span>
        <span style={{ fontSize: T.meta, fontWeight: 800, color: match.isToday ? C.bg : C.text1, background: match.isToday ? C.accent : C.surface, borderRadius: 999, padding: "4px 10px" }}>{countdown}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <TeamBadge team={match.team} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.1, color: C.text1, overflowWrap: "anywhere" }}>{match.team.name}</div>
          <div style={{ fontSize: T.body, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>
            {opp?.name ? tf(RC.vsOpponent, { team: opp.name }) : t(RC.opponentTbd)}
          </div>
        </div>
        {opp?.name && <TeamBadge team={{ name: opp.name, color: opp.color, logoUrl: opp.logoUrl }} size={36} />}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: `${S.xs}px ${S.md}px`, marginTop: S.md, fontSize: T.meta + 1, color: C.text2 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CalendarClock size={14} aria-hidden /> {when}</span>
        {match.venue && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, overflowWrap: "anywhere" }}><MapPin size={14} aria-hidden /> {match.venue}</span>}
        {match.format && <span>{match.format}</span>}
      </div>
      {children}
    </div>
  );
}
