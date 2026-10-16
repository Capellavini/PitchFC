import { t } from "../../lib/i18n";
import { STATE_LABEL, STATE_VARIANT } from "../../lib/leagueCopy";
import Chip from "../Chip";

/** Match state chip — every result shows whether it's provisional or
 *  homologated (brief §18). */
export default function LeagueStateChip({ state }) {
  return <Chip variant={STATE_VARIANT[state] || "neutral"}>{t(STATE_LABEL[state] || state)}</Chip>;
}
