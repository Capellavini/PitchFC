import { Video } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { teamById as DEMO_TEAMS, fmtKickoff } from "../../lib/leagueDemo";
import { LG } from "../../lib/leagueCopy";
import TeamCrest from "../TeamCrest";
import LeagueStateChip from "./LeagueStateChip";

const SHOWS_SCORE = new Set(["live", "ended_provisional", "in_review", "homologated", "walkover", "abandoned"]);

const side = (team, align) => {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: S.sm, flexDirection: align === "right" ? "row-reverse" : "row", textAlign: align }}>
      <TeamCrest initials={(team.short || "?").slice(0, 2)} color={team.color} size={26} />
      <span style={{ fontSize: T.body, fontWeight: 700, color: C.text1, minWidth: 0, lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{team.name}</span>
    </div>
  );
}

/** One match as a tappable row: date · state, home — score — away.
 *  `dir` (cloud leagues): { teamById } of the competition; demo default. */
export default function LeagueMatchRow({ match, score, lang, onOpen, highlightTeamId, dir = null }) {
  const teamById = dir?.teamById || DEMO_TEAMS;
  const unknown = { name: "—", short: "?", color: null };
  const home = teamById[match.homeId] || unknown, away = teamById[match.awayId] || unknown;
  const showScore = SHOWS_SCORE.has(match.state);
  const mine = highlightTeamId && (match.homeId === highlightTeamId || match.awayId === highlightTeamId);
  return (
    <button type="button" onClick={() => onOpen(match.id)}
      aria-label={`${home.name} – ${away.name}`}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer", display: "block", boxSizing: "border-box",
        background: C.card, border: `1px solid ${mine ? C.accentBorder : C.border}`, borderRadius: R.card,
        padding: `${S.md}px ${S.md}px`, marginBottom: S.sm, minHeight: TOUCH.min, color: C.text1,
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 600 }}>
          {match.kickoff ? fmtKickoff(match.kickoff, lang) : t("Data por definir")}{match.venue ? ` · ${match.venue}` : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: S.xs }}>
          {match.var?.enabled && <Video size={14} color={C.blue} aria-label={t(LG.varOn)} />}
          <LeagueStateChip state={match.state} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        {side(home, "left")}
        <div style={{ ...displayFont, fontSize: 20, minWidth: 56, textAlign: "center", color: showScore ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {showScore && score && score.home != null ? `${score.home}–${score.away}` : "vs"}
        </div>
        {side(away, "right")}
      </div>
    </button>
  );
}
