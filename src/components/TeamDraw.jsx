import { useState } from "react";
import { Shuffle, RotateCcw, Check, Pencil } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall, teamOverall as avgOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import ListRow from "./ListRow";
import SectionLabel from "./SectionLabel";

const selectStyle = {
  minHeight: 40, maxWidth: 110, background: "transparent", color: "inherit",
  borderRadius: R.control, fontSize: T.meta, fontWeight: 700, padding: "0 8px", outline: "none", cursor: "pointer",
};

/**
 * Position-balanced team draw — Matchday state A ("before"). Lives here
 * (not on the Jogo screen) since the redesign: Jogo is about confirming
 * + paying, Matchday about the day itself.
 *
 * Draft → confirmed: the organizer (or assistant) draws/renames/moves
 * freely — saved and synced, but hidden from players — and only after
 * "Confirmar equipas" do players see the lineup. Once confirmed everyone
 * sees the compact lineup view; managers can reopen the editor.
 *
 * Props:
 *  - group, teams ([{id,name,color,players:[id]}] | null), playing (the
 *    confirmed players inside the spots cap — the waiting line sits out).
 *  - canManage, confirmed, setByName, confirmedByName.
 *  - onDraw(n), onClear(), onRename(teamId, name), onMove(playerId, teamId),
 *    onSetCaptain(teamId, playerId|null), onConfirm().
 */
