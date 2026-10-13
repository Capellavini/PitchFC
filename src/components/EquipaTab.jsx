import { S } from "../theme";
import { t } from "../lib/i18n";
import { RC, RIVALS_BRAND } from "../lib/rivalsCopy";
import PageHeader from "./PageHeader";

/**
 * The "Equipa" tab of the TEAM-MODE nav (player with a team and no group,
 * decision 2026-10-13 c): the PITCH Rivals hub (A minha equipa · Desafios ·
 * Descobrir) as a tab of its own, in Competir's slot — Rankings need a
 * group, so a team-only player has nothing else there. `hub` is the
 * rendered RivalsHub (PitchApp wires focus/notice/challenges).
 */
export default function EquipaTab({ hub }) {
  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      <PageHeader title={t(RC.segTeam)} subtitle={RIVALS_BRAND} />
      {hub}
    </div>
  );
}
