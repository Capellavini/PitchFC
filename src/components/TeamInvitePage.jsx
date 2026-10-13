import { useEffect, useState } from "react";
import { ShieldAlert, Users, MapPin } from "lucide-react";
import { C, R, S, T, BRAND, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import { RC, RIVALS_BRAND, rivalsError, tf } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const BAD_TITLE = {
  expired: RC.inviteExpiredTitle, revoked: RC.inviteRevokedTitle, used_up: RC.inviteUsedTitle,
  archived: RC.inviteArchivedTitle, not_found: RC.inviteNotFoundTitle,
};

/**
 * ?tjoin=<token> landing (plan §4 team-first entry). Shows WHAT the invite
 * is before anything happens (team_invite_preview — works logged out):
 *  - logged out → "Criar conta e entrar" / "Já tenho conta" (the token is
 *    kept as a pending intent through signup, email confirmation and the
 *    quick player card, then accepted automatically);
 *  - logged in → "Entrar na equipa" (accept_team_invite — always as player);
 *  - already a member → "Abrir equipa";
 *  - expired / disabled / used / archived / unknown → explained, with
 *    "pede um link novo ao capitão".
 */
export default function TeamInvitePage({ teams, token, loggedIn, onAccept, onSignup, onLogin, onDismiss, onOpenTeam }) {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    teams.previewInvite(token).then((r) => live && setState(r.error ? { error: r.error } : { data: r.data }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const accept = async () => {
    setBusy(true); setError(null);
    const r = await onAccept();
    setBusy(false);
    if (r?.error) setError(rivalsError(r.error));
  };

  const p = state.data;
  const status = state.error ? "error" : p?.status;
  const team = p?.team;
  const n = team?.memberCount ?? 0;

  let body;
  if (state.loading) {
    body = <div aria-busy="true" style={{ fontSize: T.body, color: C.text2, textAlign: "center" }}>{t(RC.checkingInvite)}</div>;
  } else if (status !== "valid") {
    body = (
      <div style={{ textAlign: "center" }}>
        <ShieldAlert size={30} color={C.orange} style={{ marginBottom: S.md }} />
        <div style={{ ...displayFont, fontSize: 22, color: C.text1, marginBottom: S.sm }}>
          {state.error ? t(RC.inviteNotFoundTitle) : t(BAD_TITLE[status] || RC.inviteNotFoundTitle)}
        </div>
        {team?.name && <div style={{ fontSize: T.body, color: C.text1, fontWeight: 700, marginBottom: S.xs }}>{team.name}</div>}
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.lg }}>
          {state.error ? rivalsError(state.error) : t(RC.askCaptain)}
        </div>
        {p?.alreadyMember && onOpenTeam
          ? <BtnPrimary block onClick={onOpenTeam}>{t(RC.openTeam)}</BtnPrimary>
          : <BtnGhost block onClick={onDismiss}>{t(RC.close)}</BtnGhost>}
      </div>
    );
  } else {
    body = (
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: S.md }}><TeamBadge team={team} size={88} /></div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>
          {p.invitedBy ? tf(RC.invitedBy, { inviter: p.invitedBy }) : t(RC.invitedGeneric)}
        </div>
        <h1 style={{ ...displayFont, fontSize: T.title - 4, lineHeight: 1.1, color: C.text1, margin: 0, overflowWrap: "anywhere" }}>{team.name}</h1>
        <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.sm, display: "flex", gap: S.sm, justifyContent: "center", flexWrap: "wrap" }}>
          {(team.city || team.region) && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={13} aria-hidden /> {team.city || team.region}</span>}
          {team.format && <span>{team.format}</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={13} aria-hidden /> {n === 1 ? t(RC.playersOne) : tf(RC.playersN, { n })}</span>
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.lg}px 0`, lineHeight: 1.5 }}>{t(RC.inviteRoleNote)}</div>
        {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}
        {p.alreadyMember ? (
          <>
            <div role="status" style={{ fontSize: T.body, color: C.green, fontWeight: 700, marginBottom: S.md }}>{t(RC.alreadyMember)}</div>
            <BtnPrimary block onClick={onOpenTeam}>{t(RC.openTeam)}</BtnPrimary>
          </>
        ) : loggedIn ? (
          <BtnPrimary block onClick={accept} disabled={busy}>{busy ? t(RC.joining) : t(RC.joinTeam)}</BtnPrimary>
        ) : (
          <>
            <BtnPrimary block onClick={onSignup}>{t(RC.signupToJoin)}</BtnPrimary>
            <BtnGhost block onClick={onLogin || onSignup} style={{ marginTop: S.sm }}>{t(RC.haveAccount)}</BtnGhost>
          </>
        )}
        <button type="button" onClick={onDismiss} style={{ minHeight: 44, marginTop: S.sm, background: "none", border: "none", color: C.text2, fontSize: T.meta + 1, cursor: "pointer" }}>
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
    </div>
  );
}
