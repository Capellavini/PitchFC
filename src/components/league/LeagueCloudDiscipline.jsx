import { useEffect, useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { plural, tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { disciplineRows } from "../../lib/leagueMatches";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueDiscipline from "./LeagueDiscipline";

const TRIGGER = { red: "Vermelho direto", second_yellow: "Segundo amarelo", yellow_accumulation: "Acumulação de amarelos", manual: "Decisão manual" };

/** Disciplina (cloud): official cards + confirmed suspensions (public,
 *  rendered by the demo's LeagueDiscipline) and — Gestor — the case inbox:
 *  homologation only SUGGESTS suspensions; nothing blocks a player until
 *  the organisation confirms (with reason) — brief §9, plan §3.11. */
export default function LeagueCloudDiscipline({ leagues, competition, dir, isManager, viewKey, ui }) {
  const [data, setData] = useState(null);
  const [cases, setCases] = useState([]);
  const [draft, setDraft] = useState({});
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [dq, sq, cq] = await Promise.all([
        leagues.fetchDiscipline(competition.id, viewKey), leagues.fetchPlayerStats(competition.id, viewKey),
        isManager ? leagues.fetchDisciplineCases(competition.id) : Promise.resolve({ data: { items: [] } }),
      ]);
      if (!alive) return;
      if (dq.error) ui.fail(dq.error);
      setData(disciplineRows(sq.data || [], dq.data || { suspended: [] }));
      setCases(cq.data?.items || []);
    })();
    return () => { alive = false; };
  }, [leagues, competition.id, viewKey, isManager, ui, rev]);

  if (!data) return <div style={{ color: C.text2, marginTop: S.md }}>…</div>;
  const decide = async (c, decision) => {
    const d = draft[c.id] || {};
    const reason = (d.reason || "").trim();
    if (!reason) { ui.fail("reason_required"); return; }
    const r = await leagues.decideDisciplineCase(c.id, decision, decision === "confirm" ? Number(d.matches ?? c.suggested) : 0, reason);
    if (r.error) ui.fail(r.error); else { ui.ok(decision === "confirm" ? t("Suspensão confirmada.") : t("Caso arquivado.")); setRev((n) => n + 1); }
  };
  const pendingCases = cases.filter((c) => c.status === "pending");

  return (
    <div style={{ marginTop: S.md }}>
      {isManager && (
        <section style={{ ...cardStyle, marginBottom: S.lg }}>
          <SectionLabel right={pendingCases.length ? <Chip variant="orange">{pendingCases.length}</Chip> : null}>{t(LM.cases)}</SectionLabel>
          {cases.length === 0 && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Sem casos. Ao homologar, vermelhos e segundos amarelos abrem um caso sugerido.")}</div>}
          {cases.map((c) => (
            <div key={c.id} style={{ borderBottom: `1px solid ${C.border}`, padding: `${S.sm}px 0` }}>
              <div style={{ display: "flex", gap: S.sm, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700 }}>{c.name || dir.playerById[c.playerId]?.name || "—"}</span>
                <Chip variant={c.status === "pending" ? "orange" : c.status === "confirmed" ? "red" : "neutral"}>
                  {c.status === "pending" ? t("Por decidir") : c.status === "confirmed" ? t("Confirmado") : t("Arquivado")}
                </Chip>
              </div>
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>
                {c.teamName || dir.teamById[c.teamId]?.name || "—"} · {t(TRIGGER[c.trigger] || c.trigger)}{c.round ? ` · ${tf(LM.round, { n: c.round })}` : ""}
                {c.status === "pending" ? ` · ${tf(t("sugestão: {n}"), { n: plural(c.suggested, "jogo", "jogos") })}` : c.status === "confirmed" ? ` · ${plural(c.decided ?? 0, "jogo", "jogos")}${c.served != null ? ` · ${tf(t("cumpriu {n}"), { n: c.served })}` : ""}` : ""}
                {c.reason ? ` · “${c.reason}”` : ""}
              </div>
              {c.status === "pending" && (
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.sm }}>
                  <input aria-label={t("Jogos de suspensão")} inputMode="numeric" value={draft[c.id]?.matches ?? String(c.suggested)} onChange={(e) => setDraft({ ...draft, [c.id]: { ...draft[c.id], matches: e.target.value.replace(/\D/g, "").slice(0, 2) } })} style={{ ...inputStyle(), width: 72, flex: "0 0 72px" }} />
                  <input aria-label={t("Motivo (obrigatório)")} placeholder={t("Motivo (obrigatório)")} value={draft[c.id]?.reason || ""} maxLength={200} onChange={(e) => setDraft({ ...draft, [c.id]: { ...draft[c.id], reason: e.target.value } })} style={{ ...inputStyle(), flex: "1 1 160px", width: "auto" }} />
                  <BtnGhost tone="accent" onClick={() => decide(c, "confirm")} style={{ flex: "1 1 110px" }}>{t(LM.confirm)}</BtnGhost>
                  <BtnGhost onClick={() => decide(c, "waive")} style={{ flex: "1 1 110px" }}>{t(LM.waive)}</BtnGhost>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      <LeagueDiscipline discipline={data} dir={dir} onPlayer={() => {}}
        note={t("Só jogos homologados contam. Uma suspensão só existe depois de a organização a confirmar, com motivo — o regulamento apenas sugere.")} />
    </div>
  );
}
