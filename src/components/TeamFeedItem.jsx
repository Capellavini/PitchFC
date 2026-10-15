import { CheckCircle2, Hourglass, Shield, UserPlus } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import TeamBadge from "./TeamBadge";
import Chip from "./Chip";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const OUTCOME = { W: RC.win, D: RC.draw, L: RC.loss };

/** A Home item about one of my teams (lib/rivals teamFeedItems and
 *  lib/rivalsResults matchFeedItems), always tagged with a team chip so it
 *  never reads as a group item:
 *  - team_invite: leader of a small squad → "Convidar jogadores" (lime);
 *  - team_joined / team_created: welcome line → "Abrir equipa";
 *  - result_confirm: the other team logged a result → "Rever resultado" (lime,
 *    action needed: it only counts once confirmed);
 *  - result_report: kickoff passed, nothing logged → "Registar resultado" (lime);
 *  - result_confirmed: official result of the last days → "Ver jogo". */
export default function TeamFeedItem({ item, onOpen, onInvite, onOpenMatch }) {
  const tm = item.team;
  const kind = item.kind;
  const match = kind.startsWith("result_");
  const invite = kind === "team_invite";
  const v = item.view;
  const oppName = item.opponent?.name || "";
  let title; let sub;
  if (match) {
    const mine = v?.open?.mine ?? v?.official?.mine;
    const theirs = v?.open?.theirs ?? v?.official?.theirs;
    if (kind === "result_confirm") { title = tf(MC.feedConfirmTitle, { opp: oppName, mine, theirs }); sub = t(MC.feedConfirmSub); }
    else if (kind === "result_report") { title = tf(MC.feedReportTitle, { opp: oppName }); sub = tf(MC.feedReportSub, { opp: oppName }); }
    else { title = tf(MC.feedDoneTitle, { outcome: t(OUTCOME[v.official.outcome]), opp: oppName, mine, theirs }); sub = t(MC.feedDoneSub); }
  } else {
    title = invite ? tf(RC.homeTeamInviteTitle, { team: tm.name }) : tf(kind === "team_created" ? RC.homeTeamCreated : RC.homeTeamJoined, { team: tm.name });
    sub = invite ? tf(RC.homeTeamInviteSub, { n: tm.memberCount ?? 1 }) : t(RC.homeTeamSub);
  }
  const action = invite || item.needsAction;
  const StatusIcon = kind === "result_confirmed" ? CheckCircle2 : kind === "result_confirm" || kind === "result_report" ? Hourglass : null;
  return (
    <div style={{ ...cardStyle, marginBottom: S.md, borderLeft: action ? `3px solid ${C.accent}` : cardStyle.border }}>
      <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
        <TeamBadge team={tm} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chip Icon={StatusIcon || Shield}>{tm.name}</Chip>
          <div style={{ fontSize: T.cardTitle - 1, fontWeight: 800, color: C.text1, marginTop: S.xs + 2, lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ marginTop: S.md }}>
        {invite ? <BtnPrimary block onClick={onInvite}><UserPlus size={18} /> {t(RC.invitePlayers)}</BtnPrimary>
          : match ? (item.needsAction
            ? <BtnPrimary block onClick={() => onOpenMatch?.(item.challengeId)}>{kind === "result_confirm" ? t(MC.feedConfirmCta) : t(MC.reportAction)}</BtnPrimary>
            : <BtnGhost block onClick={() => onOpenMatch?.(item.challengeId)}>{t(CC.openMatch)}</BtnGhost>)
            : <BtnGhost block onClick={onOpen}>{t(RC.openTeam)}</BtnGhost>}
      </div>
    </div>
  );
}
