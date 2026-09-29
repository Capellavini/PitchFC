import { useState } from "react";
import { Play, Clock } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";
import SegmentedControl from "./SegmentedControl";
import SectionLabel from "./SectionLabel";

const MODES = [
  { id: "avulsa",        label: "Avulsa",        hint: "Marca golos e assistências, sem tabela." },
  { id: "campeonato",    label: "Campeonato",    hint: "Pontos, saldo de golos e classificação." },
  { id: "personalizado", label: "Personalizado", hint: "Defines as tuas próprias regras — calendário automático." },
];

const DEFAULT_CUSTOM_CONFIG = { confrontos: "unico", faseFinal: false, finalistas: 2, byePrimeiro: false, penaltis: false };

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 44, cursor: "pointer", fontSize: T.body }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Matchday state A, last step: pick the format and blow the whistle.
 * Managers only get the "Começar jogo" CTA once teams are confirmed (the
 * teams card above owns the lime CTA until then — one primary per step).
 * Regular players see a quiet "waiting for kickoff" card.
 */
export default function MatchdayFormatCard({ teams, canManage, teamsConfirmed, onStart }) {
  const [mode, setMode] = useState("avulsa");
  const [cfg, setCfg] = useState(DEFAULT_CUSTOM_CONFIG);
  const list = Array.isArray(teams) ? teams : [];
  const ready = list.length >= 2 && teamsConfirmed;

  if (!canManage) {
    return (
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl }}>
        <Clock size={20} color={C.text2} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.4 }}>{t("Aguarda o organizador começar o dia de jogo.")}</div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ ...cardStyle, marginBottom: S.xl, background: "transparent", borderStyle: "dashed" }}>
        <div style={{ fontSize: T.body, fontWeight: 700, color: C.text2 }}>{t("Formato e apito inicial")}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t("Sorteia e confirma as equipas para começar.")}</div>
      </div>
    );
  }

  return (
    <section style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Formato")}</SectionLabel>
      <div style={{ ...cardStyle }}>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} style={{ marginBottom: S.sm }} />
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>{t(MODES.find((m) => m.id === mode).hint)}</div>

        {mode === "personalizado" && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.md, marginBottom: S.lg }}>
            <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>{t("Confrontos")}</div>
            <div style={{ display: "flex", gap: S.sm, marginBottom: S.sm }}>
              {[["unico", "Único (cada equipa joga uma vez)"], ["idaEVolta", "Ida e volta (repete confronto)"]].map(([id, label]) => {
                const active = cfg.confrontos === id;
                return (
                  <button key={id} type="button" onClick={() => setCfg((c) => ({ ...c, confrontos: id }))}
                    style={{ flex: 1, minHeight: 44, background: active ? C.accentDim : "transparent", color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: R.control, padding: "6px 8px", fontSize: T.meta, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
                    {t(label)}
                  </button>
                );
              })}
            </div>
            <Toggle checked={cfg.faseFinal} onChange={(v) => setCfg((c) => ({ ...c, faseFinal: v }))} label={t("Ter fase final (play-off)")} />
            {cfg.faseFinal && (
              <div style={{ paddingLeft: S.xl }}>
                <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44, fontSize: T.body }}>
                  <span style={{ flex: 1 }}>{t("Quantas equipas vão à final:")}</span>
                  <input type="number" min={2} max={list.length || 6} value={cfg.finalistas}
                    onChange={(e) => setCfg((c) => ({ ...c, finalistas: Math.max(2, Number(e.target.value) || 2) }))}
                    style={{ width: 56, minHeight: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 8px", fontSize: T.body, color: C.text1, outline: "none" }} />
                </label>
                <Toggle checked={cfg.byePrimeiro} onChange={(v) => setCfg((c) => ({ ...c, byePrimeiro: v }))} label={t("1º lugar da fase de grupos vai direto à final")} />
                <Toggle checked={cfg.penaltis} onChange={(v) => setCfg((c) => ({ ...c, penaltis: v }))} label={t("Permitir grandes penalidades em caso de empate")} />
              </div>
            )}
          </div>
        )}

        <BtnPrimary block onClick={() => onStart(mode, mode === "personalizado" ? cfg : undefined)}>
          <Play size={16} /> {t("Começar jogo")}
        </BtnPrimary>
      </div>
    </section>
  );
}
