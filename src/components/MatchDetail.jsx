import { useState } from "react";
import { Ban, CalendarClock, Check, ExternalLink, MapPin, MessageCircle, Wallet, X } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC, RIVALS_BRAND, rivalsError, tf } from "../lib/rivalsCopy";
import { FIELD_STATUSES, challengeView, normTerms, openChange } from "../lib/rivalsChallenges";
import { kickoffLabel, mapsUrl, splitLabel, termValue } from "../lib/challengeLabels";
import { openWhatsApp } from "../lib/whatsapp";
import BackHeader from "./BackHeader";
import SectionLabel from "./SectionLabel";
import TeamBadge from "./TeamBadge";
import FieldStatusBadge from "./FieldStatusBadge";
import OptionPills from "./OptionPills";
import VersionDiff from "./VersionDiff";
import ChallengeComposer from "./ChallengeComposer";
import ReasonConfirm from "./ReasonConfirm";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const FIELD_LABEL = { confirmed: CC.setFieldConfirmed, unavailable: CC.setFieldUnavailable, unconfirmed: CC.setFieldUnconfirmed };

/**
 * The ONE shared match of an agreed challenge — both teams see exactly
 * this: when, where (+ map), format/duration, cost (informational), the
 * pitch status (separate; only the responsible team's leader sets it),
 * a pending change to review, "Pedir alteração", cancel (never a loss).
 * EXTENSION POINT (PR6/PR7): the result block (report / confirm /
 * contest), RSVP and lineup replace the placeholder below.
 */
