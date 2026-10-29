import { useEffect, useState } from "react";
import { C, S, T, BRAND, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { rolesApi } from "../../lib/leagueRolesApi";
import { invitePath, memberPath, roleErrorText } from "../../lib/leagueRoles";
import BtnPrimary from "../BtnPrimary";
import KeepyUppyLoader from "../KeepyUppyLoader";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";
const WHAT = {
  captain: "Vais poder ver os jogos e a classificação da liga e gerir o plantel da tua equipa.",
  athlete: "Vais poder ver os jogos, a classificação e o teu registo na equipa.",
};

const shell = (children) => (
  <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: FONT, padding: `${S.xl}px ${S.lg}px`, boxSizing: "border-box" }}>
    <div style={{ maxWidth: 430, margin: "0 auto" }}>
      <img src={BRAND.logo} alt="PITCH" style={{ height: 28, display: "block", marginBottom: S.sm }} />
      <div style={{ ...displayFont, fontSize: 16, letterSpacing: "0.14em", color: C.accent, marginBottom: S.xl }}>LIGAS</div>
      {children}
    </div>
  </div>
);

/** /l/convite/<token> — what a Gestor shares with a captain or an athlete. Anyone can read who it is for;
 *  accepting needs an account (the sign-in page brings the person straight back here). */
export default function LeagueInvitePage({ token, signedIn, authReady }) {
  const [res, setRes] = useState({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!authReady) return undefined; // the preview also says "already a member" for a signed-in person
    let alive = true;
    rolesApi.preview(token).then((r) => {
      if (!alive) return;
      if (r.error) setRes({ phase: "error" });
      else if (!r.data) setRes({ phase: "invalid" });
      else setRes({ phase: "ready", invite: r.data });
    });
    return () => { alive = false; };
  }, [token, authReady, signedIn]);

  if (res.phase === "loading") return shell(<div role="status" style={{ display: "grid", placeItems: "center", padding: S.xxl }}><KeepyUppyLoader /></div>);
  if (res.phase === "error") return shell(<div role="alert" style={{ ...cardStyle }}>{t("Não conseguimos abrir o convite. Tenta outra vez daqui a pouco.")}</div>);
  if (res.phase === "invalid") {
    return shell(
      <div role="alert" style={{ ...cardStyle, display: "grid", gap: S.sm }}>
        <div style={{ fontWeight: 900, fontSize: T.cardTitle }}>{t("Este convite já não vale")}</div>
        <div style={{ color: C.text2, fontSize: T.body, lineHeight: 1.5 }}>{t(roleErrorText("invalid_invite"))}</div>
      </div>,
    );
  }

  const { invite } = res;
  const accept = async () => {
    setBusy(true); setError("");
    const r = await rolesApi.accept(token);
    if (r.error) { setBusy(false); setError(roleErrorText(r.error)); return; }
    window.location.assign(memberPath(r.data.workspace_id));
  };
  const signIn = () => { window.location.assign(`/league/entrar?next=${encodeURIComponent(invitePath(token))}`); };
  const isCaptain = invite.role === "captain";
  return shell(
    <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text2 }}>{isCaptain ? t("Convite para capitão") : t("Convite para atleta")}</div>
      <div style={{ fontWeight: 900, fontSize: T.title, lineHeight: 1.15 }}>{invite.league_name || t("Liga")}</div>
      <div style={{ fontSize: T.body, color: C.text1 }}>
        {t("Equipa")}: <strong>{invite.team_name || "—"}</strong>
        {invite.player_name ? <> · {t("Atleta")}: <strong>{invite.player_name}</strong></> : null}
      </div>
      <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.5 }}>{t(WHAT[invite.role] || WHAT.athlete)}</div>
      {error && <p role="alert" style={{ margin: 0, color: C.orange, fontSize: T.meta }}>{error}</p>}
      {signedIn
        ? <BtnPrimary block disabled={busy} onClick={accept}>{invite.already ? t("Abrir a liga") : busy ? t("A entrar…") : t("Aceitar convite")}</BtnPrimary>
        : <BtnPrimary block onClick={signIn}>{t("Entrar ou criar conta")}</BtnPrimary>}
      {!signedIn && <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Crias a conta em menos de um minuto e voltas aqui para aceitar.")}</div>}
    </div>,
  );
}
