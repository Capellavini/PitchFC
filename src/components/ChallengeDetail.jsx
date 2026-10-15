import { useState } from "react";
import { Ban, Check, MessageCircle, Repeat, X } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RIVALS_BRAND, rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { challengeInviteUrl, challengeView, previousTerms, versionOf, diffTerms } from "../lib/rivalsChallenges";
import { kickoffLabel, termValue } from "../lib/challengeLabels";
import { openWhatsApp } from "../lib/whatsapp";
import BackHeader from "./BackHeader";
import SectionLabel from "./SectionLabel";
import TeamBadge from "./TeamBadge";
import ChallengeStageLine from "./ChallengeStageLine";
import HeadToHead from "./HeadToHead";
import ChallengeTerms from "./ChallengeTerms";
import ChallengeTimeline from "./ChallengeTimeline";
import ChallengeComposer from "./ChallengeComposer";
import ChallengeShareActions from "./ChallengeShareActions";
import ReasonConfirm from "./ReasonConfirm";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * One challenge (pushed screen inside Competir → Desafios): both crests,
 * where it stands (aria-live), the current terms with "mudou" markers vs
 * the version it answers, the ONE next action for my role (answer:
 * aceitar / contrapropor / recusar; share the link; open the match), and
 * the immutable version timeline. Plain members see it read-only.
 */
