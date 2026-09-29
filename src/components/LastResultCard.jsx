import { Share2, Star } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { nickIn, teamColorOf } from "../lib/homeFeed";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import ScoreBlock from "./ScoreBlock";
import ScoreLine from "./ScoreLine";
import SectionLabel from "./SectionLabel";

/** Two-team night (the usual "Coletes vs Sem coletes") → aggregate
 *  goals + wins per team for the ScoreBlock hero; null otherwise. */
function aggregate(matches) {
  const names = [...new Set(matches.flatMap((m) => [m.homeName, m.awayName]))];
  if (names.length !== 2) return null;
  const agg = Object.fromEntries(names.map((n) => [n, { goals: 0, wins: 0 }]));
  matches.forEach((m) => {
    agg[m.homeName].goals += m.homeGoals || 0;
    agg[m.awayName].goals += m.awayGoals || 0;
    if (m.homeGoals > m.awayGoals) agg[m.homeName].wins += 1;
    else if (m.awayGoals > m.homeGoals) agg[m.awayName].wins += 1;
  });
  return names.map((n) => ({ name: n, ...agg[n] }));
}

/** Home §2 — last result recap (only when a matchday was played in the
 *  last 7 days), styled like the mockup's result card: big italic
 *  ScoreBlock hero (aggregated over the night when it's the same two
 *  teams), the per-game results as quiet rows, then MY contribution as
 *  big numbers (golos · assist. · MVP) and the share CTA.
 *  `md` is a normalized matchday (lib/homeFeed normalizeMatchdays). */
export default function LastResultCard({ md, myKey, onShare }) {
  const matches = md.summary?.matches || [];
  const colorOf = teamColorOf(md);
  const myLine = (md.summary?.lines || []).find((l) => l.key === myKey);
  const mvpNick = md.mvpNick ?? (md.mvpKey != null ? nickIn(md, md.mvpKey) : null);
  const iAmMvp = md.mvpKey != null && md.mvpKey === myKey;
  const agg = matches.length ? aggregate(matches) : null;
  const winsLabel = (w) => `${w} ${w === 1 ? t("vitória") : t("vitórias")}`;

  const statNum = (v, label, color) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div style={{ ...displayFont, fontSize: 32, lineHeight: 1, color: color ?? C.text1 }}>{v}</div>
      <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: S.xs }}>{label}</div>
    </div>
  );
  const g = myLine?.goals || 0, a = myLine?.assists || 0;
  const hasBody = Boolean(myLine || mvpNick || (matches.length && !(agg && matches.length === 1)) || (!matches.length && md.resultText));

  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel right={<span style={{ fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>{md.groupName ? `${md.groupName} · ` : ""}{md.dateLabel}</span>}>{t("Último resultado")}</SectionLabel>

      {agg && (
        <ScoreBlock
          home={{ name: agg[0].name, score: agg[0].goals, color: colorOf(agg[0].name) ?? undefined, sub: matches.length > 1 ? winsLabel(agg[0].wins) : undefined }}
          away={{ name: agg[1].name, score: agg[1].goals, color: colorOf(agg[1].name) ?? undefined, sub: matches.length > 1 ? winsLabel(agg[1].wins) : undefined }}
          center={<span style={{ color: C.text2 }}>{matches.length > 1 ? `${matches.length} ${t("jogos")}` : t("FINAL")}</span>}
          style={{ marginBottom: S.sm }}
        />
      )}

      {hasBody && <div style={cardStyle}>
        {matches.length > 0 && (agg ? matches.length > 1 : true) ? (
          <div style={{ marginBottom: myLine || mvpNick ? S.md : 0 }}>
            {matches.slice(0, 4).map((m, i) => (
              <div key={m.n ?? i} style={{ display: "flex", alignItems: "center", gap: S.sm, borderTop: i ? `1px solid ${C.border}` : "none" }}>
                {agg && <span style={{ fontSize: T.min, fontWeight: 800, color: C.text2, width: 28, flexShrink: 0 }}>J{m.n ?? i + 1}</span>}
                <div style={{ flex: 1, minWidth: 0 }}><ScoreLine m={m} colorOf={colorOf} big={!agg && matches.length === 1} /></div>
              </div>
            ))}
            {matches.length > 4 && <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.xs }}>+{matches.length - 4} {matches.length - 4 === 1 ? t("jogo") : t("jogos")}</div>}
          </div>
        ) : !matches.length && md.resultText ? (
          <div style={{ ...displayFont, fontSize: T.title, color: C.text1, textAlign: "center", marginBottom: S.md }}>{md.resultText}</div>
        ) : null}

        {myLine && (
          <div style={{ paddingTop: matches.length > 1 || !agg ? S.md : 0, borderTop: matches.length > 1 || !agg ? `1px solid ${C.border}` : "none" }}>
            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: S.sm }}>{t("A tua noite")}</div>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {statNum(g, g === 1 ? t("golo") : t("golos"))}
              {statNum(a, t("assist."))}
              {myLine.cleanSheets ? statNum(myLine.cleanSheets, t("sem sofrer")) : null}
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Star size={28} color={iAmMvp ? C.gold : C.text2} fill={iAmMvp ? C.gold : "none"} strokeWidth={iAmMvp ? 1.5 : 2} />
                </div>
                <div style={{ fontSize: T.meta, fontWeight: 700, color: iAmMvp ? C.gold : C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: S.xs }}>MVP</div>
              </div>
            </div>
          </div>
        )}

        {mvpNick && !iAmMvp && (
          <div style={{ marginTop: S.md }}><Chip Icon={Star}>MVP · {mvpNick}</Chip></div>
        )}

        {myLine && onShare && (
          <div style={{ marginTop: S.lg }}>
            <BtnGhost block onClick={onShare}><Share2 size={16} /> {t("Partilhar o meu desempenho")}</BtnGhost>
          </div>
        )}
      </div>}
    </div>
  );
}
