import { C, R, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tierOf } from "../../lib/leagueDemo";

const TIER_COLOR = () => ({ LENDA: C.legend, OURO: C.gold, PRATA: C.silver, BRONZE: C.bronze });

/** OVR pill in the FUT tier colour (same thresholds as FutCard:
 *  LENDA ≥86 · OURO ≥80 · PRATA ≥70 · BRONZE). */
export default function LeagueOvrChip({ ovr, size = "md" }) {
  const tier = tierOf(ovr);
  const color = TIER_COLOR()[tier];
  const h = size === "sm" ? 22 : 26;
  return (
    <span title={`${t(tier)} · OVR ${ovr}`} aria-label={`OVR ${ovr}`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: h + 10, height: h, padding: "0 6px",
      borderRadius: R.pill, border: `1px solid ${color}88`, background: `${color}1A`, color, boxSizing: "border-box",
      ...displayFont, fontSize: size === "sm" ? 12 : 14, flexShrink: 0,
    }}>{ovr}</span>
  );
}
