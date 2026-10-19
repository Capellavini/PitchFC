import { useState } from "react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { FANTASY_V2 } from "../lib/core/fantasyRules";
import { fmtM } from "../lib/fantasy";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface, color: C.text1,
  border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 12px", minHeight: TOUCH.min, fontSize: T.body, marginTop: S.xs,
};
const labelStyle = { fontSize: T.min, color: C.text2, fontWeight: 700 };

/** Organizer creates the group's Pitch Manager (Club-gated upstream).
 *  Mode: Clássico (budget + prices) now; Draft is shown as "em breve"
 *  (Phase C) and can't be picked. No duration: the league keeps running,
 *  with a Taça do Mês and a Campeonato da Época that renew by themselves. */
export default function FantasyCreateLeague({ isOrganizer, onCreateLeague }) {
  const [form, setForm] = useState({ name: "Pitch Manager", budget: 120, squadSize: 5 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const startPrice = FANTASY_V2.priceBase;
  const affordable = Math.floor((Number(form.budget) || 0) / startPrice);

  if (!isOrganizer) {
    return (
      <div style={{ padding: S.lg }}>
        <div style={cardStyle}>
          <div style={{ fontSize: T.body - 1, color: C.text2 }}>{t("Ainda não há Pitch Manager neste grupo.")}</div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setCreating(true);
    setError(null);
    const res = await onCreateLeague({
      name: form.name.trim() || "Pitch Manager",
      budget: Number(form.budget) || 120,
      squadSize: Math.max(1, Number(form.squadSize) || 5),
      mode: "classic",
    });
    setCreating(false);
    if (res?.error) setError(res.error);
  };

  const modeBtn = (active, disabled) => ({
    flex: 1, minHeight: TOUCH.min, borderRadius: R.control, cursor: disabled ? "not-allowed" : "pointer",
    background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2,
    border: `1px solid ${active ? C.accentBorder : C.border}`, fontSize: T.body - 1, fontWeight: active ? 800 : 600,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: `${S.xs}px ${S.sm}px`,
    opacity: disabled ? 0.55 : 1,
  });

  return (
    <div style={{ padding: S.lg }}>
      <SectionLabel>PITCH MANAGER</SectionLabel>
      <div style={cardStyle}>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, marginBottom: S.xs }}>{t("Criar Pitch Manager")}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg, lineHeight: 1.4 }}>
          {t("Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.")}
        </div>

        <div style={labelStyle}>{t("Modo")}</div>
        <div style={{ display: "flex", gap: S.sm, marginTop: S.xs, marginBottom: S.md }}>
          <button type="button" aria-pressed="true" style={modeBtn(true, false)}>
            <span>{t("Clássico")}</span>
            <span style={{ fontSize: T.min, fontWeight: 500, color: C.text2 }}>{t("orçamento e preços")}</span>
          </button>
          <button type="button" disabled aria-disabled="true" style={modeBtn(false, true)}>
            <span>Draft</span>
            <span style={{ fontSize: T.min, fontWeight: 500 }}>{t("em breve")}</span>
          </button>
        </div>

        <label style={labelStyle}>{t("Nome da liga")}
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
        </label>
        <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
          <label style={{ ...labelStyle, flex: 1, minWidth: 0 }}>{t("Orçamento")}
            <input type="number" min={20} value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1, minWidth: 0 }}>{t("Titulares")}
            <input type="number" min={1} max={11} value={form.squadSize} onChange={(e) => setForm((f) => ({ ...f, squadSize: e.target.value }))} style={inputStyle} />
          </label>
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.4 }}>
          {t("Todos começam a")} {fmtM(startPrice)}. {t("Com este orçamento dá para")} {affordable} {t("jogadores de início.")}
          {" "}{t("A liga não acaba: há Taça do Mês e Campeonato da Época, que renovam sozinhos.")}
        </div>
        <BtnPrimary onClick={submit} disabled={creating} style={{ width: "100%", marginTop: S.lg, opacity: creating ? 0.6 : 1 }}>
          {creating ? t("Um momento…") : t("Criar Pitch Manager")}
        </BtnPrimary>
        {error && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{error}</div>}
      </div>
    </div>
  );
}
