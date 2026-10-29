import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { rolesApi } from "../../lib/leagueRolesApi";
import { MEMBER_HOME_PATH } from "../../lib/leagueRoles";
import BtnPrimary from "../BtnPrimary";
import LeagueContextApp from "./LeagueContextApp";
import LeagueClaimPlayer from "./LeagueClaimPlayer";

const page = { minHeight: "100vh", background: C.bg, color: C.text2, padding: S.xl, display: "grid", placeItems: "center", textAlign: "center", fontSize: T.body };
// A member follows the league and looks after their own team: no Fantasy, no fan vote (those need per-person data).
const MEMBER_OFF = { fantasy: false, fan_vote: false };
const REFRESH_MS = 30000;

/** One league as a captain or an athlete sees it (/league/minhas/acesso/<id>): the same screens as the
 *  Gestor's league, on a read-only copy served by the server with only what this person may see. The
 *  captain's one write — their squad — goes through its own server call. */
export default function LeagueMemberApp({ workspaceId }) {
  const [res, setRes] = useState({ phase: "loading" });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    const r = await rolesApi.memberState(workspaceId);
    if (!alive.current) return;
    if (r.error === "forbidden") { setRes({ phase: "forbidden" }); return; }
    if (r.error || !r.data) { if (!silent) setRes({ phase: "error" }); return; }
    setRes({ phase: "ready", data: r.data });
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);
  // The Gestor or the captain may change things while this page is open.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState !== "hidden") load({ silent: true }); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const data = res.data;
  const store = useMemo(() => {
    if (!data) return null;
    const raw = { ...data.state, modules: { ...(data.state.modules || {}), ...MEMBER_OFF } };
    return {
      raw, setRaw() {}, readOnly: true, sync: "public", me: data.me, workspaceId,
      saveSquad: async (teamId, players) => {
        const r = await rolesApi.saveSquad(workspaceId, teamId, players);
        if (r.error) return { error: r.error };
        await load({ silent: true });
        return { players: r.data?.players || [] };
      },
    };
  }, [data, workspaceId, load]);

  if (res.phase === "loading") return <div role="status" style={page}>{t("A abrir a liga…")}</div>;
  if (res.phase === "forbidden") {
    return (
      <div role="alert" style={page}>
        <div>
          <p style={{ color: C.text1, fontWeight: 800, margin: `0 0 ${S.sm}px` }}>{t("Já não tens acesso a esta liga.")}</p>
          <p style={{ margin: `0 0 ${S.lg}px` }}>{t("O gestor pode ter removido o acesso. Pede-lhe um convite novo.")}</p>
          <BtnPrimary onClick={() => window.location.assign(MEMBER_HOME_PATH)}>{t("As minhas ligas")}</BtnPrimary>
        </div>
      </div>
    );
  }
  if (res.phase === "error") {
    return (
      <div role="alert" style={page}>
        <div>
          <p style={{ color: C.text1, fontWeight: 800, margin: `0 0 ${S.sm}px` }}>{t("Não conseguimos abrir a liga.")}</p>
          <p style={{ margin: `0 0 ${S.lg}px` }}>{t("Verifica a ligação e tenta outra vez.")}</p>
          <BtnPrimary onClick={() => { setRes({ phase: "loading" }); load(); }}>{t("Tentar outra vez")}</BtnPrimary>
        </div>
      </div>
    );
  }

  // An athlete who came in through the team link first says who they are in the squad.
  const athlete = (data.me || []).find((m) => m.role === "athlete" && !m.playerId);
  const isCaptain = (data.me || []).some((m) => m.role === "captain");
  if (athlete && !isCaptain) {
    const team = (data.state.data.teams || []).find((x) => x.id === athlete.teamId);
    const squad = (data.state.data.players || []).filter((p) => p.teamId === athlete.teamId);
    return <LeagueClaimPlayer team={team} players={squad} onClaim={async (playerId) => { const r = await rolesApi.claim(workspaceId, playerId); if (!r.error) await load({ silent: true }); return r; }} />;
  }
  return <LeagueContextApp store={store} />;
}
