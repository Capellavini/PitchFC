import { useState } from "react";
import { C, S, T, cardStyle } from "../theme";
import { splitWaitlist, playerColor, fmtDayMonth, isoDay, toIsoDay } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import Matchday from "./Matchday";
import MatchdayAfter from "./MatchdayAfter";
import PageHeader from "./PageHeader";
import SectionLabel from "./SectionLabel";
import TeamDraw from "./TeamDraw";

/**
 * Matchday — ONE screen, three states (docs/REDESIGN-SPEC.md §2):
 *  A · before  — who's in (convocados), position-balanced team draw with
 *                manual edit + "Confirmar equipas", then format + "Começar jogo".
 *  B · live    — MatchdayLive: score, timer, Golo · Assistência · Defesa ·
 *                MVP, timeline with undo, red "Terminar jogo".
 *  C · after   — MatchdayAfter: final score, scorers, MVP vote/podium,
 *                share card, Golo da Semana.
 * Plus the cold state for a regular player with nothing today (coldView,
 * decided in PitchApp — organizers always get the controls).
 *
 * "After" shows when the last saved matchday was played today, or while
 * its MVP vote is still open and there's no new game today. A manager can
 * jump from "after" back to "before" to prepare another round.
 */
export default function MatchdayTab({ group, game, teams, drawTeams, onClearTeams, renameTeam, movePlayer, canManageTeams, teamsConfirmed, onConfirmTeams, teamsSetByName, teamsConfirmedByName, matchdayProps, prompt = null, coldView = null, mvp = null, lastMatchday = null, onCardGenerated }) {
  const [forceBefore, setForceBefore] = useState(false);
  const confirmed = group.filter((p) => p.status === "confirmed");
  const { playing, waitlist: waiting = [] } = splitWaitlist(confirmed, game.spots);
  const me = group.find((p) => p.isMe);

  const live = Boolean(matchdayProps.matchday);
  const today = isoDay(0);
  const gameIsToday = !game.noGameScheduled && game.kickoffAt instanceof Date && toIsoDay(game.kickoffAt) === today;
  const hasSummary = Boolean(lastMatchday) && (lastMatchday.matches ?? []).length > 0;
  const playedToday = hasSummary && lastMatchday.date === fmtDayMonth(today);
  const after = !live && !forceBefore && hasSummary && (playedToday || (Boolean(mvp?.open) && !gameIsToday));

  const subtitle = live ? `${t("Ao vivo")} · ${game.groupName}`
    : after ? `${t("Terminado")} · ${game.groupName}`
    : `${game.groupName} · ${game.date}${game.time ? ` · ${game.time}` : ""}`;

  const wrap = (children) => (
    <div style={{ padding: `0 ${S.lg}px ${S.xl}px` }}>
      <PageHeader title="Matchday" subtitle={subtitle} />
      {prompt && <div style={{ marginBottom: S.xl }}>{prompt}</div>}
      {children}
    </div>
  );

  // ── B · live ────────────────────────────────────────────
  if (live) {
    return wrap(<Matchday {...matchdayProps} group={group} teams={teams} canManage={canManageTeams} teamsConfirmed={teamsConfirmed} />);
  }

  // ── C · after ───────────────────────────────────────────
  if (after) {
    return wrap(
      <MatchdayAfter lastMatchday={lastMatchday} mvp={mvp} me={me} group={group} groupName={game.groupName}
        onCardGenerated={onCardGenerated} canManage={canManageTeams} onPrepareNext={() => setForceBefore(true)} />
    );
  }

  // ── Cold (regular player, nothing today) ────────────────
  if (coldView) return wrap(coldView);

  // ── A · before ──────────────────────────────────────────
  return wrap(
    <>
      {/* who's in */}
      <section style={{ marginBottom: S.xl }}>
        <SectionLabel right={<span style={{ fontSize: T.meta, fontWeight: 800, color: playing.length >= game.spots ? C.green : C.text2 }}>{playing.length}/{game.spots}</span>}>
          {t("Convocados")}
        </SectionLabel>
        <div style={{ ...cardStyle }}>
          {playing.length === 0 ? (
            <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda ninguém confirmou para este jogo.")}</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
              {playing.map((p) => (
                <div key={p.id} title={p.nick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, width: 52 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} injured={p.injured} size={40} />
                  <span style={{ fontSize: T.min, color: p.isMe ? C.text1 : C.text2, fontWeight: p.isMe ? 800 : 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
                </div>
              ))}
            </div>
          )}
          {waiting.length > 0 && (
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
              {waiting.length} {t("em lista de espera")}: {waiting.map((p) => p.nick).join(", ")}
            </div>
          )}
        </div>
      </section>

      <TeamDraw group={group} teams={teams} playing={playing} canManage={canManageTeams} confirmed={teamsConfirmed}
        setByName={teamsSetByName} confirmedByName={teamsConfirmedByName}
        onDraw={drawTeams} onClear={onClearTeams} onRename={renameTeam} onMove={movePlayer} onConfirm={onConfirmTeams} />

      <Matchday {...matchdayProps} group={group} teams={teams} canManage={canManageTeams} teamsConfirmed={teamsConfirmed} />
    </>
  );
}
