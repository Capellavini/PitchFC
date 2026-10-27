import { CalendarDays, ListOrdered, Trophy } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { COMPETITIONS, COMPETITION, TEAMS, PLAYERS } from "../../lib/leagueDemo";
import SectionLabel from "../SectionLabel";
import BtnGhost from "../BtnGhost";
import StatTile from "../StatTile";

const OFFICIAL = new Set(["homologated", "walkover"]);

/** Visão geral: the competitions this league runs, side by side. What needs
 *  a decision lives in "Hoje"; this is where each competition is managed. */
export default function LeagueManageOverview({ ctx, onSection }) {
  const { state, setScope, goTab } = ctx;
  const own = (c) => state.matches.filter((m) => (m.competitionId || COMPETITION.id) === c.id);
  const teamsOf = (c) => new Set(own(c).flatMap((m) => [m.homeId, m.awayId])).size;
  const official = state.matches.filter((m) => OFFICIAL.has(m.state)).length;
  return (
    <div>
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.xl }}>
        <StatTile value={COMPETITIONS.length} label={t("Competições")} />
        <StatTile value={TEAMS.length} label={t("Equipas")} />
        <StatTile value={PLAYERS.length} label={t("Atletas")} />
        <StatTile value={official} label={t("Homologados")} color={C.green} />
      </div>
      <SectionLabel>{t("Competições")}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: S.md }}>
        {COMPETITIONS.map((c) => {
          const ms = own(c);
          const done = ms.filter((m) => OFFICIAL.has(m.state)).length;
          const Icon = c.kind === "cup" ? Trophy : ListOrdered;
          return (
            <div key={c.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.xs }}>
                <Icon size={18} color={C.accent} aria-hidden />
                <span style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t(c.name)}</span>
              </div>
              <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>{t(c.format)} · {tf(t("{n} equipas"), { n: teamsOf(c) })}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, marginBottom: S.md }}>
                <span style={{ ...displayFont, fontSize: 32, lineHeight: 1 }}>{done}</span>
                <span style={{ fontSize: T.body, color: C.text2 }}>{tf(t("de {n} jogos homologados"), { n: ms.length })}</span>
              </div>
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                <BtnGhost onClick={() => { setScope(c.id); onSection("calendar"); }}><CalendarDays size={16} aria-hidden /> {t("Calendário")}</BtnGhost>
                <BtnGhost onClick={() => { setScope(c.id); goTab("classificacao"); }}>{c.kind === "cup" ? t("Quadro") : t("Classificação")}</BtnGhost>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