export default function ChallengeDetail({ teams, challengeId, onBack, onOpenMatch }) {
  const ch = teams.challenges.find((c) => c.id === challengeId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null); // decline | cancel
  const [countering, setCountering] = useState(false);

  if (!ch) {
    return (
      <div>
        <BackHeader title={t(CC.detailTitle)} onBack={onBack} />
        <div role="alert" style={{ fontSize: T.body, color: C.text2 }}>{rivalsError("challenge_not_found")}</div>
      </div>
    );
  }
  const view = challengeView(ch);
  const sides = { challenger: ch.challenger, challenged: ch.challenged };
  const cur = versionOf(ch, ch.currentVersion);
  const shown = ch.match && view.stage !== "change_review" && view.stage !== "change_waiting" ? null : cur;
  const prev = shown ? previousTerms(ch, shown.version) : null;
  const pending = view.status === "pending";
  const tz = cur?.timezone;

  const run = async (fn, okText) => {
    setBusy(true); setError(null); setNotice(null);
    const r = await fn();
    setBusy(false);
    setConfirm(null);
    if (r.error) { setError(rivalsError(r.error)); return null; }
    if (okText) setNotice(t(okText));
    return r.data;
  };
  const accept = async () => {
    const d = await run(() => teams.respondChallenge(ch.id, ch.currentVersion, "accept", { asTeamId: ch.myTeamId }), CC.acceptedToast);
    if (d?.matchId) onOpenMatch?.(ch.id);
  };
  const shareUrl = ch.token ? challengeInviteUrl(ch.token, window.location.origin) : null;
  const shareMsg = cur && tf(ch.challenged ? CC.challengeMessage : CC.openLinkMessage, {
    team: ch.challenger?.name, when: kickoffLabel(cur.kickoffAt, tz), venue: termValue("venueName", cur), url: shareUrl,
  });

  return (
    <div>
      <BackHeader title={t(CC.detailTitle)} subtitle={RIVALS_BRAND} onBack={onBack} />

      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm }}>
          {[ch.challenger, ch.challenged].map((tm, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, textAlign: "center", order: i ? 2 : 0 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: S.xs }}>
                {tm ? <TeamBadge team={tm} size={52} /> : <div aria-hidden style={{ width: 52, height: 52, borderRadius: 17, border: `1px dashed ${C.border}` }} />}
              </div>
              <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, overflowWrap: "anywhere" }}>{tm?.name || t(CC.anyTeam)}</div>
            </div>
          ))}
          <div aria-hidden style={{ order: 1, fontSize: T.meta, fontWeight: 900, color: C.text2 }}>VS</div>
        </div>
        <div style={{ marginTop: S.md, display: "flex", justifyContent: "center" }}>
          <ChallengeStageLine ch={ch} view={view} live />
        </div>
        {pending && cur && (
          <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.xs }}>
            {view.myTurn ? tf(CC.answerBy, { when: kickoffLabel(ch.expiresAt, tz) })
              : ch.challenged ? tf(CC.waitingFor, { team: view.opponent?.name || "", when: kickoffLabel(ch.expiresAt, tz) }) : null}
          </div>
        )}
        {ch.reason && ["declined", "cancelled"].includes(view.status) && (
          <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.xs }}>{tf(CC.reasonLine, { reason: ch.reason })}</div>
        )}
        {/* "Confronto #N" — what the two teams have already played (confirmed results only) */}
        {view.opponent?.id && view.myTeam?.id && <HeadToHead compact teams={teams} teamId={view.myTeam.id} opponent={view.opponent} />}
      </div>

      <div aria-live="polite">
        {notice && <div role="status" style={{ fontSize: T.body, color: C.green, fontWeight: 700, marginBottom: S.md }}>{notice}</div>}
        {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}
      </div>

      {/* The ONE next action for me */}
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginBottom: S.lg }}>
        {view.nextAction === "respond" && (
          <>
            <BtnPrimary block onClick={accept} disabled={busy}><Check size={18} aria-hidden /> {t(CC.accept)}</BtnPrimary>
            <div style={{ display: "flex", gap: S.sm }}>
              <BtnGhost onClick={() => setCountering(true)} disabled={busy} style={{ flex: 1 }}><Repeat size={16} aria-hidden /> {t(CC.counter)}</BtnGhost>
              <BtnGhost tone="danger" onClick={() => setConfirm("decline")} disabled={busy} style={{ flex: 1 }}><X size={16} aria-hidden /> {t(CC.decline)}</BtnGhost>
            </div>
            {confirm === "decline" && (
              <ReasonConfirm text={t(CC.declineConfirm)} confirmLabel={t(CC.decline)} busy={busy} onCancel={() => setConfirm(null)}
                onConfirm={(reason) => run(() => teams.respondChallenge(ch.id, ch.currentVersion, "decline", { asTeamId: ch.myTeamId, reason }), CC.declinedToast)} />
            )}
          </>
        )}
        {view.nextAction === "wait" && !view.leader && (pending || view.stage === "change_review") && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{t(CC.askCaptainToAnswer)}</div>
        )}
        {ch.match && (
          <BtnPrimary block onClick={() => onOpenMatch?.(ch.id)}>{{
            review_change: t(CC.actReviewChange), confirm_field: t(CC.actConfirmField),
            report_result: t(MC.actReportResult), confirm_result: t(MC.actConfirmResult),
          }[view.nextAction] || t(CC.openMatch)}</BtnPrimary>
        )}
      </div>

      {shown && (
        <>
          <SectionLabel>{t(CC.terms)}</SectionLabel>
          <div style={{ ...cardStyle, marginBottom: S.lg, paddingTop: S.sm, paddingBottom: S.sm }}>
            <ChallengeTerms terms={shown} teams={sides} changed={prev ? diffTerms(prev, shown) : []} />
          </div>
        </>
      )}

      {pending && view.side === "challenger" && view.leader && shareUrl && (
        <div style={{ marginBottom: S.lg }}>
          <SectionLabel>{t(CC.actShareLink)}</SectionLabel>
          <ChallengeShareActions url={shareUrl} message={shareMsg} />
        </div>
      )}

      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.xl }}>
        {cur && (
          <BtnGhost onClick={() => openWhatsApp(tf(CC.talkMessage, { when: kickoffLabel(cur.kickoffAt, tz) }))} style={{ flex: "1 1 160px" }}>
            <MessageCircle size={16} aria-hidden /> {t(CC.talkWhatsApp)}
          </BtnGhost>
        )}
        {pending && view.leader && confirm !== "cancel" && (
          <BtnGhost tone="danger" onClick={() => setConfirm("cancel")} disabled={busy} style={{ flex: "1 1 160px" }}><Ban size={16} aria-hidden /> {t(CC.cancelChallenge)}</BtnGhost>
        )}
      </div>
      {confirm === "cancel" && (
        <div style={{ marginTop: -S.lg, marginBottom: S.xl }}>
          <ReasonConfirm text={t(CC.cancelConfirm)} confirmLabel={t(CC.cancelChallenge)} busy={busy} onCancel={() => setConfirm(null)}
            onConfirm={(reason) => run(() => teams.cancelChallenge(ch.id, reason), CC.cancelledToast)} />
        </div>
      )}

      <SectionLabel>{t(CC.timeline)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.xl }}>
        <ChallengeTimeline ch={ch} teams={sides} />
      </div>

      {countering && cur && (
        <ChallengeComposer teams={teams} mode="counter"
          base={{ challengeId: ch.id, baseVersion: ch.currentVersion, terms: cur, challenger: ch.challenger, challenged: ch.challenged, mySide: view.side, asTeamId: ch.myTeamId }}
          onClose={() => setCountering(false)}
          onDone={() => { setCountering(false); setNotice(t(CC.counteredToast)); }} />
      )}
    </div>
  );
}
