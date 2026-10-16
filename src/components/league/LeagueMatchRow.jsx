import { Video } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { teamById, fmtKickoff } from "../../lib/leagueDemo";
import { LG } from "../../lib/leagueCopy";
import RivalsCrest from "../RivalsCrest";
import LeagueStateChip from "./LeagueStateChip";

const SHOWS_SCORE = new Set(["live", "ended_provisional", "in_review", "homologated", "walkover"]);

const side = (team, align) => {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: S.sm, flexDirection: align === "right" ? "row-reverse" : "row", textAlign: align }}>
      <RivalsCrest initials={team.short.slice(0, 2)} color={team.color} size={26} />
      <span style={{ fontSize: T.body, fontWeight: 700, color: C.text1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
    </div>
  );
}

/** One match as a tappable row: date · state, home — score — away. */
export default function LeagueMatchRow({ match, score, lang, onOpen, highlightTeamId }) {
  const home = teamById[match.homeId], away = teamById[match.awayId];
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
          {fmtKickoff(match.kickoff, lang)} · {match.venue}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: S.xs }}>
          {match.var?.enabled && <Video size={14} color={C.blue} aria-label={t(LG.varOn)} />}
          <LeagueStateChip state={match.state} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        {side(home, "left")}
        <div style={{ ...displayFont, fontSize: 20, minWidth: 56, textAlign: "center", color: showScore ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {showScore ? `${score.home}–${score.away}` : "vs"}
        </div>
        {side(away, "right")}
      </div>
    </button>
  );
}
