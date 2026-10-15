import { Check, Clock, HelpCircle, MessageCircle, X } from "lucide-react";
import { C, S, T, AVATAR_PALETTE, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { personLabel } from "../lib/rivalsResults";
import { kickoffLabel } from "../lib/challengeLabels";
import { openWhatsApp } from "../lib/whatsapp";
import { useRivalsRead } from "../hooks/useRivalsRead";
import ListRow from "./ListRow";
import Avatar from "./Avatar";
import Chip from "./Chip";
import BtnGhost from "./BtnGhost";

const STATUS = {
  yes: { variant: "green", Icon: Check, label: MC.statusYes },
  maybe: { variant: "orange", Icon: HelpCircle, label: MC.statusMaybe },
  no: { variant: "red", Icon: X, label: MC.statusNo },
  pending: { variant: "neutral", Icon: Clock, label: MC.statusPending },
};
const ORDER = { yes: 0, maybe: 1, pending: 2, no: 3 };

/** Who answered the call-up of ONE match (own team only). Counts + one row
 *  per squad member, text + icon states. A leader gets "Lembrar quem falta":
 *  a WhatsApp message naming the pending players (no phone numbers are
 *  involved — they paste it in the team chat). Props: teams (useTeams),
 *  match (id, kickoffAt, timezone), team / opponent ({name}), leader. */
export default function AvailabilityList({ teams, match, team, opponent, leader = false }) {
  const { data, error, loading } = useRivalsRead(() => teams.getMatchAvailability(match.id), [match.id, teams.revision]);

  if (error) return <div role="alert" style={{ fontSize: T.meta + 1, color: C.red }}>{rivalsError(error)}</div>;
  if (!data) return <div aria-busy={loading} style={{ fontSize: T.meta + 1, color: C.text2 }}>{t(MC.loadingAnswers)}</div>;

  const rows = [...data.items].sort((a, b) => (ORDER[a.status || "pending"] - ORDER[b.status || "pending"]) || personLabel(a).localeCompare(personLabel(b), "pt"));
  const pending = rows.filter((r) => !r.status);
  const nudge = () => openWhatsApp(tf(MC.nudgeMessage, {
    names: pending.map(personLabel).join(", "), team: team?.name || "", opp: opponent?.name || "",
    when: kickoffLabel(match.kickoffAt, match.timezone), url: window.location.origin,
  }));

  return (
    <div>
      <div style={{ ...cardStyle, padding: `0 ${S.lg}px`, marginBottom: S.md }}>
        {rows.map((r, i) => {
          const s = STATUS[r.status || "pending"];
          return (
            <ListRow key={r.playerId} divider={i > 0}
              leading={<Avatar name={r.name || r.nick || "?"} photo={r.photoUrl} color={AVATAR_PALETTE[i % AVATAR_PALETTE.length]} size={36} />}
              title={personLabel(r)} meta={r.position ? t(r.position) : null}
              right={<Chip variant={s.variant} Icon={s.Icon}>{t(s.label)}</Chip>} />
          );
        })}
        {!rows.length && <div style={{ fontSize: T.meta + 1, color: C.text2, padding: `${S.md}px 0` }}>{t(MC.noAnswersYet)}</div>}
      </div>
      {leader && pending.length > 0 && (
        <BtnGhost block onClick={nudge}><MessageCircle size={16} color={C.whatsapp} aria-hidden /> {t(MC.nudgePending)} · {pending.length}</BtnGhost>
      )}
    </div>
  );
}
