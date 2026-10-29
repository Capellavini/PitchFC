import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { PENDING_STATES, cardRows, provisionalStandings, rankingRows } from "../../lib/leagueMatches";
import BtnGhost from "../BtnGhost";
import SectionLabel from "../SectionLabel";
import SegmentedControl from "../SegmentedControl";
import LeagueStandingsTable from "./LeagueStandingsTable";
import LeagueRankingList from "./LeagueRankingList";

const TB_LABEL = { pts: "pontos", gd: "diferença de golos", gf: "golos marcados", h2h: "confronto direto", wins: "vitórias", ga_fewest: "menos golos sofridos" };

/** Classificação (cloud): the OFFICIAL table (competition_standings —
 *  homologated results, W.O. deductions and audited point adjustments)
 *  with a clearly labelled provisional toggle (official rows + the live /
 *  ended / in-review scores from match_page, computed client-side), then
 *  the official player rankings. Reuses the demo's LeagueStandingsTable +
 *  LeagueRankingList. Gestor: point adjustments (reason, audited). */
export default function LeagueCloudTable({ leagues, competition, dir, matches, isManager, viewKey, ui, followId, onTeam = () => {} }) {
  const [table, setTable] = useState(null);
  const [stats, setStats] = useState([]);
  const [pending, setPending] = useState([]);
  const [prov, setProv] = useState(false);
  const [rank, setRank] = useState("goals");
  const [adj, setAdj] = useState({ teamId: "", points: "", reason: "" });
  const [rev, setRev] = useState(0);
  const pendingMatches = matches.filter((m) => PENDING_STATES.has(m.state));

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sq, pq] = await Promise.all([leagues.fetchStandings(competition.id, viewKey), leagues.fetchPlayerStats(competition.id, viewKey)]);
      if (!alive) return;
      if (sq.error) ui.fail(sq.error);
      setTable(sq.data || null);
      setStats(pq.data || []);
    })();
    return () => { alive = false; };
  }, [leagues, competition.id, viewKey, ui, rev]);

  // Provisional scores only when asked (one match_page per pending match).
  useEffect(() => {
    if (!prov || !pendingMatches.length) return undefined;
    let alive = true;
    Promise.all(pendingMatches.map((m) => leagues.fetchMatch(m.id, viewKey))).then((rs) => {
      if (!alive) return;
      setPending(rs.map((r) => r.data).filter(Boolean).map((p) => ({ homeId: p.match.homeId, awayId: p.match.awayId, home: p.score.home, away: p.score.away })));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prov, matches, leagues, viewKey]);

  if (!table) return <div style={{ color: C.text2, marginTop: S.md }}>…</div>;
  const official = table.rows.map((r) => ({ ...r, color: dir.teamById[r.id]?.color ?? r.color, short: dir.teamById[r.id]?.short || r.short }));
  const rows = prov ? provisionalStandings(official, pending, table) : official;
  const ties = rows.some((r) => r.tieUnresolved && r.j > 0);

  const saveAdj = async () => {
    const r = await leagues.adjustPoints(competition.id, adj.teamId, Number(adj.points), adj.reason.trim());
    if (r.error) { ui.fail(r.error); return; }
    ui.ok(t("Ajuste registado — visível junto à classificação."));
    setAdj({ teamId: "", points: "", reason: "" }); setRev((n) => n + 1);
  };
  const revoke = async (a) => {
    const reason = (window.prompt(t("Motivo para anular o ajuste (obrigatório)")) || "").trim();
    if (!reason) return;
    const r = await leagues.revokeAdjustment(a.id, reason);
    if (r.error) ui.fail(r.error); else { ui.ok(t("Ajuste anulado (fica no histórico).")); setRev((n) => n + 1); }
  };

  return (
    <div style={{ marginTop: S.md }}>
      <label style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.min, marginBottom: S.md, cursor: "pointer", fontSize: T.body, color: C.text1 }}>
        <input type="checkbox" checked={prov} onChange={(e) => setProv(e.target.checked)} style={{ width: 22, height: 22, accentColor: C.orange, flexShrink: 0 }} />
        <span>
          <span style={{ fontWeight: 800 }}>{t(LM.includeProvisional)}</span>
          <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{pendingMatches.length} {t("jogos ainda não homologados")}</span>
        </span>
      </label>
      {prov && (
        <div role="note" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", background: C.orangeDim, border: `1px solid ${C.orange}55`, borderRadius: R.control, padding: S.md, marginBottom: S.md, fontSize: T.meta, color: C.text1, lineHeight: 1.5 }}>
          <AlertTriangle size={16} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>{t("Provisória")}.</b> {t("Inclui jogos ao vivo, terminados e em validação. Não é a classificação oficial — pode mudar com a homologação.")}</span>
        </div>
      )}

      <SectionLabel>{t(prov ? LM.provisionalTable : LM.officialTable)}</SectionLabel>
      {rows.length ? <LeagueStandingsTable rows={rows} followId={followId} provisional={prov} onTeam={onTeam} />
        : <div style={{ fontSize: T.meta, color: C.text2 }}>{t("A classificação aparece quando o regulamento estiver publicado e houver equipas homologadas.")}</div>}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, margin: `${S.sm}px 0 ${S.lg}px` }}>
        {tf(t("Vitória {w} · empate {d} · derrota {l}. Desempate:"), { w: table.points.win, d: table.points.draw, l: table.points.loss })} {(table.tiebreakers || []).map((k) => t(TB_LABEL[k] || k)).join(" → ")}.
        {ties ? ` ${t("Equipas empatadas em todos os critérios partilham a posição (sem sorteio).")}` : ""}
        {table.regulationVersion ? ` ${tf(t("Regulamento v{v}."), { v: table.regulationVersion })}` : ""}
      </div>

      {(table.adjustments.length > 0 || isManager) && (
        <section style={{ ...cardStyle, marginBottom: S.xl }}>
          <SectionLabel>{t(LM.adjustments)}</SectionLabel>
          {table.adjustments.length === 0 && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Sem ajustes.")}</div>}
          {table.adjustments.map((a, i) => (
            <div key={a.id || i} style={{ display: "flex", gap: S.sm, alignItems: "center", fontSize: T.meta, padding: `${S.xs}px 0`, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ flex: 1 }}><b>{dir.teamById[a.teamId]?.name || "—"}</b> · {a.points > 0 ? `+${a.points}` : a.points} pts · “{a.reason}”</span>
              {isManager && a.id && <BtnGhost compact onClick={() => revoke(a)}>{t("Anular")}</BtnGhost>}
            </div>
          ))}
          {isManager && (
            <div style={{ display: "grid", gap: S.sm, marginTop: S.md }}>
              <select aria-label={t("Equipa")} value={adj.teamId} onChange={(e) => setAdj({ ...adj, teamId: e.target.value })} style={inputStyle()}>
                <option value="">{t("Equipa…")}</option>
                {dir.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
              <input aria-label={t("Pontos (ex.: -3)")} placeholder={t("Pontos (ex.: -3)")} inputMode="numeric" value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value.replace(/[^\d-]/g, "").slice(0, 3) })} style={inputStyle()} />
              <input aria-label={t("Motivo (obrigatório)")} placeholder={t("Motivo (obrigatório)")} value={adj.reason} maxLength={200} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} style={inputStyle()} />
              <BtnGhost tone="accent" disabled={!adj.teamId || !adj.points || adj.reason.trim().length < 5} onClick={saveAdj}>{t(LM.adjust)}</BtnGhost>
            </div>
          )}
        </section>
      )}

      <SectionLabel>{t(LM.rankings)} · {t("só jogos homologados")}</SectionLabel>
      <SegmentedControl value={rank} onChange={setRank} options={[{ id: "goals", label: t(LM.goals) }, { id: "assists", label: t(LM.assists) }, { id: "cards", label: t(LM.cards) }]} />
      <div style={{ ...cardStyle, paddingTop: 0, paddingBottom: 0 }}>
        {rank === "cards"
          ? <LeagueRankingList rows={cardRows(stats)} dir={dir} onPlayer={() => {}} render={(r) => `${r.y}🟨 ${r.r}🟥`} />
          : <LeagueRankingList rows={rankingRows(stats, rank, 10)} dir={dir} onPlayer={() => {}} />}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
        {t("Golos não incluem autogolos. Assistências só contam quando registadas na ficha de jogo. Golos de autor por identificar contam no resultado, não no ranking.")}
      </div>
    </div>
  );
}
