import { S } from "../../theme";
import { PLAYERS, futPlayer } from "../../lib/leagueDemo";
import ComparePlayers from "../ComparePlayers";

/** Comparar atletas — the group app's ComparePlayers fed with this
 *  competition's OFFICIAL stats. "Jogos juntos" stays empty: it reads
 *  weekly-group matchday snapshots, which leagues don't have (and must not
 *  be mixed with). The negative margin cancels ComparePlayers' own page
 *  padding inside the league column. */
export default function LeagueCompare({ ctx }) {
  const { derived, acc, back } = ctx;
  const group = PLAYERS.map((p) => {
    const s = derived.stats[p.id] || {};
    return { ...futPlayer(p), gamesPlayed: s.games || 0, goals: s.goals || 0, assists: s.assists || 0, mvps: s.mvps || 0, isMe: p.id === acc.playerId };
  });
  return <div style={{ margin: `0 -${S.lg}px` }}><ComparePlayers group={group} matchdaySummaries={[]} onBack={back} /></div>;
}
