import { ClipboardList, Flag } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById } from "../../lib/leagueDemo";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** Capitão (own team's match only): call-up before/while the match is
 *  open; "Contestar resultado" (with mandatory reason) on a provisional
 *  result. Homologation stays with the league. */
export default function LeagueCaptainTools({ match, teamId, onLineup, onContest }) {
  if (match.homeId !== teamId && match.awayId !== teamId) return null;
  const callup = ["scheduled", "postponed", "live"].includes(match.state);
  const contest = match.state === "ended_provisional";
  if (!callup && !contest && match.state !== "in_review") return null;
  const n = match.lineups?.[teamId]?.length || 0;
  return (
    <section style={{ ...cardStyle, marginBottom: S.lg, borderColor: C.blueBorder }} aria-label={t("Ferramentas do capitão")}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.xs }}>{t("Capitão")} · {teamById[teamId].name}</div>
      {callup && (
        <>
          <div style={{ fontSize: T.body, color: C.text1, marginBottom: S.sm }}>{n ? tf(t("Convocatória publicada: {n} atletas."), { n }) : t("Convocatória ainda por fazer.")}</div>
          <BtnPrimary block onClick={onLineup}><ClipboardList size={16} aria-hidden /> {n ? t("Editar convocatória") : t("Fazer convocatória")}</BtnPrimary>
        </>
      )}
      {contest && (
        <>
          <div style={{ fontSize: T.body, color: C.text1, marginBottom: S.sm }}>{t("Resultado provisório. Se algo está errado na ficha de jogo, contesta com motivo — a organização decide.")}</div>
          <BtnGhost block tone="danger" onClick={onContest}><Flag size={16} aria-hidden /> {t("Contestar resultado")}</BtnGhost>
        </>
      )}
      {match.state === "in_review" && (
        <div style={{ fontSize: T.body, color: C.text2 }}>
          {match.contest ? tf(t("Contestado por {team}: “{reason}”. Aguarda decisão da organização."), { team: teamById[match.contest.teamId]?.name, reason: match.contest.reason }) : t("Em revisão pela organização.")}
        </div>
      )}
    </section>
  );
}
