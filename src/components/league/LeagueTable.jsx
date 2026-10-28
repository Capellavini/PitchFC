import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { PLAYERS, TEAMS, COMPETITIONS, competitionById, tableOfTeam, competitionTitle, modOn } from "../../lib/leagueDemo";
import { ranking } from "../../lib/core/league";
import SectionLabel from "../SectionLabel";
import SegmentedControl from "../SegmentedControl";
import LeagueStandingsTable from "./LeagueStandingsTable";
import LeagueRankingList from "./LeagueRankingList";
import LeagueFairPlay from "./LeagueFairPlay";
import BtnGhost from "../BtnGhost";

const TB_LABEL = { pts: "pontos", gd: "diferença de golos", gf: "golos marcados", h2h: "confronto direto", wins: "vitórias", ga_fewest: "menos golos sofridos", lots: "sorteio" };

/** Classificação: official table (homologated only) with a clearly
 *  labelled "provisória" toggle, then player rankings (golos,
 *  assistências, cartões) under the same toggle. A league can run several
 *  tables (divisions): the Gestor's competition scope picks one; otherwise a
 *  small selector does, starting at the viewer's own team. */
export default function LeagueTable({ ctx }) {
  const { derived, state, acc, open, scope, role } = ctx;
  const [prov, setProv] = useState(false);
  const [rank, setRank] = useState("goals");
  const [picked, setPicked] = useState(null);
  const followId = acc.teamId || state.prefs.supportTeamId;
  const leagues = COMPETITIONS.filter((c) => c.kind !== "cup");
  const scoped = scope !== "all" && competitionById[scope]?.kind !== "cup" ? scope : null;
  const compId = scoped || (leagues.some((c) => c.id === picked) ? picked : null) || tableOfTeam(derived, followId).competitionId || leagues[0]?.id;
  const comp = competitionById[compId];
  if (!comp) {
    return <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>{role === "manager" ? t("Ainda não há classificação. Cria uma competição e inscreve as equipas em Gerir.") : t("A classificação aparece quando a liga publicar a competição.")}</div>;
  }
  const rows = (prov ? derived.tablesProvisional : derived.tables)[comp.id] || [];
  const stats = prov ? derived.statsProvisional : derived.stats;
  const inComp = new Set(comp.teamIds?.length ? comp.teamIds : TEAMS.map((x) => x.id));
  const compPlayers = PLAYERS.filter((p) => inComp.has(p.teamId));
  const cardRows = compPlayers.map((p) => ({ player: p, y: stats[p.id]?.yellows || 0, r: stats[p.id]?.reds || 0 }))
    .filter((x) => x.y + x.r > 0).sort((a, b) => (b.r - a.r) || (b.y - a.y)).map((x) => ({ ...x, value: x.r * 10 + x.y }));
  const pendingCount = state.matches.filter((m) => (m.competitionId || leagues[0]?.id) === comp.id && ["live", "ended_provisional", "in_review"].includes(m.state)).length;

  return (
    <div>
      <h2 style={{ margin: `0 0 ${S.md}px`, fontSize: T.h, color: C.text1 }}>{t(competitionTitle(comp))}</h2>
      {!scoped && leagues.length > 1 && <SegmentedControl value={comp.id} onChange={setPicked} options={leagues.map((c) => ({ id: c.id, label: c.short || c.name }))} />}
      <label style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.min, marginBottom: S.md, cursor: "pointer", fontSize: T.body, color: C.text1 }}>
        <input type="checkbox" checked={prov} onChange={(e) => setProv(e.target.checked)} style={{ width: 22, height: 22, accentColor: C.orange, flexShrink: 0 }} />
        <span>
          <span style={{ fontWeight: 800 }}>{t("Incluir resultados provisórios")}</span>
          <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{pendingCount} {t("jogos ainda não homologados")}</span>
        </span>
      </label>

      {prov && (
        <div role="note" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", background: C.orangeDim, border: `1px solid ${C.orange}55`, borderRadius: R.control, padding: S.md, marginBottom: S.md, fontSize: T.meta, color: C.text1, lineHeight: 1.5 }}>
          <AlertTriangle size={16} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>{t(LG.provisional)}.</b> {t("Inclui jogos ao vivo, encerrados e em revisão. Não é a classificação oficial — pode mudar com a homologação.")}</span>
        </div>
      )}

      <SectionLabel>{prov ? t("Classificação provisória") : t("Classificação oficial · só jogos homologados")}</SectionLabel>
      <LeagueStandingsTable rows={rows} followId={followId} provisional={prov} onTeam={(id) => open({ kind: "team", id })} />
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, margin: `${S.sm}px 0 ${S.xl}px` }}>
        {tf(t("Vitória {w} · empate {d} · derrota {l}. Desempate:"), { w: comp.points.win, d: comp.points.draw, l: comp.points.loss })} {comp.tiebreakers.map((k) => t(TB_LABEL[k])).join(" → ")}. {t("Empate absoluto: mantém a ordem de inscrição (sorteio ainda não configurado). Jogos adiados ou cancelados não contam.")}
      </div>

      <SectionLabel>{t("Rankings de atletas")}{prov ? ` · ${t(LG.provisional)}` : ""}</SectionLabel>
      <SegmentedControl value={rank} onChange={setRank} options={[{ id: "goals", label: "Golos" }, { id: "assists", label: "Assistências" }, { id: "cards", label: "Cartões" }]} />
      <div style={{ ...cardStyle, paddingTop: 0, paddingBottom: 0 }}>
        {rank === "cards"
          ? <LeagueRankingList rows={cardRows} onPlayer={(id) => open({ kind: "player", id })} render={(r) => `${r.y}🟨 ${r.r}🟥`} />
          : <LeagueRankingList rows={ranking(stats, compPlayers, rank, 10)} onPlayer={(id) => open({ kind: "player", id })} />}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
        <BtnGhost block onClick={() => open({ kind: "players" })} style={{ margin: `${S.sm}px 0` }}>{t("Ver todos os atletas (cartões e OVR)")}</BtnGhost>
        {t("Golos não incluem autogolos nem penáltis de desempate. Assistências só contam quando registadas na ficha de jogo. Golos de autor por identificar contam no resultado, não no ranking.")}
      </div>
      {modOn("fairplay") && <LeagueFairPlay ctx={ctx} competition={comp} />}
    </div>
  );
}
