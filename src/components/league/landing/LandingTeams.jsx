import { C, R, S, T } from "../../../theme";
import { t } from "../../../lib/i18n";
import { tf } from "../../../lib/leagueCopy";
import LandingTeamMark from "./LandingTeamMark";

/** The teams of the league: emblem, name, ground. Read-only. */
export default function LandingTeams({ teams }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: S.sm }}>
      {teams.map((tm) => (
        <li key={tm.id} style={{ display: "flex", alignItems: "center", gap: S.md, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.md, minWidth: 0 }}>
          <LandingTeamMark team={tm} size={36} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: T.body, fontWeight: 800, overflowWrap: "anywhere", lineHeight: 1.2 }}>{tm.name}</span>
            <span style={{ display: "block", fontSize: T.meta, color: C.text2, overflowWrap: "anywhere" }}>
              {tm.venue ? tm.venue : ""}{tm.venue && tm.playerCount ? " · " : ""}{tm.playerCount ? tf(t("{n} atletas"), { n: tm.playerCount }) : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
