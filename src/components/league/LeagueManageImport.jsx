import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { C, S, T, inputStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { importTeams, importRoster, importCalendar } from "../../lib/leagueImport";
import SectionLabel from "./visual/SectionLabel";
import { Card, Actions, FilePick, Preview, rowsOf } from "./LeagueOnboarding";

/** Gerir > Importar — the same spreadsheet imports as the guided start, available at any time: a second division
 *  that joins later, next season's calendar, a squad list that arrives after kick-off. Every file is read and
 *  previewed first (what enters, what is left out and why); nothing is saved until the Gestor confirms. */
export default function LeagueManageImport({ ctx }) {
  const { state, act, notify } = ctx;
  const comps = (state.data.competitions || []).filter((c) => !c.closedSeasonId);
  const [compId, setCompId] = useState(comps[0]?.id || "");
  const comp = comps.find((c) => c.id === compId) || comps[0];
  const [pending, setPending] = useState(null); // { kind, rows, ... }
  const read = async (kind, file, run) => {
    const rows = await rowsOf(file, notify);
    if (!rows) return;
    setPending({ kind, rows, ...run(rows) });
  };

  if (!comps.length) return <Card><div style={{ color: C.text2, fontSize: T.body }}>{t("Cria primeiro uma competição em «Competições».")}</div></Card>;
  const done = () => setPending(null);
  const accept = ".xlsx,.csv,.tsv,.txt";

  return (
    <div style={{ display: "grid", gap: S.lg }}>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Carrega um Excel ou CSV. Vês primeiro o que entra e o que fica de fora; só se grava quando confirmares.")}</div>
      <label style={{ display: "grid", gap: S.xs, fontSize: T.meta, color: C.text2, fontWeight: 700, maxWidth: 420 }}>
        {t("Competição")}
        <select value={comp.id} onChange={(e) => { setCompId(e.target.value); setPending(null); }} style={inputStyle()}>
          {comps.map((c) => <option key={c.id} value={c.id}>{c.name}{c.season ? ` · ${c.season}` : ""}</option>)}
        </select>
      </label>

      <section>
        <SectionLabel>{t("Equipas")}</SectionLabel>
        <Card>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Uma coluna com o nome da equipa (e, se quiseres, Sigla e Campo).")}</div>
          <Actions><FilePick accept={accept} Icon={FileSpreadsheet} label={t("Carregar equipas")} onFile={(f) => read("teams", f, (rows) => { const r = importTeams(state, { competitionId: comp.id, rows }); return { added: r.added, entered: r.entered, skipped: r.skipped }; })} /></Actions>
        </Card>
        {pending?.kind === "teams" && (
          <div style={{ marginTop: S.md }}>
            <Preview title={tf(t("{n} equipas no ficheiro"), { n: pending.added.length + pending.entered.length })} lines={[...pending.added, ...pending.entered]} skipped={pending.skipped} confirmLabel={t("Adicionar")}
              onCancel={done} onConfirm={() => { if (act.setup((s) => importTeams(s, { competitionId: comp.id, rows: pending.rows }).state, tf(t("{n} equipas adicionadas."), { n: pending.added.length + pending.entered.length })).ok) done(); }} />
          </div>
        )}
      </section>

      <section>
        <SectionLabel>{t("Plantéis")}</SectionLabel>
        <Card>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Colunas Equipa, Nome, Número e Posição. As equipas têm de existir já.")}</div>
          <Actions><FilePick accept={accept} Icon={FileSpreadsheet} label={t("Carregar plantéis")} onFile={(f) => read("roster", f, (rows) => { const r = importRoster(state, { rows }); return { added: r.added, skipped: r.skipped }; })} /></Actions>
        </Card>
        {pending?.kind === "roster" && (
          <div style={{ marginTop: S.md }}>
            <Preview title={tf(t("{n} atletas prontos a entrar"), { n: pending.added })} lines={[]} skipped={pending.skipped} confirmLabel={t("Adicionar atletas")}
              onCancel={done} onConfirm={() => { if (act.setup((s) => importRoster(s, { rows: pending.rows }).state, tf(t("{n} atletas adicionados."), { n: pending.added })).ok) done(); }} />
          </div>
        )}
      </section>

      <section>
        <SectionLabel>{tf(t("Calendário · {c}"), { c: comp.short || comp.name })}</SectionLabel>
        <Card>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Colunas Data, Hora, Casa e Fora (e, se quiseres, Jornada e Local). As equipas que não existirem são criadas. Numa taça, importa uma fase de cada vez.")}</div>
          <Actions><FilePick accept={accept} Icon={FileSpreadsheet} label={t("Carregar calendário")} onFile={(f) => read("calendar", f, (rows) => { const r = importCalendar(state, { competitionId: comp.id, rows }); return { added: r.added, skipped: r.skipped, created: r.created }; })} /></Actions>
        </Card>
        {pending?.kind === "calendar" && (
          <div style={{ marginTop: S.md }}>
            <Preview title={tf(t("{n} jogos prontos a entrar"), { n: pending.added })} lines={pending.created.length ? [`${t("Equipas novas:")} ${pending.created.join(", ")}`] : []} skipped={pending.skipped} confirmLabel={t("Adicionar jogos")}
              onCancel={done} onConfirm={() => { if (act.setup((s) => importCalendar(s, { competitionId: comp.id, rows: pending.rows }).state, tf(t("{n} jogos adicionados."), { n: pending.added })).ok) done(); }} />
          </div>
        )}
      </section>
    </div>
  );
}
