import { useState } from "react";
import { Users } from "lucide-react";
import { S } from "../theme";
import { t } from "../lib/i18n";
import { isEnabled } from "../lib/flags";
import PageHeader from "./PageHeader";
import SegmentedControl from "./SegmentedControl";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";
import TeamsPanel from "./TeamsPanel";
import ChallengesPanel from "./ChallengesPanel";
import Leaderboard from "./Leaderboard";
import WeeklyPodium from "./WeeklyPodium";
import GoalOfTheWeek from "./GoalOfTheWeek";

/** Competir (spec §2) — "who's on top?". At launch: group context
 *  (picker only when the player has >1 group) → season leaderboards →
 *  weekly podium → Golo da Semana. Fantasy/Pitch Manager is NOT here
 *  any more (it lives in the group page). The Rankings | Equipas |
 *  Desafios switcher only appears when the `teams`/`challenges` flags
 *  are on — TeamsPanel/ChallengesPanel are the placeholders to replace.
 *
 *  Data comes from what PitchApp already feeds StatsTab: `group`
 *  (season totals per player), `history` (one row per matchday),
 *  `lastMatchday` (summary.lines) and `mvp`. */
export default function CompetirTab({ isAdmin, group = [], history = [], lastMatchday, mvp, social, postDates, groupName, groupPicker }) {
  const [sub, setSub] = useState("rankings");
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
          <SectionLabel>{t("Classificação da época")}</SectionLabel>
          <Leaderboard group={group} seasonDays={seasonDays} />
          <WeeklyPodium lastMatchday={lastMatchday} mvp={mvp} />
          <GoalOfTheWeek social={social} group={group} postDates={postDates} />
        </>
      )}
      {view === "equipas" && <TeamsPanel />}
      {view === "desafios" && <ChallengesPanel />}
    </div>
  );
}
