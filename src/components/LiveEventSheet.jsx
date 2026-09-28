import { useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";
import { playerColor } from "../lib/helpers";
import { isSave } from "../lib/matchdayLive";
import { currentTimerMinute } from "../lib/matchTimer";
import Avatar from "./Avatar";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";

/** Big tappable player tile for the pickers (≥56px, avatar + nick). */
function PlayerPick({ p, group, onClick, tag }) {
  return (
    <button type="button" onClick={onClick}
      style={{ minHeight: 56, display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px ${S.md}px`, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, color: C.text1, cursor: "pointer", textAlign: "left", minWidth: 0 }}>
      <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} size={32} />
      <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
      {tag}
    </button>
  );
}

function TeamPick({ team, onClick, sub }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex: 1, minWidth: 0, minHeight: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.xs, background: C.surface, border: `1px solid ${C.border}`, borderTop: `4px solid ${team.color || C.text2}`, borderRadius: R.control, color: C.text1, cursor: "pointer", padding: S.sm }}>
      <span style={{ fontSize: T.cardTitle, fontWeight: 800, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
      {sub && <span style={{ fontSize: T.meta, color: C.text2 }}>{sub}</span>}
    </button>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: S.sm };

/**
 * Bottom sheet behind the four live action buttons (Golo · Assistência ·
 * Defesa · MVP) plus substitutions. Keeps the exact scoring semantics of
 * the old inline pickers:
 *  - goal   → team → scorer → assist (optional). "Próprio golo": teamId is
 *             still the team that BENEFITS, scorer picked from the other side.
 *  - assist → pick a goal of this match with no assist yet → assister
 *             (same team, not the scorer) → onUpdateEvent(idx, {assistId}).
 *  - save   → team → player (the side's GR first) → onEpicSave.
 *  - mvp    → read-only: tonight's leaders; the real vote opens for
 *             everyone when the day ends (MVP needs every player's say).
 *  - sub    → team → who leaves → who comes in (this match only).
 */
export default function LiveEventSheet({ kind, match, group, sides, roster, playerById, teamById, dayLeaders, onGoal, onUpdateEvent, onEpicSave, onSubstitute, onRevertSub, allPlayers, onSwitchKind, onClose, initial }) {
  const [step, setStep] = useState(initial || {}); // { teamId, ownGoal, scorerId, goalIdx, outId }
  const m = match;
  const other = (teamId) => (teamId === m.homeId ? m.awayId : m.homeId);
  const teamName = (id) => teamById(id)?.name ?? "—";
  const gkIdOf = (teamId) => (teamId === m.homeId ? m.homeGkId : m.awayGkId);
  const back = () => setStep((s) => {
    if (s.scorerId != null) return { ...s, scorerId: undefined };
    if (s.goalIdx != null) return {};
    if (s.outId != null) return { ...s, outId: undefined };
    return {};
  });
  const hasBack = step.teamId != null || step.goalIdx != null;
  const minute = () => currentTimerMinute();

  let title = "";
  let body = null;

  if (kind === "goal") {
    if (step.teamId == null) {
      title = t("Golo de que equipa?");
      body = <div style={{ display: "flex", gap: S.sm }}>{sides.map((id) => <TeamPick key={id} team={teamById(id) || { name: "—" }} onClick={() => setStep({ teamId: id, ownGoal: false })} />)}</div>;
    } else if (step.scorerId == null) {
      const fromTeam = step.ownGoal ? other(step.teamId) : step.teamId;
      title = step.ownGoal ? `${t("Próprio golo a favor de")} ${teamName(step.teamId)}` : `${t("Golo dos")} ${teamName(step.teamId)} — ${t("quem marcou?")}`;
      body = (
        <>
          <div style={{ marginBottom: S.md }}>
            <Chip variant={step.ownGoal ? "orange" : "neutral"} onClick={() => setStep((s) => ({ ...s, ownGoal: !s.ownGoal }))}>
              {step.ownGoal ? t("↩ Golo normal") : t("Foi próprio golo?")}
            </Chip>
          </div>
          <div style={grid}>
            {roster(fromTeam).map((p) => (
              <PlayerPick key={p.id} p={p} group={group} onClick={() => {
                if (step.ownGoal) { onGoal(m.id, { teamId: step.teamId, scorerId: p.id, ownGoal: true, minute: minute() }); onClose(); }
                else setStep((s) => ({ ...s, scorerId: p.id }));
              }} />
            ))}
          </div>
        </>
      );
    } else {
      title = `${t("Assistência de…")} (${playerById(step.scorerId)?.nick ?? ""})`;
      body = (
        <div style={grid}>
          {roster(step.teamId).filter((p) => p.id !== step.scorerId).map((p) => (
            <PlayerPick key={p.id} p={p} group={group} onClick={() => { onGoal(m.id, { teamId: step.teamId, scorerId: step.scorerId, assistId: p.id, minute: minute() }); onClose(); }} />
          ))}
          <button type="button" onClick={() => { onGoal(m.id, { teamId: step.teamId, scorerId: step.scorerId, assistId: null, minute: minute() }); onClose(); }}
            style={{ minHeight: 56, background: "transparent", color: C.text2, border: `1px dashed ${C.border}`, borderRadius: R.control, fontSize: T.body, fontWeight: 700, cursor: "pointer" }}>
            {t("Sem assistência")}
          </button>
        </div>
      );
    }
  } else if (kind === "assist") {
    const open = (m.events || []).map((e, idx) => ({ e, idx })).filter(({ e }) => !isSave(e) && !e.ownGoal && !e.assistId && e.scorerId != null);
    if (step.goalIdx == null) {
      title = t("Assistência para que golo?");
      body = open.length === 0 ? (
        <div>
          <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md, lineHeight: 1.4 }}>{t("Não há golos sem assistência neste jogo. Regista primeiro o golo — a assistência vem logo a seguir.")}</div>
          <BtnGhost block tone="accent" onClick={() => onSwitchKind("goal")}>{t("Registar golo")}</BtnGhost>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          {open.slice().reverse().map(({ e, idx }) => {
            const scorer = playerById(e.scorerId);
            return scorer ? (
              <PlayerPick key={idx} p={scorer} group={group} onClick={() => setStep({ goalIdx: idx, teamId: e.teamId, scorerId: e.scorerId })}
                tag={<span style={{ fontSize: T.meta, color: C.text2, flexShrink: 0 }}>⚽ {e.minute ? `${e.minute}'` : ""} · {teamName(e.teamId)}</span>} />
            ) : null;
          })}
        </div>
      );
    } else {
      title = `${t("Assistência de…")} (${t("golo de")} ${playerById(step.scorerId)?.nick ?? ""})`;
      body = (
        <div style={grid}>
          {roster(step.teamId).filter((p) => p.id !== step.scorerId).map((p) => (
            <PlayerPick key={p.id} p={p} group={group} onClick={() => { onUpdateEvent(m.id, step.goalIdx, { assistId: p.id }); onClose(); }} />
          ))}
        </div>
      );
    }
  } else if (kind === "save") {
    if (step.teamId == null) {
      title = t("Defesa de que equipa?");
      body = (
        <div style={{ display: "flex", gap: S.sm }}>
          {sides.map((id) => {
            const gk = playerById(gkIdOf(id));
            return <TeamPick key={id} team={teamById(id) || { name: "—" }} sub={gk ? `${t("GR")}: ${gk.nick}` : null} onClick={() => setStep({ teamId: id })} />;
          })}
        </div>
      );
    } else {
      const gkId = gkIdOf(step.teamId);
      const list = roster(step.teamId).slice().sort((a, b) => (b.id === gkId) - (a.id === gkId));
      title = `${t("Grande defesa")} — ${teamName(step.teamId)}`;
      body = (
        <div style={grid}>
          {list.map((p) => (
            <PlayerPick key={p.id} p={p} group={group} tag={p.id === gkId ? <Chip>{t("GR")}</Chip> : null}
              onClick={() => { onEpicSave(m.id, { teamId: step.teamId, playerId: p.id }); onClose(); }} />
          ))}
        </div>
      );
    }
  } else if (kind === "mvp") {
    title = t("Candidatos a MVP");
    body = (
      <>
        <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md, lineHeight: 1.4 }}>{t("A votação MVP abre para todos quando terminares o jogo. Para já, quem está a brilhar:")}</div>
        {dayLeaders.length === 0 ? (
          <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda sem golos ou assistências registados hoje.")}</div>
        ) : dayLeaders.slice(0, 5).map((row, i) => (
          <div key={row.p.id} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 52, borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <span style={{ width: 16, fontSize: T.body, fontWeight: 800, color: i === 0 ? C.gold : C.text2 }}>{i + 1}</span>
            <Avatar name={row.p.name} color={playerColor(group, row.p)} photo={row.p.photo} isMe={row.p.isMe} size={32} />
            <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.p.nick}</span>
            <span style={{ display: "flex", gap: S.sm, fontSize: T.meta, color: C.text2, flexShrink: 0 }}>
              {row.goals > 0 && <span>⚽ {row.goals}</span>}
              {row.assists > 0 && <span>🎯 {row.assists}</span>}
              {row.epicSaves > 0 && <span>🧤 {row.epicSaves}</span>}
            </span>
          </div>
        ))}
      </>
    );
  } else if (kind === "sub") {
    const subsFor = (teamId) => (m.subs || []).filter((s) => s.teamId === teamId);
    if (step.teamId == null) {
      title = t("Substituição");
      body = <div style={{ display: "flex", gap: S.sm }}>{sides.map((id) => <TeamPick key={id} team={teamById(id) || { name: "—" }} sub={subsFor(id).length ? `${subsFor(id).length} ${t("subst.")}` : null} onClick={() => setStep({ teamId: id })} />)}</div>;
    } else {
      const current = roster(step.teamId);
      title = `${t("Substituição")} — ${teamName(step.teamId)} · ${step.outId != null ? t("Quem entra?") : t("Quem sai?")}`;
      body = (
        <>
          {subsFor(step.teamId).length > 0 && step.outId == null && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: S.md }}>
              {subsFor(step.teamId).map((s) => (
                <Chip key={s.outId} Icon={X} onClick={() => onRevertSub(m.id, step.teamId, s.outId)} title={t("Desfazer substituição")}>
                  {playerById(s.outId)?.nick} → {playerById(s.inId)?.nick}
                </Chip>
              ))}
            </div>
          )}
          <div style={grid}>
            {(step.outId != null ? allPlayers.filter((p) => !current.some((q) => q.id === p.id)) : current).map((p) => (
              <PlayerPick key={p.id} p={p} group={group} onClick={() => {
                if (step.outId != null) { onSubstitute(m.id, step.teamId, step.outId, p.id); onClose(); }
                else setStep((s) => ({ ...s, outId: p.id }));
              }} />
            ))}
          </div>
        </>
      );
    }
  }

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: "fixed", inset: 0, zIndex: 60, background: `${C.bg}CC`, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", overflowY: "auto", background: C.card, borderTop: `1px solid ${C.border}`, borderRadius: `${R.card}px ${R.card}px 0 0`, padding: `${S.md}px ${S.lg}px ${S.xl}px`, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: `0 auto ${S.md}px` }} />
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg }}>
          {hasBack && (
            <button type="button" onClick={back} aria-label={t("Voltar")}
              style={{ width: 44, height: 44, marginLeft: -12, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, fontSize: T.cardTitle, fontWeight: 800, lineHeight: 1.3 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label={t("Fechar")}
            style={{ width: 44, height: 44, marginRight: -12, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
