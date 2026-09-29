import { useState } from "react";
import { Users, ChevronRight, Star } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import { t } from "../lib/i18n";
import { isEnabled } from "../lib/flags";
import PageHeader from "./PageHeader";
import SegmentedControl from "./SegmentedControl";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";
import TeamsPanel from "./TeamsPanel";
import ChallengesPanel from "./ChallengesPanel";
import Leaderboard from "./Leaderboard";
import ComparePlayers from "./ComparePlayers";
import MatchdayMvpVote from "./MatchdayMvpVote";
import WeeklyPodium from "./WeeklyPodium";
import GoalOfTheWeek from "./GoalOfTheWeek";

/** Competir (spec §2) — "who's on top?". The home of the group's full
 *  season stats: group context (picker only when the player has >1
 *  group) → "🆚 Comparar jogadores" → open MVP ballot (if any) → season
 *  classification (opens on Impacto; Golos, Assistências, MVP,
 *  Guarda-redes, Forma, Fiabilidade % + "Mais") → weekly podium → Golo da
 *  Semana. Fantasy/Pitch Manager is NOT here (it lives in the group page).
 *  The Rankings | Equipas | Desafios switcher only appears when the
 *  `teams`/`challenges` flags are on.
 *
 *  Data: `group` (season totals per player), `history` (one row per
 *  matchday), `matchdaySummaries` (newest-first day summaries — Forma,
 *  team-day records, compare), `lastMatchday` (summary.lines) and `mvp`. */
export default function CompetirTab({ isAdmin, group = [], history = [], matchdaySummaries = [], lastMatchday, mvp, social, postDates, groupName, groupPicker, openBallot = false }) {
  const [sub, setSub] = useState("rankings");
  const [comparing, setComparing] = useState(false);
  // Open MVP ballot starts as a one-line card (the full ballot is tall
  // and would push the classification off screen) — unless PitchApp
  // deep-linked here from Home's "Votar MVP" (openBallot).
  const [ballotOpen, setBallotOpen] = useState(openBallot);
  const myBallotDone = Boolean(mvp?.myVotes?.[1]);
  const teamsOn = isEnabled("teams", { isAdmin });
  const challengesOn = isEnabled("challenges", { isAdmin });
  const subs = [
    { id: "rankings", label: "Rankings" },
    teamsOn && { id: "equipas", label: "Equipas" },
    challengesOn && { id: "desafios", label: "Desafios" },
  ].filter(Boolean);
  const view = subs.some((s) => s.id === sub) ? sub : "rankings";

  // Matchdays held this season. The local demo seeds season totals
  // (gamesPlayed) beyond the 5 mock history rows, so never let the
  // denominator fall below the most-attended player's count.
  const seasonDays = Math.max(history.length, ...group.map((p) => p.gamesPlayed || 0), 0);

  if (comparing) {
    return <ComparePlayers group={group} matchdaySummaries={matchdaySummaries} onBack={() => setComparing(false)} />;
  }

  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      <PageHeader
        title={t("Competir")}
        subtitle={`${t("Temporada")} · ${seasonDays} ${seasonDays === 1 ? t("dia de jogo") : t("dias de jogo")}`}
        right={groupPicker || (groupName ? <Chip Icon={Users}>{groupName}</Chip> : null)}
      />

      {subs.length > 1 && <SegmentedControl options={subs} value={view} onChange={setSub} />}

      {view === "rankings" && (
        <>
          {group.length >= 2 && (
            <button type="button" onClick={() => setComparing(true)}
              style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl, padding: `0 ${S.md}px 0 ${S.lg}px`, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, color: C.text1, cursor: "pointer", textAlign: "left" }}>
              <span aria-hidden style={{ fontSize: 20 }}>🆚</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: T.cardTitle, fontWeight: 800 }}>{t("Comparar jogadores")}</span>
                <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t("Stats lado a lado e % de vitórias juntos")}</span>
              </span>
              <ChevronRight size={18} color={C.text2} />
            </button>
          )}

          {/* the ballot lives in Matchday's after-state; on a new game day
              Matchday shows the new game, so an open vote is reachable here */}
          {mvp?.open && (ballotOpen ? <MatchdayMvpVote mvp={mvp} /> : (
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl, borderLeft: myBallotDone ? `1px solid ${C.border}` : `3px solid ${C.accent}` }}>
              <Star size={20} color={C.gold} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.cardTitle, fontWeight: 700 }}>{t("Votação MVP aberta")}</div>
                <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>
                  {myBallotDone ? t("Votaste") : t("Quem foram os 3 melhores em campo?")}{lastMatchday?.date ? ` · ${lastMatchday.date}` : ""}
                </div>
              </div>
              {myBallotDone
                ? <BtnGhost compact onClick={() => setBallotOpen(true)}>{t("Ver")}</BtnGhost>
                : <BtnPrimary compact onClick={() => setBallotOpen(true)} style={{ minHeight: 44 }}>{t("Votar MVP")}</BtnPrimary>}
            </div>
          ))}

          <SectionLabel>{t("Classificação da época")}</SectionLabel>
          <Leaderboard group={group} seasonDays={seasonDays} matchdaySummaries={matchdaySummaries} />
          <WeeklyPodium lastMatchday={lastMatchday} mvp={mvp} group={group} />
          <GoalOfTheWeek social={social} group={group} postDates={postDates} />
        </>
      )}
      {view === "equipas" && <TeamsPanel />}
      {view === "desafios" && <ChallengesPanel />}
    </div>
  );
}
