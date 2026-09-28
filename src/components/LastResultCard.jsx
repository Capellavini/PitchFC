import { Share2, Star } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { nickIn, teamColorOf } from "../lib/homeFeed";
import Chip from "./Chip";
import BtnGhost from "./BtnGhost";
import SectionLabel from "./SectionLabel";
import ScoreLine from "./ScoreLine";

/** Home §2 — last result recap (only when a matchday was played in the
 *  last 7 days): score(s), my goals/assists, MVP, share my card.
 *  `md` is a normalized matchday (lib/homeFeed normalizeMatchdays). */
export default function LastResultCard({ md, myKey, onShare }) {
  const matches = md.summary?.matches || [];
  const colorOf = teamColorOf(md);
  const myLine = (md.summary?.lines || []).find((l) => l.key === myKey);
  const mvpNick = md.mvpNick ?? (md.mvpKey != null ? nickIn(md, md.mvpKey) : null);
  const iAmMvp = md.mvpKey != null && md.mvpKey === myKey;

  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel right={<span style={{ fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>{md.dateLabel}</span>}>{t("Último resultado")}</SectionLabel>
      <div style={cardStyle}>
        <div style={{ marginBottom: S.md }}><Chip>{md.groupName || t("O teu grupo")}</Chip></div>

        {matches.length > 0 ? (
          <div style={{ marginBottom: S.md }}>
            {matches.slice(0, 4).map((m, i) => (
              <div key={m.n ?? i} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <ScoreLine m={m} colorOf={colorOf} big={matches.length === 1} />
              </div>
            ))}
            {matches.length > 4 && <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.xs }}>+{matches.length - 4} {t("jogos")}</div>}
          </div>
        ) : md.resultText ? (
          <div style={{ ...displayFont, fontSize: T.title, color: C.text1, textAlign: "center", marginBottom: S.md }}>{md.resultText}</div>
        ) : null}

        {(myLine || mvpNick) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: myLine && onShare ? S.lg : 0 }}>
            {myLine && <Chip>{t("Tu")}: ⚽ {myLine.goals || 0} · 🎯 {myLine.assists || 0}{myLine.cleanSheets ? ` · 🧤 ${myLine.cleanSheets}` : ""}</Chip>}
            {mvpNick && <Chip variant={iAmMvp ? "lime" : "neutral"} Icon={Star}>MVP · {iAmMvp ? t("Tu") : mvpNick}</Chip>}
          </div>
        )}

        {myLine && onShare && (
          <BtnGhost block onClick={onShare}><Share2 size={16} /> {t("Partilhar o meu desempenho")}</BtnGhost>
        )}
      </div>
    </div>
  );
}
