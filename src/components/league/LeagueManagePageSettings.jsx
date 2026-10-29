import { useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { INTRO_MAX, pageSettings, setPageSettings } from "../../lib/leagueLanding";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import LeagueField from "./LeagueField";

const SECTIONS = [
  { key: "scorers", label: "Artilheiros", hint: "Os melhores marcadores e assistentes da competição." },
  { key: "teams", label: "Equipas", hint: "Os emblemas e nomes das equipas inscritas." },
  { key: "signup", label: "Inscrição no Pitch Manager", hint: "Os adeptos deixam o nome e o email para serem avisados quando o Pitch Manager da liga abrir." },
];

/** What the league's page says about itself: a welcome text, and which sections are shown.
 *  The calendar, results and the table are always there; the rest can be hidden. */
export default function LeagueManagePageSettings({ ctx }) {
  const { state, act } = ctx;
  const cur = pageSettings(state.data.league);
  const [intro, setIntro] = useState(cur.intro);
  const dirty = intro.trim() !== cur.intro;
  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("O que mostra")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <form onSubmit={(e) => { e.preventDefault(); act.setup((s) => setPageSettings(s, { intro }), t("Texto de boas-vindas guardado.")); }} style={{ display: "grid", gap: S.sm }}>
          <LeagueField label={t("Texto de boas-vindas")} hint={`${intro.length}/${INTRO_MAX} · ${t("Aparece por baixo do nome da liga.")}`}>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={INTRO_MAX} rows={3} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5 }} placeholder={t("Ex.: A liga de futebol de sábado do Porto. Aqui encontras tudo: jogos, resultados e classificação.")} />
          </LeagueField>
          <div><BtnPrimary type="submit" disabled={!dirty}>{t("Guardar texto")}</BtnPrimary></div>
        </form>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.md, display: "grid", gap: S.xs }}>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Jornadas, resultados e classificação aparecem sempre. O resto podes esconder.")}</div>
          {SECTIONS.map((s) => (
            <label key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: S.md, minHeight: 44, padding: `${S.xs}px 0`, cursor: "pointer" }}>
              <input type="checkbox" checked={cur[s.key]} onChange={(e) => act.setup((st) => setPageSettings(st, { [s.key]: e.target.checked }))} style={{ width: 22, height: 22, marginTop: 2, accentColor: C.accent, flexShrink: 0 }} />
              <span>
                <span style={{ display: "block", fontSize: T.body, fontWeight: 700 }}>{t(s.label)}</span>
                <span style={{ display: "block", fontSize: T.meta, color: C.text2, lineHeight: 1.4 }}>{t(s.hint)}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
