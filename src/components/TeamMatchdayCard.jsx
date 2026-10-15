import { useState } from "react";
import { Check, Clock, Goal, HelpCircle, Users, X } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";
import { CC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { challengeView } from "../lib/rivalsChallenges";
import { resultView } from "../lib/rivalsResults";
import LineupPicker from "./LineupPicker";
import PlayerStatsSheet from "./PlayerStatsSheet";
import ResultSheet from "./ResultSheet";
import Chip from "./Chip";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * What the team does on MATCH DAY (decision 2026-10-13 c) — shown inside the
 * match card of the team-mode Matchday tab. Before kickoff: who answered and
 * (leaders) "quem joga". After kickoff: (leaders) log the result and the
 * post-game goals/assists. No live engine: it is all entered after the
 * match. `nextMatch` = lib/rivals nextTeamMatch(); the full challenge is
 * looked up so the same sheets as the match screen can be reused.
 */
export default function TeamMatchdayCard({ teams, nextMatch, onOpenMatch }) {
  const [sheet, setSheet] = useState(null); // lineup | stats | report | respond
  const [notice, setNotice] = useState(null);
  const ch = teams.challenges.find((c) => c.id === nextMatch.challengeId);
  if (!ch?.match) return null;
  const m = ch.match;
  const view = challengeView(ch);
  const rv = resultView(m, { myTeamId: ch.myTeamId, leader: view.leader });
  const c = m.availabilityCounts || { yes: 0, no: 0, maybe: 0, pending: 0 };
  const chips = [
    ["green", Check, MC.countYes, c.yes], ["orange", HelpCircle, MC.countMaybe, c.maybe],
    ["red", X, MC.countNo, c.no], ["neutral", Clock, MC.countPending, c.pending],
  ].filter(([, , , n]) => n > 0);
  const done = (text) => setNotice(text || null);

  return (
    <div style={{ marginTop: S.lg, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", color: C.text2, marginBottom: S.sm, textTransform: "uppercase" }}>{t(MC.mdCallUp)}</div>
      {chips.length > 0 ? (
        <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: S.xs + 2 }}>
          {chips.map(([variant, Icon, label, n]) => <span role="listitem" key={label}><Chip variant={variant} Icon={Icon}>{tf(label, { n })}</Chip></span>)}
        </div>
      ) : <div style={{ fontSize: T.meta + 1, color: C.text2 }}>{t(MC.noAnswersYet)}</div>}
      <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.sm }}>
        {m.lineupCount ? `${t(MC.lineupTitle)} · ${tf(MC.lineupN, { n: m.lineupCount })}` : t(MC.lineupNone)}
      </div>

      <div aria-live="polite">{notice && <div role="status" style={{ fontSize: T.body, color: C.green, fontWeight: 700, marginTop: S.sm }}>{notice}</div>}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.md }}>
        {rv.canReport && <BtnPrimary block onClick={() => setSheet("report")}><Goal size={18} aria-hidden /> {t(MC.reportAction)}</BtnPrimary>}
        {rv.canRespond && <BtnPrimary block onClick={() => setSheet("respond")}>{t(MC.respondAction)}</BtnPrimary>}
        {view.leader && !rv.kicked && <BtnGhost block tone="accent" onClick={() => setSheet("lineup")}><Users size={16} aria-hidden /> {m.lineupCount ? t(MC.lineupEdit) : t(MC.lineupPick)}</BtnGhost>}
        {view.leader && rv.kicked && ["scheduled", "played"].includes(m.matchStatus) && (
          <BtnGhost block tone={rv.canReport || rv.canRespond ? "neutral" : "accent"} onClick={() => setSheet("stats")}>{m.statsRecorded ? t(MC.statsEdit) : t(MC.statsEntry)}</BtnGhost>
        )}
        {onOpenMatch && <BtnGhost block onClick={() => onOpenMatch(nextMatch.challengeId)}>{t(CC.openMatch)}</BtnGhost>}
      </div>

      {sheet === "lineup" && <LineupPicker teams={teams} match={m} teamId={ch.myTeamId} onClose={() => setSheet(null)} onSaved={done} />}
      {sheet === "stats" && (
        <PlayerStatsSheet teams={teams} match={m} teamId={ch.myTeamId} teamScore={rv.official ? rv.official.mine : rv.open ? rv.open.mine : null}
          scoreText={rv.official ? `${rv.official.mine}–${rv.official.theirs}` : rv.open ? `${rv.open.mine}–${rv.open.theirs}` : ""}
          onClose={() => setSheet(null)} onSaved={done} />
      )}
      {(sheet === "report" || sheet === "respond") && (sheet === "report" ? rv.canReport : rv.canRespond) && (
        <ResultSheet teams={teams} ch={ch} view={view} m={m} rv={rv} mode={sheet} onClose={() => setSheet(null)} onDone={done} />
      )}
    </div>
  );
}
