import { t } from "../../lib/i18n";
import { STATE_LABEL, STATE_VARIANT } from "../../lib/leagueCopy";
import Chip from "./visual/Chip";

/** Match state chip — every result shows whether it's provisional or
 *  homologated (brief §18). */
export default function LeagueStateChip({ state, light = false }) {
  if (light) return <span className="pl-public-state" data-state={state}>{t(STATE_LABEL[state] || state)}</span>;
  return <Chip variant={STATE_VARIANT[state] || "neutral"}>{t(STATE_LABEL[state] || state)}</Chip>;
}
