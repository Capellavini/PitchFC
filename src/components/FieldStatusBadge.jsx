import { CheckCircle2, CircleHelp, CircleSlash } from "lucide-react";
import { t } from "../lib/i18n";
import { CC } from "../lib/rivalsCopy";
import Chip from "./Chip";

const MAP = {
  confirmed: { Icon: CheckCircle2, variant: "green", label: CC.fieldConfirmed },
  unavailable: { Icon: CircleSlash, variant: "red", label: CC.fieldUnavailable },
  unconfirmed: { Icon: CircleHelp, variant: "orange", label: CC.fieldUnconfirmed },
};

/** The pitch's state, separate from the negotiation: icon + text + colour
 *  (never colour alone). Accepting a challenge never books the pitch. */
export default function FieldStatusBadge({ status = "unconfirmed" }) {
  const m = MAP[status] || MAP.unconfirmed;
  return <Chip Icon={m.Icon} variant={m.variant}>{t(m.label)}</Chip>;
}
