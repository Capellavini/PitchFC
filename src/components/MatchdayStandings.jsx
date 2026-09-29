import { Trophy, ArrowRightCircle } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { goalsOf, standings, playoffState } from "../lib/matchdayLive";
import BtnGhost from "./BtnGhost";
import SectionLabel from "./SectionLabel";

const COLS = "minmax(0,1fr) 28px 56px 36px 32px";

/** Live "Classificação" view (campeonato / personalizado): champion banner,
 *  group-stage table, play-off rounds and the manager's "advance" action. */
export default function MatchdayStandings({ matchday, teams, canManage, onAdvancePlayoff }) {
  const list = Array.isArray(teams) ? teams : [];
  const teamName = (id) => list.find((x) => x.id === id)?.name ?? "—";
  const { playoffMatches, rounds, currentRound, champion, canAdvance, roundSize, winnerOf } = playoffState(matchday);
  const isPersonalizado = matchday.mode === "personalizado";
  const hasPlayoff = isPersonalizado && matchday.config?.faseFinal;
  const rows = standings(list, matchday.matches || []);

  return (
    <>
      {champion && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg, borderColor: `${C.gold}66` }}>
          <Trophy size={24} color={C.gold} />
          <div>
            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.08em" }}>{t("CAMPEÃO")}</div>
            <div style={{ ...displayFont, fontSize: T.h, color: C.gold }}>{teamName(champion)}</div>
          </div>
        </div>
      )}

      <SectionLabel>{t("Classificação")}</SectionLabel>
      <div style={{ ...cardStyle, padding: `${S.sm}px ${S.lg}px`, marginBottom: S.lg }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: S.xs, fontSize: T.min, fontWeight: 800, color: C.text2, padding: `${S.sm}px 0`, textAlign: "center" }}>
          <span style={{ textAlign: "left" }}>{t("EQUIPA")}</span><span>{t("J")}</span><span>{t("V-E-D")}</span><span>{t("SG")}</span><span>{t("P")}</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: S.xs, alignItems: "center", minHeight: 44, fontSize: T.body, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: S.sm, textAlign: "left", minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            </span>
            <span style={{ color: C.text2 }}>{r.j}</span>
            <span style={{ color: C.text2, fontSize: T.meta }}>{r.w}-{r.d}-{r.l}</span>
            <span style={{ color: r.gd > 0 ? C.green : r.gd < 0 ? C.red : C.text2 }}>{r.gd > 0 ? "+" : ""}{r.gd}</span>
            <span style={{ ...displayFont, fontSize: T.cardTitle }}>{r.pts}</span>
          </div>
        ))}
      </div>

      {hasPlayoff && rounds.length > 0 && (
        <>
          <SectionLabel>{t("Fase final")}</SectionLabel>
          <div style={{ ...cardStyle, padding: `0 ${S.lg}px`, marginBottom: S.lg }}>
            {rounds.map((round) => playoffMatches.filter((pm) => pm.round === round).map((pm, i) => {
              const w = winnerOf(pm);
              const side = (id) => (
                <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: w === id ? 800 : 500, color: w === id ? C.text1 : C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w === id && "✓ "}{teamName(id)}
                </span>
              );
              return (
                <div key={pm.id} style={{ minHeight: 56, display: "flex", flexDirection: "column", justifyContent: "center", borderTop: round === rounds[0] && i === 0 ? "none" : `1px solid ${C.border}`, padding: `${S.sm}px 0` }}>
                  <div style={{ fontSize: T.min, fontWeight: 800, color: C.text2, letterSpacing: "0.08em", marginBottom: 2 }}>{roundSize(round) === 1 ? t("FINAL") : t("MEIA-FINAL")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
                    {side(pm.homeId)}
                    <span style={{ ...displayFont, fontSize: T.cardTitle, color: C.text2, flexShrink: 0 }}>
                      {pm.isBye ? t("bye") : `${goalsOf(pm, pm.homeId)} – ${goalsOf(pm, pm.awayId)}`}
                    </span>
                    {pm.isBye ? <span style={{ flex: 1 }} /> : <span style={{ flex: 1, minWidth: 0, textAlign: "right", display: "flex", justifyContent: "flex-end" }}>{side(pm.awayId)}</span>}
                  </div>
                </div>
              );
            }))}
          </div>
        </>
      )}

      {canManage && hasPlayoff && !champion && (
        <div style={{ marginBottom: S.lg }}>
          <BtnGhost block tone="accent" onClick={onAdvancePlayoff} disabled={!canAdvance}>
            <ArrowRightCircle size={16} /> {currentRound === 0 ? t("Avançar para a fase final") : t("Avançar de ronda")}
          </BtnGhost>
          {!canAdvance && (
            <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.sm }}>
              {t("Só é possível avançar para os play-offs quando todos os jogos desta fase estiverem concluídos.")}
            </div>
          )}
        </div>
      )}
    </>
  );
}
