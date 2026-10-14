import { useEffect, useState } from "react";
import { Check, Repeat, ShieldAlert, X } from "lucide-react";
import { C, R, S, T, BRAND, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { t, getLang } from "../lib/i18n";
import { CC, RC, RIVALS_BRAND, rivalsError, tf } from "../lib/rivalsCopy";
import { isLeader, marketForLang, MARKETS } from "../lib/rivals";
import { kickoffLabel } from "../lib/challengeLabels";
import TeamBadge from "./TeamBadge";
import ChallengeTerms from "./ChallengeTerms";
import ChallengeComposer from "./ChallengeComposer";
import CreateTeamSheet from "./CreateTeamSheet";
import OptionPills from "./OptionPills";
import ReasonConfirm from "./ReasonConfirm";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const BAD = { expired: CC.statusExpired, agreed: CC.statusAgreed, declined: CC.statusDeclined, cancelled: CC.statusCancelled, claimed: CC.statusClaimed, not_found: CC.statusNotFound };

/**
 * ?desafio=<token> landing. Shows WHAT the challenge is before anything
 * happens (get_challenge_invite — works logged out), then by viewer:
 *  - logged out → "Criar conta e responder" / "Já tenho conta" (the token
 *    survives signup as a pending intent);
 *  - leader of an eligible team → "RESPONDER COMO" (claimable links: any
 *    of my led teams; directed: the challenged team) + aceitar /
 *    contrapropor / recusar;
 *  - no team → create one (CreateTeamSheet) and come straight back here;
 *  - plain member → read-only "pede ao teu capitão";
 *  - my own team's challenge → "Abrir desafio";
 *  - expired / accepted / declined / cancelled / claimed / unknown → said so.
 * onOpenChallenge(challengeId, { match }) enters the app on Desafios.
 */
export default function ChallengeInvitePage({ teams, token, loggedIn, onSignup, onLogin, onDismiss, onOpenChallenge }) {
  const [state, setState] = useState({ loading: true });
  const [asTeam, setAsTeam] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // counter | create | decline

  useEffect(() => {
    let live = true;
    teams.previewChallenge(token).then((r) => {
      if (!live) return;
      setState(r.error ? { error: r.error } : { data: r.data });
      const elig = r.data?.viewer?.eligibleTeams || [];
      setAsTeam((cur) => (elig.some((x) => x.id === cur) ? cur : elig[0]?.id ?? null));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, teams.revision]);

  const p = state.data;
  const status = state.error ? "not_found" : p?.status;
  const v = p?.viewer || {};
  const sides = { challenger: p?.challenger, challenged: p?.challenged };
  const claimable = p?.mode === "claimable" && !p?.claimed;
  const ctx = claimable ? { token } : {};

  const respond = async (action, reason = null) => {
    setBusy(true); setError(null);
    const r = await teams.respondChallenge(p.challengeId, p.currentVersion, action, { asTeamId: asTeam, reason, ...ctx });
    setBusy(false);
    setSheet(null);
    if (r.error) { setError(rivalsError(r.error)); return; }
    onOpenChallenge?.(p.challengeId, { match: action === "accept" });
  };

  let body;
  if (state.loading) {
    body = <div aria-busy="true" style={{ fontSize: T.body, color: C.text2, textAlign: "center" }}>{t(CC.checkingChallenge)}</div>;
  } else if (status !== "pending") {
    const mine = status === "agreed" && v.side;
    body = (
      <div style={{ textAlign: "center" }}>
        <ShieldAlert size={30} color={C.orange} aria-hidden style={{ marginBottom: S.md }} />
        <div style={{ ...displayFont, fontSize: 22, color: C.text1, marginBottom: S.sm }}>{t(BAD[status] || CC.statusNotFound)}</div>
        {p?.challenger?.name && <div style={{ fontSize: T.body, color: C.text1, fontWeight: 700, marginBottom: S.xs }}>{p.challenger.name}{p.challenged ? ` vs ${p.challenged.name}` : ""}</div>}
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.lg }}>
          {state.error && state.error !== "not_found" ? rivalsError(state.error) : mine ? "" : t(CC.statusBadBody)}
        </div>
        {mine
          ? <BtnPrimary block onClick={() => onOpenChallenge?.(p.challengeId, { match: true })}>{t(CC.openMatch)}</BtnPrimary>
          : <BtnGhost block onClick={onDismiss}>{t(RC.close)}</BtnGhost>}
      </div>
    );
  } else {
    const title = claimable ? tf(CC.inviteOpen, { team: p.challenger.name })
      : v.side === "challenged" || !loggedIn ? tf(CC.inviteFrom, { team: p.challenger.name }) : tf(CC.inviteTo, { team: p.challenged?.name || "" });
    const elig = v.eligibleTeams || [];
    let actions;
    if (!loggedIn) {
      actions = (
        <>
          <BtnPrimary block onClick={onSignup}>{t(CC.signupToAnswer)}</BtnPrimary>
          <BtnGhost block onClick={onLogin || onSignup} style={{ marginTop: S.sm }}>{t(RC.haveAccount)}</BtnGhost>
        </>
      );
    } else if (v.side === "challenger") {
      actions = (
        <>
          <div role="status" style={{ fontSize: T.body, color: C.text1, fontWeight: 700, marginBottom: S.md }}>{t(CC.ownChallenge)}</div>
          <BtnPrimary block onClick={() => onOpenChallenge?.(p.challengeId)}>{t(CC.openChallenge)}</BtnPrimary>
        </>
      );
    } else if (elig.length) {
      actions = (
        <>
          {(claimable || elig.length > 1) && (
            <div role="group" aria-label={t(CC.respondAs)} style={{ textAlign: "left", marginBottom: S.md }}>
              <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>{t(CC.respondAs)}</div>
              <OptionPills label={t(CC.respondAs)} value={asTeam} onChange={setAsTeam} options={elig.map((x) => ({ id: x.id, label: x.name }))} />
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}
          <BtnPrimary block onClick={() => respond("accept")} disabled={busy || !asTeam}><Check size={18} aria-hidden /> {t(CC.accept)}</BtnPrimary>
          <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
            <BtnGhost onClick={() => setSheet("counter")} disabled={busy || !asTeam} style={{ flex: 1 }}><Repeat size={16} aria-hidden /> {t(CC.counter)}</BtnGhost>
            {!claimable && <BtnGhost tone="danger" onClick={() => setSheet("decline")} disabled={busy} style={{ flex: 1 }}><X size={16} aria-hidden /> {t(CC.decline)}</BtnGhost>}
          </div>
          {sheet === "decline" && (
            <ReasonConfirm text={t(CC.declineConfirm)} confirmLabel={t(CC.decline)} busy={busy} onCancel={() => setSheet(null)} onConfirm={(reason) => respond("decline", reason)} />
          )}
        </>
      );
    } else if (v.side === "challenged") {
      actions = <div role="status" style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{tf(CC.memberReadOnly, { team: p.challenged?.name || "" })}</div>;
    } else if (!claimable) {
      actions = <div role="status" style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{tf(CC.notForYou, { team: p.challenged?.name || "" })}</div>;
    } else if (!v.hasTeam || !teams.myTeams.some((tm) => isLeader(tm.role))) {
      actions = v.hasTeam ? (
        <div role="status" style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{t(CC.askCaptainToAnswer)}</div>
      ) : (
        <>
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>{t(CC.createTeamToAnswerHint)}</div>
          <BtnPrimary block onClick={() => setSheet("create")}>{t(CC.createTeamToAnswer)}</BtnPrimary>
        </>
      );
    }

    body = (
      <div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: S.md, marginBottom: S.md }}>
            <TeamBadge team={p.challenger} size={72} />
            {p.challenged && <><span aria-hidden style={{ ...displayFont, color: C.text2 }}>VS</span><TeamBadge team={p.challenged} size={72} /></>}
          </div>
          {p.invitedBy && <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{tf(CC.invitedByLine, { name: p.invitedBy })}</div>}
          <h1 style={{ ...displayFont, fontSize: T.title - 6, lineHeight: 1.15, color: C.text1, margin: 0, overflowWrap: "anywhere" }}>{title}</h1>
          <div role="status" style={{ fontSize: T.meta + 1, color: C.orange, fontWeight: 700, marginTop: S.sm }}>
            {tf(CC.stageRespond, { when: kickoffLabel(p.expiresAt, p.terms?.timezone) })}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.xs}px ${S.md}px`, margin: `${S.lg}px 0` }}>
          <ChallengeTerms terms={p.terms} teams={sides} />
        </div>
        <div style={{ fontSize: T.min + 0.5, color: C.text2, lineHeight: 1.4, marginBottom: S.lg }}>{t(CC.costDisclaimer)}</div>
        <div style={{ textAlign: "center" }}>{actions}</div>
        <button type="button" onClick={onDismiss} style={{ width: "100%", minHeight: 44, marginTop: S.sm, background: "none", border: "none", color: C.text2, fontSize: T.meta + 1, cursor: "pointer" }}>
          {t(RC.notNow)}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: `${S.xxl}px ${S.lg}px`, boxSizing: "border-box", ...fieldBackdrop(0.5, 0.94) }}>
      <div style={{ textAlign: "center", marginBottom: S.xl }}>
        <img src={BRAND.logo} alt="PITCH" style={{ width: "46%", maxWidth: 170 }} />
        <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.12em", color: C.accent, marginTop: S.sm }}>{RIVALS_BRAND.toUpperCase()}</div>
      </div>
      <div style={{ ...cardStyle, padding: `${S.xl}px ${S.lg + 4}px`, borderRadius: R.card }}>{body}</div>

      {sheet === "counter" && p && (
        <ChallengeComposer teams={teams} mode="counter"
          base={{ challengeId: p.challengeId, baseVersion: p.currentVersion, terms: p.terms, challenger: p.challenger,
            challenged: p.challenged || v.eligibleTeams?.find((x) => x.id === asTeam) || null, mySide: "challenged", asTeamId: asTeam, ...ctx }}
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); onOpenChallenge?.(p.challengeId); }} />
      )}
      {sheet === "create" && (
        <CreateTeamSheet teams={teams} market={MARKETS[p?.challenger?.country] || marketForLang(getLang())}
          defaults={{ city: p?.challenger?.city, region: p?.challenger?.region }}
          onClose={() => setSheet(null)} onCreated={() => setSheet(null)} />
      )}
    </div>
  );
}
