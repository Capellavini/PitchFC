import { AlertCircle, Ban, CheckCircle2, Clock, Flag, Hourglass, Link2, XCircle } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";
import { CC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { kickoffLabel } from "../lib/challengeLabels";

/** Where a challenge stands, from my side: icon + sentence (colour is a
 *  bonus, the text carries the meaning). `view` = challengeView(). */
export default function ChallengeStageLine({ ch, view, live = false }) {
  const opp = view.opponent?.name || t(CC.anyTeam);
  const tz = view.myTeam?.timezone || ch.challenger?.timezone;
  const when = kickoffLabel(ch.expiresAt, tz);
  // After kickoff the line follows the shared RESULT (PR7); the score is shown from my side.
  const r = view.result;
  const sc = (x) => (x ? `${x.mine}–${x.theirs}` : "");
  const waiting = r?.byMe ? [Hourglass, C.text2, tf(MC.stageResultWaiting, { team: opp, score: sc(r?.open) })]
    : [AlertCircle, C.orange, tf(MC.stageResultRespond, { team: opp, score: sc(r?.open) })];
  const kickedLine = r && {
    ready: r.canReport ? [AlertCircle, C.orange, t(MC.stageResultReadyLeader)] : [Flag, C.text2, t(MC.stageResultReady)],
    reported: waiting, disputed: waiting, correction: waiting,
    confirmed: [CheckCircle2, C.green, tf(MC.stageResultDone, { score: sc(r.official) })],
    not_played: [Ban, C.text2, t(MC.stageNotPlayed)],
  }[r.phase];
  const s = {
    respond: [AlertCircle, C.orange, tf(CC.stageRespond, { when })],
    awaiting: [Hourglass, C.text2, tf(CC.stageAwaiting, { team: opp })],
    open_link: [Link2, C.text2, t(CC.stageOpenLink)],
    change_review: [AlertCircle, C.orange, t(CC.stageChangeReview)],
    change_waiting: [Hourglass, C.text2, t(CC.stageChangeWaiting)],
    agreed: [CheckCircle2, C.green, t(CC.stageAgreed)],
    kicked_off: kickedLine || [Flag, C.text2, t(CC.stageKickedOff)],
    match_cancelled: [XCircle, C.red, t(CC.stageMatchCancelled)],
    declined: [XCircle, C.red, t(CC.stageDeclined)],
    cancelled: [Ban, C.text2, t(CC.stageCancelled)],
    expired: [Clock, C.text2, t(CC.stageExpired)],
  }[view.stage] || [Clock, C.text2, ""];
  const [Icon, color, text] = s;
  return (
    <div role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}
      style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.meta + 1, fontWeight: 700, color, minWidth: 0 }}>
      <Icon size={15} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}
