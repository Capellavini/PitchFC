import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Flag } from "lucide-react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { seasonChecklist, proposedChampions, nextSeasonLabel } from "../../lib/leagueSeason";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import LeagueSeasonArchive from "./LeagueSeasonArchive";
import LeagueReenroll from "./LeagueReenroll";
import LeagueSeasonMovements from "./LeagueSeasonMovements";
import LeagueRegulationCard from "./LeagueRegulationCard";
import LeagueSupercupCard from "./LeagueSupercupCard";
import { championQuestion } from "../../lib/leagueRegulation";

const CONFIRM_WORD = "FECHAR";

/** Gerir > Época — close the season (champions, final tables and scorers frozen in an archive), then start the next.
 *  The app proposes the champion of each competition; the Gestor confirms it or names another with a reason.
 *  Nothing is closed while any game lacks an official result. */
export default function LeagueManageSeason({ ctx }) {
  const { state, act } = ctx;
  const comps = state.data.competitions || [];
  const open = comps.filter((c) => !c.closedSeasonId);
  const seasons = state.data.seasons || [];
  const check = useMemo(() => seasonChecklist(state), [state]);
  const proposed = useMemo(() => proposedChampions(state), [state]);
  const teams = state.data.teams || [];
  const teamName = (id) => teams.find((x) => x.id === id)?.name || "—";
  const [label, setLabel] = useState(() => open[0]?.season || "");
  const [manual, setManual] = useState({}); // competitionId → { on, teamId, note }
  const [word, setWord] = useState("");
  const [nextLabel, setNextLabel] = useState(() => nextSeasonLabel(comps[0]?.season || ""));
  const [note, setNote] = useState({}); // seasonId → text
  const [moves, setMoves] = useState({ list: [], error: null }); // promotions / relegations the Gestor confirmed

  const overrides = Object.fromEntries(Object.entries(manual).filter(([, v]) => v.on && v.teamId).map(([id, v]) => [id, { teamId: v.teamId, note: v.note || "" }]));
  const manualOk = Object.entries(manual).every(([, v]) => !v.on || (v.teamId && String(v.note || "").trim().length >= 5));
  const canSubmit = check.canClose && label.trim().length >= 2 && word.trim().toUpperCase() === CONFIRM_WORD && manualOk && !moves.error;
  const compName = (id) => comps.find((c) => c.id === id)?.short || comps.find((c) => c.id === id)?.name || "";
  const allClosed = comps.length > 0 && open.length === 0;

  return (
    <div>
      <LeagueRegulationCard ctx={ctx} />
      {open.length > 0 && (
        <section style={{ ...cardStyle, marginBottom: S.xl }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
            <Flag size={18} color={C.accent} aria-hidden />
            <h2 style={{ margin: 0, fontSize: T.cardTitle }}>{t("Fechar a época")}</h2>
          </div>
          <p style={{ margin: `0 0 ${S.md}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
            {t("Fechar guarda os campeões, as classificações finais, os marcadores e os resultados num registo que já não se altera, e a página pública passa a mostrá-lo em «Épocas anteriores». Só se fecha quando todos os jogos têm resultado oficial.")}
          </p>

          {check.blockers.length === 0 && check.games > 0 && (
            <div style={{ display: "flex", gap: S.sm, color: C.green, fontSize: T.body, fontWeight: 800, marginBottom: S.md }}><CheckCircle2 size={18} aria-hidden /> {t("Todos os jogos têm resultado oficial.")}</div>
          )}
          {check.games === 0 && <div style={{ color: C.text2, fontSize: T.body, marginBottom: S.md }}>{t("Ainda não há jogos nesta época.")}</div>}
          {check.blockers.map((b) => (
            <div key={`${b.kind}-${b.competitionId}`} role="status" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", color: C.orange, fontSize: T.body, marginBottom: S.sm }}>
              <AlertTriangle size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {b.kind === "open"
                  ? tf(t("{n} jogos sem resultado oficial em {c}."), { n: b.count, c: compName(b.competitionId) }) + (b.contested ? ` ${tf(t("{n} em revisão."), { n: b.contested })}` : "")
                  : tf(t("A final de {c} ainda não tem vencedor."), { c: compName(b.competitionId) })}
              </span>
              {b.kind === "open" && <BtnGhost compact onClick={() => ctx.goManage("calendar")}>{t("Ver calendário")}</BtnGhost>}
            </div>
          ))}

          {check.canClose && (
            <>
              <SectionLabel style={{ marginTop: S.lg }}>{t("Campeões")}</SectionLabel>
              <div style={{ display: "grid", gap: S.sm, marginBottom: S.lg }}>
                {open.map((c) => {
                  const p = proposed[c.id];
                  const m = manual[c.id] || { on: false, teamId: "", note: "" };
                  return (
                    <div key={c.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: S.md }}>
                      <div style={{ fontSize: T.meta, color: C.text2 }}>{c.name}</div>
                      <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{m.on && m.teamId ? teamName(m.teamId) : p ? teamName(p.teamId) : t("Sem campeão")}</div>
                      <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44, fontSize: T.meta, color: C.text2, cursor: "pointer" }}>
                        <input type="checkbox" checked={m.on} onChange={(e) => setManual((x) => ({ ...x, [c.id]: { ...m, on: e.target.checked } }))} style={{ width: 20, height: 20, accentColor: C.accent }} />
                        {t("A direção decide outro campeão")}
                      </label>
                      {ctx.act.askAdjunto && <BtnGhost tone="accent" compact onClick={() => ctx.act.askAdjunto(championQuestion(c.name, p ? teamName(p.teamId) : ""))}>{t("Verificar com o regulamento (Adjunto)")}</BtnGhost>}
                      {m.on && (
                        <div style={{ display: "grid", gap: S.sm }}>
                          <select value={m.teamId} onChange={(e) => setManual((x) => ({ ...x, [c.id]: { ...m, teamId: e.target.value } }))} aria-label={t("Campeão")} style={inputStyle()}>
                            <option value="">{t("Escolhe a equipa")}</option>
                            {(c.teamIds?.length ? c.teamIds : teams.map((x) => x.id)).map((id) => <option key={id} value={id}>{teamName(id)}</option>)}
                          </select>
                          <input value={m.note} onChange={(e) => setManual((x) => ({ ...x, [c.id]: { ...m, note: e.target.value.slice(0, 300) } }))} placeholder={t("Motivo (aparece na página pública)")} aria-label={t("Motivo")} style={inputStyle()} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <LeagueSeasonMovements state={state} onChange={(list, error) => setMoves({ list, error })} onAsk={ctx.act.askAdjunto} />

              <label htmlFor="ep-label" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("Nome da época")}</label>
              <input id="ep-label" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 20))} style={{ ...inputStyle(), marginBottom: S.md }} />
              <label htmlFor="ep-word" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{tf(t("Para confirmar escreve {w}"), { w: CONFIRM_WORD })}</label>
              <input id="ep-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" style={{ ...inputStyle(), marginBottom: S.md }} />
              <BtnPrimary disabled={!canSubmit} onClick={() => { if (act.closeSeason(label, overrides, moves.list).ok) setWord(""); }}>{t("Fechar época")}</BtnPrimary>
            </>
          )}
        </section>
      )}

      {allClosed && (
        <section style={{ ...cardStyle, marginBottom: S.xl, borderColor: C.accentBorder }}>
          <h2 style={{ margin: `0 0 ${S.sm}px`, fontSize: T.cardTitle }}>{t("Começar a próxima época")}</h2>
          <p style={{ margin: `0 0 ${S.md}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
            {t("Cria as mesmas competições, vazias, com as mesmas equipas mas sem plantéis: as inscrições dos atletas são decididas de novo. Os perfis ficam guardados e reinscreves quem a organização aceitar. Os jogos desta época saem do ecrã mas ficam em «Épocas anteriores».")}
          </p>
          <label htmlFor="ep-next" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("Nome da nova época")}</label>
          <input id="ep-next" value={nextLabel} onChange={(e) => setNextLabel(e.target.value.slice(0, 20))} style={{ ...inputStyle(), marginBottom: S.md }} />
          <BtnPrimary disabled={nextLabel.trim().length < 2} onClick={() => act.newSeason(nextLabel)}>{t("Começar nova época")}</BtnPrimary>
        </section>
      )}

      <LeagueSupercupCard ctx={ctx} />
      <LeagueReenroll ctx={ctx} />

      <SectionLabel>{t("Épocas anteriores")}</SectionLabel>
      {seasons.length === 0 ? <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>{t("Ainda não fechaste nenhuma época.")}</div> : (
        <>
          <LeagueSeasonArchive seasons={seasons} />
          <div style={{ display: "grid", gap: S.xs, marginTop: S.md }}>
            {seasons.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                <input value={note[s.id] || ""} onChange={(e) => setNote((x) => ({ ...x, [s.id]: e.target.value.slice(0, 400) }))} placeholder={`${t("Nota à época")} ${s.label}`} aria-label={`${t("Nota à época")} ${s.label}`} style={{ ...inputStyle(), flex: "1 1 220px" }} />
                <BtnGhost disabled={!(note[s.id] || "").trim()} onClick={() => { if (act.annotateSeason(s.id, note[s.id]).ok) setNote((x) => ({ ...x, [s.id]: "" })); }}>{t("Juntar nota")}</BtnGhost>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
