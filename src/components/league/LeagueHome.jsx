import { Megaphone, Star, Target } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { teamById, playerById, currentRound, matchesOfTeam, fmtKickoff, fmtDateTime, COMPETITION } from "../../lib/leagueDemo";
import { ranking } from "../../lib/core/league";
import { PLAYERS } from "../../lib/leagueDemo";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import Chip from "../Chip";
import TeamCrest from "../TeamCrest";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueStateChip from "./LeagueStateChip";
import LeagueRoleCard from "./LeagueRoleCard";
import LeagueHighlight from "./LeagueHighlight";
import LeagueToday from "./LeagueToday";
import LeagueTeamHome from "./LeagueTeamHome";

const PLAYED = new Set(["ended_provisional", "in_review", "homologated", "walkover"]);

/** Início: role card → current round → next match of the followed team →
 *  recent results → highlights → announcements. */
export default function LeagueHome({ ctx }) {
  const { state, derived, role, acc, lang, open } = ctx;
  // Followers see the primary competition; the cup has its own phase view.
  const matches = state.matches.filter((m) => !m.competitionId || m.competitionId === COMPETITION.id);
  const round = currentRound(matches);
  const roundMatches = matches.filter((m) => m.round === round);
  const followId = acc.teamId || state.prefs.supportTeamId;
  const follow = teamById[followId];
  const next = matchesOfTeam(matches, followId).filter((m) => ["scheduled", "live", "postponed"].includes(m.state)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const recent = matches.filter((m) => PLAYED.has(m.state)).sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 3);
  const topScorer = ranking(derived.stats, PLAYERS, "goals", 1)[0];
  const lastMvpMatch = matches.filter((m) => m.officialMvp && m.state === "homologated").sort((a, b) => b.kickoff.localeCompare(a.kickoff))[0];
  const openMatch = (id) => open({ kind: "match", id });

  // The Gestor opens on the work queue, not on the follower feed.
  if (role === "manager") return <LeagueToday ctx={ctx} />;
  // Captain and athlete open on their team: what needs them, the next game.
  if (role === "captain" || role === "athlete") return <LeagueTeamHome ctx={ctx} />;

  return (
    <div>
      <LeagueRoleCard ctx={ctx} />

      <SectionLabel>{tf(LG.round, { n: round })} · {t("jornada atual")}</SectionLabel>
      {roundMatches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} highlightTeamId={followId} />)}

      {follow && (
        <>
          <SectionLabel style={{ marginTop: S.xl }}>{role === "fan" ? t("Próximo jogo da equipa que segues") : t("Próximo jogo da tua equipa")}</SectionLabel>
          {next ? (
            <div style={{ ...cardStyle, marginBottom: S.lg }}>
              <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
                <TeamCrest initials={follow.short.slice(0, 2)} color={follow.color} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: T.cardTitle, fontWeight: 800, overflowWrap: "anywhere" }}>{teamById[next.homeId].name} – {teamById[next.awayId].name}</div>
                  <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{tf(LG.round, { n: next.round })} · {fmtKickoff(next.kickoff, lang)} ({t("hora de Lisboa")}) · {next.venue}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
                <LeagueStateChip state={next.state} />
                <Chip variant={next.var?.enabled ? "lime" : "neutral"}>{t(next.var?.enabled ? LG.varOn : LG.varOff)}</Chip>
              </div>
              <BtnPrimary block onClick={() => openMatch(next.id)}>{t("Ver jogo")}</BtnPrimary>
            </div>
          ) : (
            <div style={{ ...cardStyle, color: C.text2, fontSize: T.body, marginBottom: S.lg }}>{t("Sem jogos agendados para esta equipa. O calendário da próxima jornada aparece aqui quando for publicado.")}</div>
          )}
        </>
      )}

      <SectionLabel style={{ marginTop: S.xl }}>{t("Resultados recentes")}</SectionLabel>
      {recent.length
        ? recent.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} highlightTeamId={followId} />)
        : <div style={{ ...cardStyle, color: C.text2 }}>{t("Ainda sem resultados nesta época.")}</div>}

      <SectionLabel style={{ marginTop: S.xl }}>{t("Destaques")}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: S.sm, marginBottom: S.lg }}>
        <LeagueHighlight Icon={Target} title={t("Melhor marcador")} sub={t("jogos homologados")}
          value={topScorer ? `${playerById[topScorer.player.id].name} · ${topScorer.value}` : "—"}
          onClick={topScorer ? () => open({ kind: "player", id: topScorer.player.id }) : null} />
        <LeagueHighlight Icon={Star} title={t(LG.officialMvp)} sub={lastMvpMatch ? `${teamById[lastMvpMatch.homeId].short}–${teamById[lastMvpMatch.awayId].short} · ${tf(LG.round, { n: lastMvpMatch.round })}` : ""}
          value={lastMvpMatch ? playerById[lastMvpMatch.officialMvp.playerId].name : "—"}
          onClick={lastMvpMatch ? () => openMatch(lastMvpMatch.id) : null} />
      </div>

      <SectionLabel style={{ marginTop: S.xl }}>{t("Comunicados")}</SectionLabel>
      {state.announcements.map((a) => (
        <div key={a.id} style={{ ...cardStyle, display: "flex", gap: S.md, marginBottom: S.sm }}>
          <Megaphone size={18} color={C.accent} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: T.body, fontWeight: 800 }}>{a.title}</div>
            <div style={{ fontSize: T.meta, color: C.text2, margin: "2px 0 6px" }}>{fmtDateTime(a.at, lang)} · {t("Organização da liga")}</div>
            <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{a.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
