import { useState } from "react";
import { Goal } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { rivalsError } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";
import PlayerStatsSheet from "./PlayerStatsSheet";
import BtnGhost from "./BtnGhost";

/**
 * Goals + assists of one match, after kickoff: who scored (both teams, read
 * only) and — for leaders — the post-game entry for MY team. Always labelled
 * informational: it feeds the player numbers only once the result is
 * confirmed. No live engine; this is a form filled in after the match.
 * Props: teams, ch, view, m, rv (resultView), onNotice.
 */
export default function MatchStatsBlock({ teams, ch, view, m, rv, onNotice }) {
  const [open, setOpen] = useState(false);
  const { data, error } = useRivalsRead(() => teams.getMatchPlayerStats(m.id), [m.id, teams.revision]);
  const teamOf = (id) => [ch.challenger, ch.challenged].find((x) => x?.id === id);
  const rows = (data?.items || []).filter((x) => x.goals > 0 || x.assists > 0);
  const byTeam = [ch.challenger, ch.challenged].filter(Boolean).map((tm) => ({ tm, rows: rows.filter((x) => x.teamId === tm.id) })).filter((g) => g.rows.length);
  const myScore = rv.official ? rv.official.mine : rv.open ? rv.open.mine : null;
  const myScoreText = rv.official ? `${rv.official.mine}–${rv.official.theirs}` : rv.open ? `${rv.open.mine}–${rv.open.theirs}` : "";
  const canEdit = view.leader && ["scheduled", "played"].includes(m.matchStatus);

  return (
    <>
      <SectionLabel>{t(MC.statsTitle)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        {error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red }}>{rivalsError(error)}</div>}
        {!error && !byTeam.length && <div style={{ fontSize: T.body, color: C.text2 }}>{t(MC.statsNone)}</div>}
        {byTeam.map((g) => (
          <div key={g.tm.id} style={{ marginBottom: S.md }}>
            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: S.xs }}>{teamOf(g.tm.id)?.name}</div>
            {g.rows.map((x) => (
              <div key={x.playerId} style={{ display: "flex", justifyContent: "space-between", gap: S.md, padding: `${S.xs}px 0`, fontSize: T.body, color: C.text1 }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{x.nick || "—"}</span>
                <span style={{ color: C.text2, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {x.goals > 0 && <>{t(MC.goalsShort)} <b style={{ color: C.text1 }}>{x.goals}</b></>}
                  {x.goals > 0 && x.assists > 0 && " · "}
                  {x.assists > 0 && <>{t(MC.assistsShort)} <b style={{ color: C.text1 }}>{x.assists}</b></>}
                </span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{t(MC.statsInfo)}</div>
        {canEdit && (
          <BtnGhost block tone="accent" onClick={() => setOpen(true)} style={{ marginTop: S.md }}>
            <Goal size={16} aria-hidden /> {m.statsRecorded || rows.some((x) => x.teamId === ch.myTeamId) ? t(MC.statsEdit) : t(MC.statsEntry)}
          </BtnGhost>
        )}
      </div>
      {open && (
        <PlayerStatsSheet teams={teams} match={m} teamId={ch.myTeamId} teamScore={myScore} scoreText={myScoreText}
          onClose={() => setOpen(false)} onSaved={onNotice} />
      )}
    </>
  );
}
