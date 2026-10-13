import { C, inkOn } from "../theme";
import { ini } from "../lib/helpers";

/** A Team's crest: the uploaded badge (logoUrl) or, without one, the
 *  team's initials on its primary kit colour with a secondary-colour ring.
 *  Team colours are user data read off the team row, never hardcoded. */
export default function TeamBadge({ team, size = 44 }) {
  const primary = team?.color || C.accent;
  const secondary = team?.secondaryColor || C.border;
  const radius = size * 0.32;
  if (team?.logoUrl) {
    return (
      <img src={team.logoUrl} alt="" style={{
        width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0,
        border: `2px solid ${secondary}`, background: C.surface, display: "block",
      }} />
    );
  }
  return (
    <div aria-hidden style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, boxSizing: "border-box",
      background: primary, border: `${Math.max(2, Math.round(size * 0.06))}px solid ${secondary}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: inkOn(primary), fontWeight: 900, fontStyle: "italic", fontSize: size * 0.34, letterSpacing: "-0.02em",
    }}>
      {ini(team?.name || "?")}
    </div>
  );
}
