import { useState } from "react";
import { S, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { modOn } from "../../lib/leagueDemo";
import { addCompetition } from "../../lib/leagueSetup";
import SegmentedControl from "../SegmentedControl";
import BtnPrimary from "../BtnPrimary";
import LeagueField from "./LeagueField";

const KINDS = [{ id: "league", label: "Campeonato" }, { id: "cup", label: "Taça" }];
const LEGS = [{ id: "1", label: "1 volta" }, { id: "2", label: "2 voltas" }, { id: "3", label: "3 voltas" }];

/** New competition: a championship (table, N rounds-robin) or a cup. */
export default function LeagueCompetitionForm({ ctx }) {
  const { act, state } = ctx;
  const [kind, setKind] = useState("league");
  const [legs, setLegs] = useState("1");
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [open, setOpen] = useState(state.data.competitions.length === 0);
  const submit = (e) => {
    e.preventDefault();
    const r = act.setup((s) => addCompetition(s, { name, kind, legs: Number(legs), season, category, sponsor }), t("Competição criada."));
    if (r?.ok) { setName(""); setSponsor(""); }
  };
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={{ ...cardStyle, marginBottom: S.xl, padding: `0 ${S.md}px` }}>
      <summary style={{ minHeight: 52, display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 800 }}>{t("Nova competição")}</summary>
      <form onSubmit={submit} style={{ display: "grid", gap: S.md, padding: `0 0 ${S.md}px`, maxWidth: 640 }}>
        <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
        <LeagueField label={t("Nome")} hint={t("Ex.: 1.ª Divisão, Taça da Associação.")}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={inputStyle()} autoComplete="off" required />
        </LeagueField>
        {kind === "league" && <SegmentedControl options={LEGS} value={legs} onChange={setLegs} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: S.md }}>
          <LeagueField label={t("Época")}><input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026/27" maxLength={12} style={inputStyle()} /></LeagueField>
          <LeagueField label={t("Modalidade")}><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("Futebol 7, futsal…")} maxLength={40} style={inputStyle()} /></LeagueField>
        </div>
        {modOn("sponsors") && (
          <LeagueField label={t("Patrocinador titular")} hint={t("Aparece no título: «Patrocinador · Nome».")}>
            <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} maxLength={60} style={inputStyle()} />
          </LeagueField>
        )}
        <div><BtnPrimary type="submit" disabled={name.trim().length < 2}>{t("Criar competição")}</BtnPrimary></div>
      </form>
    </details>
  );
}
