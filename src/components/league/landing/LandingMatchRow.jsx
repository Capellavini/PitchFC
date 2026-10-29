import { C, R, S, T, displayFont } from "../../../theme";
import { t } from "../../../lib/i18n";
import { fmtKickoff } from "../../../lib/leagueDemo";
import LeagueStateChip from "../LeagueStateChip";
import LandingTeamMark from "./LandingTeamMark";

const side = (team, align) => (
  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: S.sm, flexDirection: align === "right" ? "row-reverse" : "row", textAlign: align }}>
    <LandingTeamMark team={team} size={26} />
    <span style={{ fontSize: T.body, fontWeight: 700, color: C.text1, minWidth: 0, lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{team?.name || "—"}</span>
  </div>
);

/** One game on the league page: date and ground, state, home — score — away. Read-only. */
export default function LandingMatchRow({ match, lang }) {
  const label = `${match.home?.name || "—"} – ${match.away?.name || "—"}`;
  return (
    <div role="group" aria-label={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.md, marginBottom: S.sm }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 600 }}>
          {match.kickoff ? fmtKickoff(match.kickoff, lang) : t("Data por definir")}{match.venue ? ` · ${match.venue}` : ""}
        </span>
        <LeagueStateChip state={match.state} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        {side(match.home, "left")}
        <div style={{ ...displayFont, fontSize: 20, minWidth: 56, textAlign: "center", color: match.score ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {match.score ? `${match.score.home}–${match.score.away}` : "vs"}
        </div>
        {side(match.away, "right")}
      </div>
    </div>
  );
}
