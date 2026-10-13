import { Shield, UserPlus } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";
import Chip from "./Chip";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/** A Home item about one of my teams (lib/rivals teamFeedItems), always
 *  tagged with a team chip so it never reads as a group item:
 *  - team_invite: leader of a small squad → "Convidar jogadores" (lime);
 *  - team_joined / team_created: welcome line → "Abrir equipa".
 *  EXTENSION POINT (PR7): next team match + inline RSVP, results. */
export default function TeamFeedItem({ item, onOpen, onInvite }) {
  const tm = item.team;
  const invite = item.kind === "team_invite";
  const title = invite ? tf(RC.homeTeamInviteTitle, { team: tm.name })
    : tf(item.kind === "team_created" ? RC.homeTeamCreated : RC.homeTeamJoined, { team: tm.name });
  const sub = invite ? tf(RC.homeTeamInviteSub, { n: tm.memberCount ?? 1 }) : t(RC.homeTeamSub);
  return (
    <div style={{ ...cardStyle, marginBottom: S.md, borderLeft: invite ? `3px solid ${C.accent}` : cardStyle.border }}>
      <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
        <TeamBadge team={tm} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chip Icon={Shield}>{tm.name}</Chip>
          <div style={{ fontSize: T.cardTitle - 1, fontWeight: 800, color: C.text1, marginTop: S.xs + 2, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ marginTop: S.md }}>
        {invite
          ? <BtnPrimary block onClick={onInvite}><UserPlus size={18} /> {t(RC.invitePlayers)}</BtnPrimary>
          : <BtnGhost block onClick={onOpen}>{t(RC.openTeam)}</BtnGhost>}
      </div>
    </div>
  );
}