export default function TeamDraw({ group, teams, playing, canManage, confirmed, setByName, confirmedByName, onDraw, onClear, onRename, onMove, onSetCaptain, onConfirm, lockDraw = false, hideTeamId = null }) {
  const [numTeams, setNumTeams] = useState(teams?.length || 2);
  const [editing, setEditing] = useState(false);

  const resolve = (ids) => ids.map((id) => group.find((p) => p.id === id)).filter(Boolean);
  const captainOf = (tm) => (tm.captainId != null && tm.players.includes(tm.captainId) ? group.find((p) => p.id === tm.captainId) : null);
  const teamOverall = (tm) => avgOverall(tm, group);
  // Confirmed players not on any drawn team — they confirmed after the
  // draw, or a teammate declining freed a spot (releaseFromTeams in
  // PitchApp). The organizer patches the gap by hand instead of redrawing.
  const assigned = new Set((teams || []).flatMap((tm) => tm.players));
  const unassigned = teams ? playing.filter((p) => !assigned.has(p.id)) : [];
  const me = group.find((p) => p.isMe);

  const showEditor = canManage && (!confirmed || editing);
  // The viewer's own team is already the OwnTeamCard hero above — in the
  // read-only lineup only the OTHER teams are listed here (the editor
  // still shows every team, it needs them all to move players).
  const hidden = !showEditor && hideTeamId ? hideTeamId : null;
  const shownTeams = (teams || []).filter((tm) => tm.id !== hidden);
  const canDraw = playing.length >= 2;
  const countOptions = [2, 3, 4, 5, 6].filter((n) => n === 2 || n <= playing.length);

  const status = !teams ? null
    : confirmed ? <Chip variant="green" Icon={Check}>{t("Confirmadas")}</Chip>
    : <Chip variant="orange">{t("Rascunho")}</Chip>;

  // ── Nothing to show a regular player yet ────────────────
  if (!canManage && !confirmed) {
    return (
      <section style={{ marginBottom: S.xl }}>
        <SectionLabel>{t("Equipas")}</SectionLabel>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 700, marginBottom: S.xs }}>
            {teams ? t("Equipas em preparação") : t("Equipas por sortear")}
          </div>
          <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.4 }}>
            {teams
              ? `${t("O organizador está a preparar as equipas — aguarda a confirmação.")}${setByName ? ` (${setByName})` : ""}`
              : t("Só o organizador (ou o auxiliar) pode sortear e renomear.")}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: S.xl }}>
      <SectionLabel right={status}>{hidden ? t("Outras equipas") : t("Equipas")}</SectionLabel>

      {/* ── Draw controls (manager) ── */}
      {/* lockDraw: the day is live — players can still be moved/renamed,
          but a redraw or clear would orphan the logged matches. */}
      {showEditor && !lockDraw && (
        <div style={{ ...cardStyle, marginBottom: S.md }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 700 }}>{t("Sorteio equilibrado")}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, marginBottom: S.md, lineHeight: 1.4 }}>
            {canDraw
              ? t("Equilibrado por posição. Depois podes renomear e trocar jogadores.")
              : t("Faltam confirmações para sortear")}
          </div>
          <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>{t("Número de equipas")}</div>
          <div role="radiogroup" style={{ display: "flex", gap: S.sm, marginBottom: S.md }}>
            {countOptions.map((n) => {
              const active = numTeams === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={active} onClick={() => setNumTeams(n)}
                  style={{ flex: 1, minHeight: 44, borderRadius: R.control, background: active ? C.accent : "transparent", color: active ? C.bg : C.text1, border: `1px solid ${active ? C.accent : C.border}`, fontSize: T.body, fontWeight: 800, cursor: "pointer" }}>
                  {n}
                </button>
              );
            })}
          </div>
          {teams ? (
            <div style={{ display: "flex", gap: S.sm }}>
              <BtnGhost onClick={() => onDraw(numTeams)} disabled={!canDraw} style={{ flex: 1 }}>
                <Shuffle size={16} /> {t("Re-sortear")}
              </BtnGhost>
              <BtnGhost onClick={() => { onClear(); setEditing(false); }} aria-label={t("Limpar sorteio")} title={t("Limpar sorteio")} style={{ padding: `0 ${S.md}px` }}>
                <RotateCcw size={16} />
              </BtnGhost>
            </div>
          ) : (
            <BtnPrimary block onClick={() => onDraw(numTeams)} disabled={!canDraw}>
              <Shuffle size={16} /> {t("Sortear equipas")}
            </BtnPrimary>
          )}
          {teams && setByName && !confirmed && (
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t("Sorteado por")} {setByName} — {t("ainda por confirmar")}</div>
          )}
        </div>
      )}

      {/* ── Teams ── */}
      {teams && shownTeams.map((tm) => {
        const players = resolve(tm.players);
        const ovr = teamOverall(tm);
        const mine = me && tm.players.includes(me.id);
        return (
          <div key={tm.id} style={{ ...cardStyle, marginBottom: S.md, padding: showEditor ? `${S.md}px ${S.lg}px 0` : S.lg }}>
            <div style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 32, marginBottom: showEditor ? S.xs : S.md }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: tm.color, flexShrink: 0 }} />
              {showEditor ? (
                <input value={tm.name} onChange={(e) => onRename(tm.id, e.target.value)} aria-label={t("Nome da equipa")}
                  style={{ flex: 1, minWidth: 0, minHeight: 36, background: "none", border: "none", borderBottom: `1px dashed ${C.border}`, color: C.text1, fontSize: T.cardTitle, fontWeight: 800, outline: "none", padding: 0 }} />
              ) : (
                <span style={{ flex: 1, minWidth: 0, fontSize: T.cardTitle, fontWeight: 800, color: C.text1, overflowWrap: "break-word" }}>{tm.name}</span>
              )}
              {mine && !showEditor && <Chip variant="lime">{t("A tua equipa")}</Chip>}
              {ovr != null && <span style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, flexShrink: 0 }}>OVR {ovr}</span>}
            </div>

            {/* optional captain — shown under the team name on the live score */}
            {showEditor && onSetCaptain && players.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44 }}>
                <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, flexShrink: 0 }}>{t("Capitão")}</span>
                <select value={players.some((p) => p.id === tm.captainId) ? tm.captainId : ""} onChange={(e) => onSetCaptain(tm.id, e.target.value ? Number(e.target.value) || e.target.value : null)}
                  aria-label={t("Capitão")}
                  style={{ ...selectStyle, maxWidth: "none", flex: 1, minWidth: 0, color: tm.captainId ? C.text1 : C.text2, border: `1px solid ${C.border}`, background: C.card }}>
                  <option value="">{t("Sem capitão")}</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
                </select>
              </label>
            )}
            {!showEditor && captainOf(tm) && (
              <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.md }}>{t("Capitão")} {captainOf(tm).nick}</div>
            )}

            {players.length === 0 && (
              <div style={{ fontSize: T.meta, color: C.text2, padding: `${S.sm}px 0 ${S.md}px` }}>{t("sem jogadores")}</div>
            )}

            {showEditor ? players.map((p) => (
              <ListRow key={p.id}
                leading={<Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} size={36} />}
                title={p.isMe ? `${p.nick} (${t("tu")})` : p.nick}
                meta={t(p.position)}
                right={
                  <>
                    {/* mockup lineup checklist: OVR per player, big italic */}
                    <span title="OVR" style={{ ...displayFont, fontSize: T.cardTitle + 2, color: C.text1, minWidth: 28, textAlign: "right" }}>{computeOverall(p.position, p.attrs)}</span>
                    {teams.length > 1 && (
                      <select value={tm.id} onChange={(e) => onMove(p.id, e.target.value)} aria-label={t("Mover de equipa")}
                        style={{ ...selectStyle, color: C.text2, border: `1px solid ${C.border}`, background: C.card }}>
                        {teams.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                      </select>
                    )}
                  </>
                } />
            )) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: S.md }}>
                {players.map((p) => (
                  <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, minWidth: 0 }}>
                    <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} size={48} />
                    <span style={{ fontSize: T.meta, fontWeight: p.isMe ? 800 : 600, color: C.text1, maxWidth: "100%", textAlign: "center", overflowWrap: "anywhere", lineHeight: 1.2 }}>{p.nick}</span>
                    <span style={{ fontSize: T.min, color: C.text2, marginTop: -2 }}>{p.position === "Guarda-redes" ? t("GR") : t(p.position)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Players left without a team ── */}
      {unassigned.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: S.md, padding: `${S.md}px ${S.lg}px 0`, borderLeft: `3px solid ${C.orange}` }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", color: C.orange, textTransform: "uppercase" }}>{t("Jogadores sem equipa")}</div>
          {unassigned.map((p) => (
            <ListRow key={p.id}
              leading={<Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} size={36} />}
              title={p.nick} meta={t(p.position)}
              right={canManage ? (
                <select defaultValue="" onChange={(e) => e.target.value && onMove(p.id, e.target.value)} aria-label={t("Colocar em…")}
                  style={{ ...selectStyle, color: C.text1, border: `1px solid ${C.border}`, background: C.card }}>
                  <option value="">{t("Colocar em…")}</option>
                  {teams.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                </select>
              ) : null} />
          ))}
        </div>
      )}

      {/* ── Confirm / reopen ── */}
      {canManage && teams && !confirmed && (
        <BtnPrimary block onClick={onConfirm} disabled={teams.some((tm) => tm.players.length === 0)}>
          <Check size={16} /> {t("Confirmar equipas")}
        </BtnPrimary>
      )}
      {canManage && teams && confirmed && (
        <BtnGhost block onClick={() => setEditing((v) => !v)}>
          {editing ? <><Check size={16} /> {t("Concluir edição")}</> : <><Pencil size={16} /> {t("Editar equipas")}</>}
        </BtnGhost>
      )}
      {confirmed && confirmedByName && !hidden && (
        <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.sm }}>{t("Confirmado por")} {confirmedByName}</div>
      )}
    </section>
  );
}
