import { Link2 } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { currentTerms } from "../lib/rivalsChallenges";
import { kickoffLabel, termValue } from "../lib/challengeLabels";
import TeamBadge from "./TeamBadge";
import ChallengeStageLine from "./ChallengeStageLine";
import FieldStatusBadge from "./FieldStatusBadge";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const ACTION = {
  respond: CC.actRespond, review_change: CC.actReviewChange, confirm_field: CC.actConfirmField, share_link: CC.actShareLink,
  report_result: MC.actReportResult, confirm_result: MC.actConfirmResult,
};

/** One challenge in the inbox: opponent + crest, when, format, pitch (and
 *  its confirmation once agreed), where the negotiation stands, and ONE
 *  next action (lime only when it needs me). `item` = { ch, view }. */
export default function ChallengeCard({ item, onOpen }) {
  const { ch, view } = item;
  const terms = currentTerms(ch);
  const opp = view.opponent;
  const meta = [terms?.kickoffAt && kickoffLabel(terms.kickoffAt, terms.timezone), terms?.format, termValue("venueName", terms)].filter(Boolean).join(" · ");
  const label = t(ACTION[view.nextAction] || CC.actDetails);
  const showField = ch.match && ["agreed", "change_review", "change_waiting"].includes(view.stage);
  return (
    <div style={{ ...cardStyle, marginBottom: S.md, borderLeft: view.needsAction ? `3px solid ${C.accent}` : cardStyle.border }}>
      <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
        {opp ? <TeamBadge team={opp} size={44} /> : (
          <div aria-hidden style={{ width: 44, height: 44, borderRadius: R.control, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.text2, flexShrink: 0 }}>
            <Link2 size={18} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {opp?.name || t(CC.anyTeam)}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
        <ChallengeStageLine ch={ch} view={view} />
        {showField && <FieldStatusBadge status={ch.match.fieldStatus} />}
      </div>
      <div style={{ marginTop: S.md }}>
        {view.needsAction
          ? <BtnPrimary block onClick={onOpen}>{label}</BtnPrimary>
          : <BtnGhost block onClick={onOpen}>{label}</BtnGhost>}
      </div>
    </div>
  );
}
