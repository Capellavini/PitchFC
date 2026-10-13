import { C, S, T, AVATAR_PALETTE, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import { can } from "../lib/rivals";
import ListRow from "./ListRow";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";

/** The active squad: captain, vice, then players. Leaders tap a member to
 *  open their actions (only members they may act on are tappable). */
export default function TeamRoster({ members = [], myRole, myId, onMemberAction }) {
  const actionable = (m) => m.playerId !== myId && (can(myRole, "setVice") || can(myRole, "remove", m.role));
  return (
    <div style={{ ...cardStyle, padding: `0 ${S.lg}px`, marginBottom: S.lg }}>
      {members.map((m, i) => {
        const roleWord = m.role === "captain" ? t(RC.roleCaptain) : m.role === "vice" ? t(RC.roleVice) : t(RC.rolePlayer);
        const name = m.nick || m.name || "—";
        return (
          <ListRow key={m.playerId} divider={i > 0}
            leading={<Avatar name={m.name || m.nick || "?"} photo={m.photoUrl} color={AVATAR_PALETTE[i % AVATAR_PALETTE.length]} size={40} isMe={m.playerId === myId} />}
            title={<>{name}{m.playerId === myId && <span style={{ color: C.text2, fontWeight: 600, fontSize: T.meta }}> {t(RC.you)}</span>}</>}
            meta={[roleWord, m.position ? t(m.position) : null].filter(Boolean).join(" · ")}
            right={<RoleBadge role={m.role} compact />}
            onClick={onMemberAction && actionable(m) ? () => onMemberAction(m) : undefined} />
        );
      })}
    </div>
  );
}
