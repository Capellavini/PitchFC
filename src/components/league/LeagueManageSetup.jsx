import { useState } from "react";
import { S, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { setLeagueInfo } from "../../lib/leagueSetup";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import LeagueField from "./LeagueField";
import LeagueManageModules from "./LeagueManageModules";

/** "Liga": the league's name and city, and which modules it runs. */
export default function LeagueManageSetup({ ctx }) {
  const { state, act } = ctx;
  const info = state.data.league;
  const [name, setName] = useState(info.name || "");
  const [city, setCity] = useState(info.city || "");
  const [fullName, setFullName] = useState(info.fullName || "");
  const dirty = name !== (info.name || "") || city !== (info.city || "") || fullName !== (info.fullName || "");
  return (
    <div>
      <SectionLabel>{t("Identidade da liga")}</SectionLabel>
      <form onSubmit={(e) => { e.preventDefault(); act.setup((s) => setLeagueInfo(s, { name, city, fullName }), t("Liga guardada.")); }}
        style={{ ...cardStyle, display: "grid", gap: S.md, marginBottom: S.xl, maxWidth: 640 }}>
        <LeagueField label={t("Nome da liga")} hint={t("O nome curto, como aparece nos títulos (ex.: AFPCE).")}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={inputStyle()} autoComplete="off" />
        </LeagueField>
        <LeagueField label={t("Nome completo (opcional)")}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} style={inputStyle()} autoComplete="off" />
        </LeagueField>
        <LeagueField label={t("Cidade")}>
          <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} style={inputStyle()} autoComplete="off" />
        </LeagueField>
        <div><BtnPrimary type="submit" disabled={!dirty || name.trim().length < 2}>{t("Guardar")}</BtnPrimary></div>
      </form>
      <LeagueManageModules ctx={ctx} />
    </div>
  );
}