export default function MatchDetail({ teams, challengeId, onBack }) {
  const ch = teams.challenges.find((c) => c.id === challengeId);
  const m = ch?.match;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [changing, setChanging] = useState(false);
  const [fieldDraft, setFieldDraft] = useState(null); // { status, note }

  if (!ch || !m) {
    return (
      <div>
        <BackHeader title={t(CC.matchTitle)} onBack={onBack} />
        <div role="alert" style={{ fontSize: T.body, color: C.text2 }}>{rivalsError("match_not_found")}</div>
      </div>
    );
  }
  const view = challengeView(ch);
  const sides = { challenger: ch.challenger, challenged: ch.challenged };
  const terms = normTerms(m);
  const change = openChange(ch);
  const now = Date.now();
  const scheduled = m.matchStatus === "scheduled";
  const before = Date.parse(m.kickoffAt) > now;
  const responsibleTeam = m.fieldResponsible === "challenger" ? ch.challenger : ch.challenged;
  const iAmResponsible = view.leader && responsibleTeam?.id === ch.myTeamId;
  const cancelledBy = m.cancelledByTeamId === ch.challenger?.id ? ch.challenger : ch.challenged;
  const map = mapsUrl(terms);

  const run = async (fn, okText) => {
    setBusy(true); setError(null); setNotice(null);
    const r = await fn();
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); return false; }
    if (okText) setNotice(t(okText));
    return true;
  };

  const Row = ({ Icon, label, children }) => (
    <div style={{ display: "flex", gap: S.md, padding: `${S.sm + 2}px 0`, borderTop: `1px solid ${C.border}` }}>
      <Icon size={18} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, marginTop: 2, overflowWrap: "anywhere" }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div>
      <BackHeader title={t(CC.matchTitle)} subtitle={RIVALS_BRAND} onBack={onBack} />

      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
          {[ch.challenger, ch.challenged].map((tm, i) => (
            <div key={tm?.id || i} style={{ flex: 1, minWidth: 0, textAlign: "center", order: i ? 2 : 0 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: S.xs }}><TeamBadge team={tm} size={56} /></div>
              <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, overflowWrap: "anywhere" }}>{tm?.name}</div>
              <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t(i ? CC.away : CC.home)}</div>
            </div>
          ))}
          <div aria-hidden style={{ order: 1, ...displayFont, fontSize: T.h, color: C.text2 }}>VS</div>
        </div>
        <div role="status" aria-live="polite" style={{ display: "flex", justifyContent: "center", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
          {scheduled ? <FieldStatusBadge status={m.fieldStatus} /> : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.meta + 1, fontWeight: 700, color: C.red }}>
              <Ban size={15} aria-hidden /> {t(CC.stageMatchCancelled)} · {tf(CC.matchCancelledBy, { team: cancelledBy?.name || "" })}
            </span>
          )}
        </div>
        {!scheduled && m.cancelReason && <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.xs }}>{tf(CC.reasonLine, { reason: m.cancelReason })}</div>}

        <div style={{ marginTop: S.md }}>
          <Row Icon={CalendarClock} label={t(CC.when)}>{kickoffLabel(m.kickoffAt, m.timezone)}<div style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}>{tf(CC.formatLine, { format: m.format, n: m.durationMin })}</div></Row>
          <Row Icon={MapPin} label={t(CC.where)}>
            {termValue("venueName", terms)}
            {terms.venueAddress && <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}>{terms.venueAddress}</div>}
            {map && (
              <a href={map} target="_blank" rel="noopener noreferrer" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 4, minHeight: TOUCH.min, color: C.accent, fontSize: T.meta + 1, fontWeight: 700 }}>
                <ExternalLink size={14} aria-hidden /> {t(CC.openMap)}
              </a>
            )}
          </Row>
          {(terms.costCents != null || terms.costSplit === "none") && (
            <Row Icon={Wallet} label={tf(CC.cost, { cur: terms.currency })}>
              {terms.costCents != null ? tf(CC.costLine, { cost: termValue("costCents", terms), split: splitLabel(terms.costSplit) }) : splitLabel(terms.costSplit)}
              <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}>{t(CC.costDisclaimer)}</div>
            </Row>
          )}
          {terms.note && <Row Icon={MessageCircle} label={t(CC.note)}>{terms.note}</Row>}
        </div>
      </div>

      <div aria-live="polite">
        {notice && <div role="status" style={{ fontSize: T.body, color: C.green, fontWeight: 700, marginBottom: S.md }}>{notice}</div>}
        {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}
      </div>

      {/* Pending change: needs the other team's consent */}
      {scheduled && change && (
        <div style={{ ...cardStyle, marginBottom: S.lg, borderLeft: `3px solid ${C.orange}` }}>
          <SectionLabel>{t(CC.changePendingTitle)}</SectionLabel>
          <div style={{ fontSize: T.meta + 1, color: C.text2, marginBottom: S.sm }}>
            {tf(CC.changeFrom, { team: (change.proposedByTeamId === ch.challenger?.id ? ch.challenger : ch.challenged)?.name || "" })}
          </div>
          <VersionDiff prev={terms} next={change} teams={sides} />
          {view.nextAction === "review_change" ? (
            <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
              <BtnPrimary onClick={() => run(() => teams.respondMatchChange(m.id, change.version, "accept", { asTeamId: ch.myTeamId }), CC.outcomeAccepted)} disabled={busy} style={{ flex: 1 }}>
                <Check size={16} aria-hidden /> {t(CC.acceptChange)}
              </BtnPrimary>
              <BtnGhost tone="danger" onClick={() => run(() => teams.respondMatchChange(m.id, change.version, "decline", { asTeamId: ch.myTeamId }), CC.outcomeDeclined)} disabled={busy} style={{ flex: 1 }}>
                <X size={16} aria-hidden /> {t(CC.declineChange)}
              </BtnGhost>
            </div>
          ) : (
            <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.md }}>
              {view.leader ? tf(CC.changeWaiting, { team: view.opponent?.name || "" }) : t(CC.askCaptainToAnswer)}
            </div>
          )}
        </div>
      )}

      {/* Pitch status: separate from the negotiation */}
      {scheduled && (
        <>
          <SectionLabel>{t(CC.field)}</SectionLabel>
          <div style={{ ...cardStyle, marginBottom: S.lg }}>
            <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{tf(CC.fieldHint, { team: responsibleTeam?.name || "" })}</div>
            {m.fieldNote && <div style={{ fontSize: T.body, color: C.text1, marginTop: S.sm }}>“{m.fieldNote}”</div>}
            {iAmResponsible && (fieldDraft ? (
              <div style={{ marginTop: S.md }}>
                <OptionPills label={t(CC.field)} value={fieldDraft.status} onChange={(status) => setFieldDraft((d) => ({ ...d, status }))}
                  options={FIELD_STATUSES.map((id) => ({ id, label: t(FIELD_LABEL[id]) }))} />
                <input value={fieldDraft.note} onChange={(e) => setFieldDraft((d) => ({ ...d, note: e.target.value }))} maxLength={280}
                  placeholder={t(CC.fieldNotePlaceholder)} aria-label={t(CC.fieldNotePlaceholder)} style={{ ...inputStyle(), marginTop: S.sm }} />
                <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
                  <BtnPrimary disabled={busy} style={{ flex: 1 }}
                    onClick={async () => { if (await run(() => teams.setFieldStatus(m.id, fieldDraft.status, fieldDraft.note.trim() || null))) setFieldDraft(null); }}>
                    {t(RC.save)}
                  </BtnPrimary>
                  <BtnGhost onClick={() => setFieldDraft(null)} style={{ flex: 1 }}>{t(RC.cancel)}</BtnGhost>
                </div>
              </div>
            ) : (
              <BtnGhost block tone={m.fieldStatus === "confirmed" ? "neutral" : "accent"} style={{ marginTop: S.md }}
                onClick={() => setFieldDraft({ status: m.fieldStatus === "unconfirmed" ? "confirmed" : m.fieldStatus, note: m.fieldNote || "" })}>
                {t(CC.actConfirmField)}
              </BtnGhost>
            ))}
          </div>
        </>
      )}

      {/* EXTENSION POINT (PR6): shared result — report / confirm / contest */}
      <SectionLabel>{t(CC.result)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg, background: C.surface, borderRadius: R.card }}>
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{t(CC.resultSoon)}</div>
      </div>

      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.xl }}>
        {scheduled && before && view.leader && !change && (
          <BtnGhost onClick={() => setChanging(true)} style={{ flex: "1 1 160px" }}><CalendarClock size={16} aria-hidden /> {t(CC.requestChange)}</BtnGhost>
        )}
        <BtnGhost onClick={() => openWhatsApp(tf(CC.talkMessage, { when: kickoffLabel(m.kickoffAt, m.timezone) }))} style={{ flex: "1 1 160px" }}>
          <MessageCircle size={16} aria-hidden /> {t(CC.talkWhatsApp)}
        </BtnGhost>
        {scheduled && before && view.leader && !confirmCancel && (
          <BtnGhost tone="danger" onClick={() => setConfirmCancel(true)} style={{ flex: "1 1 160px" }}><Ban size={16} aria-hidden /> {t(CC.cancelMatch)}</BtnGhost>
        )}
      </div>
      {confirmCancel && (
        <div style={{ marginTop: -S.lg, marginBottom: S.xl }}>
          <ReasonConfirm text={t(CC.cancelMatchConfirm)} confirmLabel={t(CC.cancelMatch)} busy={busy} onCancel={() => setConfirmCancel(false)}
            onConfirm={async (reason) => { await run(() => teams.cancelChallenge(ch.id, reason), CC.stageMatchCancelled); setConfirmCancel(false); }} />
        </div>
      )}

      {changing && (
        <ChallengeComposer teams={teams} mode="change"
          base={{ challengeId: ch.id, matchId: m.id, baseVersion: ch.currentVersion, terms, challenger: ch.challenger, challenged: ch.challenged, mySide: view.side, asTeamId: ch.myTeamId }}
          onClose={() => setChanging(false)}
          onDone={() => { setChanging(false); setNotice(t(CC.changeSentToast)); }} />
      )}
    </div>
  );
}
