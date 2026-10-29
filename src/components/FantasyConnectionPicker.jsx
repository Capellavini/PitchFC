import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { connectionDraftIssue } from "../lib/core/fantasyRules";
import { t } from "../lib/i18n";
import { connectionIssueText } from "../lib/fantasyConnectionCopy";
import Sheet from "./Sheet";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import { playerColor } from "../lib/helpers";

/**
 * FantasyConnectionPicker — choose the pair (creator → finisher) from the
 * STARTERS of the lineup being edited. Two radio lists, so it works by
 * keyboard, screen reader and touch alike (picking two cards on the pitch is
 * never the only way). Nothing is stored here: "Usar esta dupla" only
 * updates the draft; the pair is final once the lineup save answers.
 *
 * Props:
 *  - group, starters   roster + the starters' uuids (current draft lineup).
 *  - value             { creatorId, finisherId } | null — current draft.
 *  - teams             real teams already drawn ([[uuid]…]) | null.
 *  - onUse({ creatorId, finisherId }), onClear(), onClose()
 */
export default function FantasyConnectionPicker({ group, starters, value, teams = null, onUse, onClear, onClose }) {
  const [creatorId, setCreatorId] = useState(value?.creatorId ?? null);
  const [finisherId, setFinisherId] = useState(value?.finisherId ?? null);
  const players = starters.map((id) => group.find((p) => p.uuid === id)).filter(Boolean);
  const nameOf = (id) => players.find((p) => p.uuid === id)?.nick ?? "?";
  const issue = creatorId != null && finisherId != null ? connectionDraftIssue({ creator: creatorId, finisher: finisherId }, starters, teams) : null;
  const ready = creatorId != null && finisherId != null && !issue;

  const list = (label, selected, other, setSelected, role) => (
    <div role="radiogroup" aria-label={label} style={{ marginBottom: S.lg }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.xs }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: S.xs }}>
        {players.map((p) => {
          const on = selected === p.uuid;
          const taken = other === p.uuid;
          return (
            <button key={p.uuid} type="button" role="radio" aria-checked={on} onClick={() => setSelected(on ? null : p.uuid)}
              aria-label={`${p.nick}${taken ? ` — ${role === "creator" ? t("Finalizador") : t("Criador")}` : ""}`}
              style={{
                display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.min + 4, padding: `0 ${S.md}px`, borderRadius: R.control, cursor: "pointer", textAlign: "left", font: "inherit",
                background: on ? C.accentDim : C.card, color: C.text1, border: `1px solid ${on ? C.accent : C.border}`, opacity: taken ? 0.55 : 1,
              }}>
              <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} size={32} />
              <span style={{ flex: 1, minWidth: 0, fontSize: T.body + 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
              {taken && <span style={{ fontSize: T.min, color: C.text2 }}>{role === "creator" ? t("Finalizador") : t("Criador")}</span>}
              {on && <Check size={18} color={C.accent} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Sheet title={t("Conexão da ronda")} onClose={onClose}
      footer={(
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <BtnPrimary block disabled={!ready} onClick={() => onUse({ creatorId, finisherId })}>{t("Usar esta dupla")}</BtnPrimary>
          <BtnGhost block onClick={onClear}>{t("Continuar sem conexão")}</BtnGhost>
        </div>
      )}>
      <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.45, marginBottom: S.md }}>
        {t("Só os titulares podem formar a dupla. A direção importa: quem dá a assistência não é quem marca.")}
      </div>
      {list(t("Quem dá a assistência"), creatorId, finisherId, setCreatorId, "creator")}
      {list(t("Quem marca"), finisherId, creatorId, setFinisherId, "finisher")}
      <div aria-live="polite" style={{ minHeight: 24, fontSize: T.body - 1, fontWeight: 700, color: issue ? C.red : C.text1 }}>
        {issue ? connectionIssueText(issue, null) : ready && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
            {nameOf(creatorId)} <ArrowRight size={16} color={C.accent} aria-hidden /> {nameOf(finisherId)}
            <span style={{ fontWeight: 500, color: C.text2 }}>· {t("Assistência de")} {nameOf(creatorId)} {t("para golo de")} {nameOf(finisherId)}</span>
          </span>
        )}
      </div>
      {!teams && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4 }}>{t("Ainda não há equipas sorteadas: a conexão só pontua se jogarem na mesma equipa.")}</div>}
    </Sheet>
  );
}
