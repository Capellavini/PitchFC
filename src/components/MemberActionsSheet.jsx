import { useState } from "react";
import { Crown, ShieldPlus, ShieldMinus, UserMinus } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError, tf } from "../lib/rivalsCopy";
import { can } from "../lib/rivals";
import Sheet from "./Sheet";
import BtnGhost from "./BtnGhost";

/** A leader's actions on one squad member: vice on/off and hand over the
 *  armband (captain), remove (captain; vice only for players). Armband
 *  and removal ask for a confirmation tap. */
export default function MemberActionsSheet({ teams, teamId, member, myRole, onClose, onDone }) {
  const [confirming, setConfirming] = useState(null); // "transfer" | "remove"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nick = member.nick || member.name || "—";

  const run = async (fn) => {
    setBusy(true); setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) setError(rivalsError(r.error)); else onDone?.();
  };

  const actions = [
    can(myRole, "setVice") && member.role === "player" && { id: "vice", Icon: ShieldPlus, label: t(RC.makeVice), go: () => run(() => teams.setMemberRole(teamId, member.playerId, "vice")) },
    can(myRole, "setVice") && member.role === "vice" && { id: "unvice", Icon: ShieldMinus, label: t(RC.removeVice), go: () => run(() => teams.setMemberRole(teamId, member.playerId, "player")) },
    can(myRole, "transfer") && { id: "transfer", Icon: Crown, label: t(RC.transferCaptaincy), go: () => setConfirming("transfer") },
    can(myRole, "remove", member.role) && { id: "remove", Icon: UserMinus, label: t(RC.removeMember), danger: true, go: () => setConfirming("remove") },
  ].filter(Boolean);

  return (
    <Sheet title={tf(RC.memberActions, { nick })} onClose={onClose}>
      {confirming ? (
        <div role="alert">
          <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, marginBottom: S.lg }}>
            {tf(confirming === "transfer" ? RC.transferConfirm : RC.removeConfirm, { nick })}
          </div>
          <div style={{ display: "flex", gap: S.sm }}>
            <BtnGhost tone={confirming === "remove" ? "danger" : "accent"} disabled={busy} style={{ flex: 1 }}
              onClick={() => run(() => (confirming === "transfer" ? teams.transferCaptaincy(teamId, member.playerId) : teams.removeMember(teamId, member.playerId)))}>
              {t(RC.confirm)}
            </BtnGhost>
            <BtnGhost style={{ flex: 1 }} onClick={() => setConfirming(null)}>{t(RC.cancel)}</BtnGhost>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          {actions.map(({ id, Icon, label, danger, go }) => (
            <BtnGhost key={id} block tone={danger ? "danger" : "neutral"} disabled={busy} onClick={go} style={{ justifyContent: "flex-start" }}>
              <Icon size={18} /> {label}
            </BtnGhost>
          ))}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginTop: S.md }}>{error}</div>}
    </Sheet>
  );
}
