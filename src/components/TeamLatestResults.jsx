import { S, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { resultOutcome } from "../lib/rivalsResults";
import { kickoffLabel } from "../lib/challengeLabels";
import ListRow from "./ListRow";
import TeamBadge from "./TeamBadge";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";

const OUTCOME = { W: [RC.win, RC.winShort, "green"], D: [RC.draw, RC.drawShort, "orange"], L: [RC.loss, RC.lossShort, "red"] };

/** The team's last confirmed results (≤ 5, newest first), from the matches
 *  useTeams already loaded. Each row opens its match. Official scores only:
 *  a result still waiting for the other team never shows up here.
 *  Props: matches (useTeams().matches), teamId, onOpenMatch(challengeId). */
export default function TeamLatestResults({ matches = [], teamId, onOpenMatch }) {
  const rows = matches
    .filter((m) => (m.homeTeamId === teamId || m.awayTeamId === teamId) && m.result?.officialHomeScore != null && m.result?.officialAwayScore != null)
    .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt)).slice(0, 5);
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(MC.lastResults)}</SectionLabel>
      <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
        {rows.map((m, i) => {
          const home = m.homeTeamId === teamId;
          const mine = home ? m.result.officialHomeScore : m.result.officialAwayScore;
          const theirs = home ? m.result.officialAwayScore : m.result.officialHomeScore;
          const opp = home ? m.awayTeam : m.homeTeam;
          const [word, letter, variant] = OUTCOME[resultOutcome(mine, theirs)];
          return (
            <ListRow key={m.id} divider={i > 0}
              leading={<TeamBadge team={opp} size={36} />}
              title={tf(MC.resultRow, { outcome: t(word), score: `${mine}–${theirs}`, opp: opp?.name || "" })}
              meta={kickoffLabel(m.kickoffAt, m.timezone)}
              right={<Chip variant={variant}>{t(letter)}</Chip>}
              onClick={onOpenMatch && m.challengeId ? () => onOpenMatch(m.challengeId) : undefined} />
          );
        })}
      </div>
    </div>
  );
}
