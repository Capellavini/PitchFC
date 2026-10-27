import { useEffect } from "react";
import { C, BRAND, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LEAGUE_HOME_PATH, leagueSignUpMeta } from "../../lib/leagueAccount";
import AuthForm from "../AuthForm";
import KeepyUppyLoader from "../KeepyUppyLoader";

/** /league/entrar — the only place a PITCH Ligas account is created. The
 *  account is marked as a league account at sign-up, so it only ever sees the
 *  league product (see lib/leagueAccount.js). Signing in here with any
 *  existing account just opens the league home. */
export default function LeagueAuth({ cloud, lang, onLang }) {
  const signedIn = cloud.status !== "loading" && cloud.status !== "anon" && Boolean(cloud.user);
  // A league account with no player row yet gets its minimal profile from the
  // app root; once the session is ready (profile or not) go to the league home.
  useEffect(() => { if (signedIn && cloud.status !== "needsProfile") window.location.replace(LEAGUE_HOME_PATH); }, [signedIn, cloud.status]);

  if (cloud.status === "loading" || signedIn) {
    return (
      <div role="status" style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 30 }} />
        <KeepyUppyLoader />
      </div>
    );
  }
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: C.bg }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, textAlign: "center", paddingTop: 20 }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 24, verticalAlign: "middle" }} />
        <span style={{ ...displayFont, marginLeft: 8, fontSize: 14, letterSpacing: "0.12em", color: C.accent, verticalAlign: "middle" }}>LIGAS</span>
        <div style={{ marginTop: 8, fontSize: 13, color: C.text2 }}>{t("Conta para organizadores de liga. Só dá acesso às ligas.")}</div>
      </div>
      <AuthForm
        onSignUp={(email, password, meta) => cloud.signUp(email, password, leagueSignUpMeta(meta))}
        onSignIn={cloud.signIn}
        onResetPassword={cloud.resetPassword}
        onBack={() => { window.location.href = "/league"; }}
        lang={lang} onLang={onLang}
      />
    </div>
  );
}
