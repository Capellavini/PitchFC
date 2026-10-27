import { Heart, Star } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById, PLAYERS, matchesOfTeam, COMPETITION, captainOf, ovrOfPlayer } from "../../lib/leagueDemo";
import BackHeader from "../BackHeader";
import SectionLabel from "../SectionLabel";
import BtnGhost from "../BtnGhost";
import BtnPrimary from "../BtnPrimary";
import FormPills from "../FormPills";
import TeamCrest from "../TeamCrest";
import StatTile from "../StatTile";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueSquadGrid from "./LeagueSquadGrid";
import TeamTopPlayers from "../TeamTopPlayers";

/** Team page inside the competition: identity, table position, record
 *  (official only), form, public squad (name/number/position — never
 *  contacts), fixtures & results. Follow / support (local demo prefs). */
export default function LeagueTeamPage({ ctx, teamId }) {
  const { state, derived, lang, back, open, act } = ctx;
  const team = teamById[teamId];
  if (!team) return <div><BackHeader title={t("Equipa não encontrada")} onBack={back} /></div>;
  const pos = derived.table.findIndex((r) => r.id === teamId);
  const row = derived.table[pos];
  const squad = PLAYERS.filter((p) => p.teamId === teamId);
  const games = matchesOfTeam(state.matches, teamId).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const form = games.filter((m) => m.state === "homologated").reverse().slice(0, 5).map((m) => {
    const s = derived.scores[m.id]; const mine = m.homeId === teamId ? s.home : s.away; const their = m.homeId === teamId ? s.away : s.home;
    return mine > their ? "W" : mine < their ? "L" : "D";
  });
  const avgOvr = Math.round(squad.reduce((n, p) => n + ovrOfPlayer(p), 0) / squad.length);
  const suspended = new Set(squad.filter((p) => (derived.discipline[p.id]?.pending || 0) > 0).map((p) => p.id));
  const top = (k) => squad.map((p) => ({ nick: p.nick, n: derived.stats[p.id]?.[k] || 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  const follows = (state.prefs.followTeamIds || []).includes(teamId);
  const supports = state.prefs.supportTeamId === teamId;
  const toggleFollow = () => act.setPrefs({ followTeamIds: follows ? state.prefs.followTeamIds.filter((x) => x !== teamId) : [...(state.prefs.followTeamIds || []), teamId] });

  return (
    <div>
      <BackHeader title={team.name} subtitle={`${COMPETITION.name} · ${t(COMPETITION.category)}`} onBack={back} />
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.lg, marginBottom: S.md }}>
        <TeamCrest initials={team.short.slice(0, 2)} color={team.color} size={64} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...displayFont, fontSize: T.h + 2 }}>{team.name}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{tf(t("Fundada em {y} · {venue}"), { y: team.founded, venue: team.venue })}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{tf(t("{p}º na classificação oficial"), { p: pos + 1 })}{supports ? ` · ${t("a tua equipa do coração")}` : ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {follows
          ? <BtnGhost onClick={toggleFollow} style={{ flex: "1 1 140px" }}><Star size={16} aria-hidden /> {t("A seguir")}</BtnGhost>
          : <BtnPrimary onClick={toggleFollow} style={{ flex: "1 1 140px" }}><Star size={16} aria-hidden /> {t("Seguir equipa")}</BtnPrimary>}
        {!supports && <BtnGhost onClick={() => act.setPrefs({ supportTeamId: teamId, followTeamIds: [...new Set([...(state.prefs.followTeamIds || []), teamId])] })} style={{ flex: "1 1 140px" }}><Heart size={16} aria-hidden /> {t("É a minha equipa")}</BtnGhost>}
      </div>

      <SectionLabel>{t("Época · jogos homologados")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.md }}>
          <StatTile value={row.j} label={t("Jogos")} />
          <StatTile value={row.w} label={t("V")} color={C.green} />
          <StatTile value={row.d} label={t("E")} color={C.orange} />
          <StatTile value={row.l} label={t("D")} color={C.red} />
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{tf(t("Golos {gf}–{ga} · {pts} pontos"), { gf: row.gf, ga: row.ga, pts: row.pts })}</div>
        <FormPills form={form} />
      </div>

      <SectionLabel>{t("Jogos")}</SectionLabel>
      {games.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={(id) => open({ kind: "match", id })} />)}

      <SectionLabel style={{ marginTop: S.xl }} right={<span style={{ fontSize: T.meta, color: C.text2, fontWeight: 700 }}>{tf(t("OVR médio {n}"), { n: avgOvr })}</span>}>{tf(t("Plantel inscrito ({n})"), { n: squad.length })}</SectionLabel>
      <TeamTopPlayers scorers={top("goals")} assisters={top("assists")} />
      <LeagueSquadGrid players={squad} suspended={suspended} captainId={captainOf(teamId)} meId={ctx.acc.playerId} onPlayer={(id) => open({ kind: "player", id })} />
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>{t("Só jogos oficiais desta competição. Amigáveis e outras competições da equipa aparecem em separado (Fase 2).")}</div>
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.5 }}>{t("A equipa mantém a mesma identidade entre épocas; cada época tem o seu plantel inscrito. Páginas públicas não mostram contactos.")}</div>
    </div>
  );
}
