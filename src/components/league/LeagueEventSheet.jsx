import { useState } from "react";
import { C, R, S, T, TOUCH, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { EVENT_LABEL } from "../../lib/leagueCopy";
import { PLAYERS, teamById, playerById, newEventId } from "../../lib/leagueDemo";
import Sheet from "../Sheet";
import BtnPrimary from "../BtnPrimary";

const TYPES = ["goal", "own_goal", "card_yellow", "card_red", "shootout_goal"];
const UNKNOWN = "__unknown__";

/**
 * Register (mode "new") or correct (mode "correct") one match event.
 * The event id is minted when the sheet OPENS — a double tap on "Guardar"
 * resends the same id and the log ignores it (idempotent). A correction
 * appends a NEW event that supersedes the original, with a mandatory
 * reason; "Anular lance" supersedes it with nothing (type void).
 * Goals may have an unknown scorer; assists are optional (only when
 * actually recorded). Own goal: pick the BENEFITING team, then the player
 * of the other team who scored it.
 */
export default function LeagueEventSheet({ match, mode = "new", original = null, onSubmit, onClose }) {
  const [id] = useState(() => newEventId(match.id));
  const [type, setType] = useState(original?.type || "goal");
  const [teamId, setTeamId] = useState(original?.teamId || match.homeId);
  const [playerId, setPlayerId] = useState(original ? (original.playerId || UNKNOWN) : UNKNOWN);
  const [assistId, setAssistId] = useState(original?.assistId || "");
  const [minute, setMinute] = useState(original?.minute ?? "");
  const [reason, setReason] = useState("");
  const [voidOnly, setVoidOnly] = useState(false);
  const [error, setError] = useState(null);

  const other = teamId === match.homeId ? match.awayId : match.homeId;
  const squadOf = (tid) => {
    const ids = match.lineups?.[tid]?.length ? match.lineups[tid] : PLAYERS.filter((p) => p.teamId === tid).map((p) => p.id);
    return ids.map((pid) => playerById[pid]).filter(Boolean);
  };
  const playerTeam = type === "own_goal" ? other : teamId;
  const options = squadOf(playerTeam);
  const isCard = type === "card_yellow" || type === "card_red";
  const canUnknown = !isCard;
  const correcting = mode === "correct";

  const submit = () => {
    setError(null);
    if (correcting && !reason.trim()) { setError(t("Indica um motivo — é obrigatório.")); return; }
    if (!voidOnly && isCard && (playerId === UNKNOWN || !playerId)) { setError(t("Um cartão precisa de atleta.")); return; }
    const min = minute === "" ? null : Math.max(0, Math.min(130, Number(minute)));
    const event = voidOnly
      ? { id, type: "void", teamId: null, supersedes: original.id, voidReason: reason.trim() }
      : {
        id, type, teamId,
        playerId: playerId === UNKNOWN ? null : playerId,
        assistId: type === "goal" && assistId ? assistId : null,
        minute: Number.isFinite(min) ? min : null,
        ...(correcting ? { supersedes: original.id, voidReason: reason.trim() } : {}),
      };
    const r = onSubmit(event);
    if (r?.ok || r?.same) onClose();
  };

  const label = { display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, margin: `${S.md}px 0 ${S.xs}px` };
  const pill = (active) => ({
    minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontWeight: 700, fontSize: T.meta,
    border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2,
  });

  return (
    <Sheet title={correcting ? t("Corrigir lance") : t("Registar lance")} onClose={onClose}
      footer={<BtnPrimary block onClick={submit}>{correcting ? (voidOnly ? t("Anular lance") : t("Guardar correção")) : t("Guardar lance")}</BtnPrimary>}>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>
        {teamById[match.homeId].name} – {teamById[match.awayId].name} · {t("id do lance")}: <code style={{ fontSize: T.min }}>{id}</code>
      </div>

      {correcting && (
        <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, fontSize: T.body, cursor: "pointer" }}>
          <input type="checkbox" checked={voidOnly} onChange={(e) => setVoidOnly(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.red }} />
          {t("Anular este lance (sem substituto)")}
        </label>
      )}

      {!voidOnly && (
        <>
          <span style={label}>{t("Tipo")}</span>
          <div role="radiogroup" aria-label={t("Tipo")} style={{ display: "flex", gap: S.xs, flexWrap: "wrap" }}>
            {TYPES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => { setType(k); setPlayerId(UNKNOWN); setAssistId(""); }} style={pill(type === k)}>{t(EVENT_LABEL[k])}</button>
            ))}
          </div>
          {type === "shootout_goal" && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{t("Penáltis de desempate ficam separados: não entram no resultado nem na lista de marcadores.")}</div>}

          <span style={label}>{type === "own_goal" ? t("Equipa beneficiada") : isCard ? t("Equipa do atleta") : t("Equipa")}</span>
          <div role="radiogroup" aria-label={t("Equipa")} style={{ display: "flex", gap: S.xs, flexWrap: "wrap" }}>
            {[match.homeId, match.awayId].map((tid) => (
              <button key={tid} type="button" role="radio" aria-checked={teamId === tid} onClick={() => { setTeamId(tid); setPlayerId(UNKNOWN); setAssistId(""); }} style={{ ...pill(teamId === tid), flex: "1 1 120px" }}>{teamById[tid].name}</button>
            ))}
          </div>

          <label htmlFor="lg-ev-player" style={label}>{type === "own_goal" ? tf2(t("Autor do autogolo ({team})"), teamById[playerTeam].short) : isCard ? t("Atleta") : t("Autor")}</label>
          <select id="lg-ev-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={inputStyle()}>
            {canUnknown && <option value={UNKNOWN}>{t("Autor por identificar")}</option>}
            {!canUnknown && <option value={UNKNOWN}>{t("Escolhe o atleta")}</option>}
            {options.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
          </select>

          {type === "goal" && (
            <>
              <label htmlFor="lg-ev-assist" style={label}>{t("Assistência (opcional — só se registada)")}</label>
              <select id="lg-ev-assist" value={assistId} onChange={(e) => setAssistId(e.target.value)} style={inputStyle()}>
                <option value="">{t("Sem assistência")}</option>
                {options.filter((p) => p.id !== playerId).map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
              </select>
            </>
          )}

          <label htmlFor="lg-ev-minute" style={label}>{t("Minuto (opcional)")}</label>
          <input id="lg-ev-minute" type="number" inputMode="numeric" min={0} max={130} value={minute} onChange={(e) => setMinute(e.target.value)} style={inputStyle()} />
        </>
      )}

      {correcting && (
        <>
          <label htmlFor="lg-ev-reason" style={label}>{t("Motivo da correção (obrigatório)")}</label>
          <textarea id="lg-ev-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={280} required
            style={{ ...inputStyle(), minHeight: 88, resize: "vertical" }} />
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{t("O lance original fica no histórico da súmula — a correção não o apaga.")}</div>
        </>
      )}
      {error && <div role="alert" style={{ color: C.red, fontSize: T.meta, marginTop: S.sm }}>{error}</div>}
    </Sheet>
  );
}

const tf2 = (s, team) => s.replace("{team}", team);
