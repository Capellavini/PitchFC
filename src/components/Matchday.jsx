import MatchdayFormatCard from "./MatchdayFormatCard";
import MatchdayLive from "./MatchdayLive";

/** Live matchday engine with 2–6 named teams. Before kickoff: format pick +
 *  "Começar jogo" (MatchdayFormatCard). Once started: the live screen
 *  (MatchdayLive) — each game (Jogo 1, Jogo 2…) is played between two
 *  teams, goals carry scorer/assist/own-goal/minute, saves are logged per
 *  player; 'campeonato'/'personalizado' add standings and a play-off.
 *  Ending the day feeds season stats, history, clean sheets and MVP voting
 *  (endMatchday in PitchApp). Split into two components so hook order can
 *  never differ between the pre-kickoff and live renders. */
export default function Matchday({ matchday, teams, group, canManage = true, teamsConfirmed = true, onStart, ...handlers }) {
  if (!matchday) {
    return <MatchdayFormatCard teams={teams} canManage={canManage} teamsConfirmed={teamsConfirmed} onStart={onStart} />;
  }
  return <MatchdayLive matchday={matchday} teams={teams} group={group} canManage={canManage} {...handlers} />;
}
