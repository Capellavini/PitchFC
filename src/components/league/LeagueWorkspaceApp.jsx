import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { useLeagueWorkspace } from "../../hooks/useLeagueWorkspace";
import BtnPrimary from "../BtnPrimary";
import LeagueContextApp from "./LeagueContextApp";

const page = { minHeight: "100vh", background: C.bg, color: C.text2, padding: S.xl, display: "grid", placeItems: "center", textAlign: "center", fontSize: T.body };

/** A real account's league: the PITCH Ligas app running on the cloud copy of
 *  the league (see useLeagueWorkspace). Nothing is shown until the saved
 *  league has been read, so an empty screen never gets saved over real data. */
export default function LeagueWorkspaceApp({ user }) {
  const store = useLeagueWorkspace({ enabled: Boolean(user?.id), userId: user?.id });
  if (store.phase === "loading") return <div role="status" style={page}>{t("A abrir a tua liga…")}</div>;
  if (store.phase === "error") {
    return (
      <div role="alert" style={page}>
        <div>
          <p style={{ color: C.text1, fontWeight: 800, margin: `0 0 ${S.sm}px` }}>{t("Não conseguimos abrir a tua liga.")}</p>
          <p style={{ margin: `0 0 ${S.lg}px` }}>{t("Verifica a ligação e tenta outra vez. Não perdeste nada.")}</p>
          <BtnPrimary onClick={store.reload}>{t("Tentar outra vez")}</BtnPrimary>
        </div>
      </div>
    );
  }
  return <LeagueContextApp store={store} />;
}
