import { R } from "../../../theme";
import { safeLogo } from "../../../lib/leagueBrand";
import TeamCrest from "../../TeamCrest";

/** A team's emblem: its uploaded logo when it has one, else the crest in its colour. Decorative. */
export default function LandingTeamMark({ team, size = 28 }) {
  const logo = safeLogo(team?.logo);
  if (logo) return <img src={logo} alt="" aria-hidden style={{ width: size, height: size, objectFit: "contain", borderRadius: R.control / 3, flexShrink: 0 }} />;
  return <TeamCrest initials={(team?.short || team?.name || "?").slice(0, 2).toUpperCase()} color={/^#[0-9A-F]{6}$/i.test(team?.color || "") ? team.color : "#4895FF"} size={size} />;
}
