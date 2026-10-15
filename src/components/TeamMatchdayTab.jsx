import { useEffect, useState } from "react";
import { LayoutGrid, Search, Timer } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { matchesAwaitingResult } from "../lib/rivalsResults";
import PageHeader from "./PageHeader";
import SectionLabel from "./SectionLabel";
import TeamNextMatchCard from "./TeamNextMatchCard";
import TeamMatchdayCard from "./TeamMatchdayCard";
import TeamBadge from "./TeamBadge";
import ListRow from "./ListRow";
import TacticsBoard from "./TacticsBoard";
import Collapsible from "./Collapsible";
import BtnPrimary from "./BtnPrimary";

/** Team roster → the { team, group } shape TacticsBoard already uses for groups. */
const tacticsInput = (teamId, teamName, members) => ({
  team: { id: `team-${teamId}`, name: teamName, players: members.map((m) => m.playerId) },
  group: members.map((m) => ({ id: m.playerId, name: m.name || m.nick || "?", nick: m.nick || m.name || "?", photo: m.photoUrl, position: m.position })),
});

/** One line for a match that kicked off and still has no closed result. */
function pendingLine(view, oppName) {
  if (view.phase === "ready") return view.canReport ? t(MC.stageResultReadyLeader) : t(MC.stageResultReady);
  const score = view.open ? `${view.open.mine}–${view.open.theirs}` : "";
  return view.byMe ? tf(MC.stageResultWaiting, { team: oppName, score }) : tf(MC.stageResultRespond, { team: oppName, score });
}

/**
 * Matchday in TEAM MODE (decision 2026-10-13 c). On the team's match day:
 * the match card with the call-up, "quem joga" and — after kickoff — the
 * result and post-game goals/assists (TeamMatchdayCard; entered after the
 * match, there is no live engine), plus the existing tactics board fed
 * with the team roster (squads of 7+, same threshold as groups). Matches
 * that already kicked off but have no closed result are listed below.
 * Otherwise a countdown to the next match, or an empty state.
 */
export default function TeamMatchdayTab({ teams, nextMatch, onFindRivals, onOpenMatch }) {
  const today = Boolean(nextMatch?.isToday);
  const [members, setMembers] = useState(null);

  useEffect(() => {
    if (!today) return undefined;
    let live = true;
    teams.fetchTeam(nextMatch.teamId).then((r) => { if (live) setMembers(r.error ? [] : r.data.members); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, nextMatch?.teamId, teams.revision]);

  const toClose = matchesAwaitingResult(teams.matches, teams.myTeams).filter((x) => x.match.challengeId !== nextMatch?.challengeId);
  const toCloseList = toClose.length > 0 && (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t(MC.mdToClose)}</SectionLabel>
      <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
        {toClose.map(({ match, view }, i) => {
          const opp = match.myTeamId === match.homeTeamId ? match.awayTeam : match.homeTeam;
          return (
            <ListRow key={match.id} divider={i > 0} accent={view.canReport || view.canRespond}
              leading={<TeamBadge team={opp} size={36} />}
              title={tf(RC.vsOpponent, { team: opp?.name || "" })} meta={pendingLine(view, opp?.name || "")}
              onClick={onOpenMatch ? () => onOpenMatch(match.challengeId) : undefined} />
          );
        })}
      </div>
    </div>
  );

  if (today) {
    const tb = members && members.length > 6 ? tacticsInput(nextMatch.teamId, nextMatch.team.name, members) : null;
    return (
      <div style={{ padding: `0 ${S.lg}px` }}>
        <PageHeader title="Matchday" subtitle={nextMatch.team.name} />
        <TeamNextMatchCard match={nextMatch} eyebrow={t(RC.matchdayToday)}>
          <TeamMatchdayCard teams={teams} nextMatch={nextMatch} onOpenMatch={onOpenMatch} />
        </TeamNextMatchCard>
        {tb ? (
          <Collapsible icon={<LayoutGrid size={16} color={nextMatch.team.color || C.accent} />} title={tf(RC.tactics, { team: nextMatch.team.name })} defaultOpen>
            <TacticsBoard team={tb.team} group={tb.group} />
          </Collapsible>
        ) : members && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, marginBottom: S.xl }}>{t(RC.tacticsNeedPlayers)}</div>
        )}
        {toCloseList}
      </div>
    );
  }

  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      <PageHeader title="Matchday" subtitle={nextMatch?.team?.name} />
      {nextMatch ? (
        <TeamNextMatchCard match={nextMatch}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: S.sm, marginTop: S.md, fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>
            <Timer size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /> {t(RC.matchdayCountdownBody)}
          </div>
          {nextMatch.kickoffPassed && <TeamMatchdayCard teams={teams} nextMatch={nextMatch} onOpenMatch={onOpenMatch} />}
        </TeamNextMatchCard>
      ) : (
        <div style={{ ...cardStyle, textAlign: "center", padding: "28px 20px", marginBottom: S.lg }}>
          <div style={{ width: 52, height: 52, borderRadius: R.card, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${S.md}px` }}>
            <Timer size={24} color={C.accent} aria-hidden />
          </div>
          <div style={{ ...displayFont, fontSize: T.h, marginBottom: S.sm }}>{t(RC.matchdayEmptyTitle)}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6, marginBottom: S.lg }}>{t(RC.matchdayCountdownBody)}</div>
          <BtnPrimary block onClick={onFindRivals}><Search size={18} aria-hidden /> {t(RC.findRivals)}</BtnPrimary>
        </div>
      )}
      {toCloseList}
    </div>
  );
}
