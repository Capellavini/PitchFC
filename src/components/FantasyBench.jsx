import { C, S, T, cardStyle } from "../theme";
import { computeRoundPoints } from "../lib/fantasy";
import { t } from "../lib/i18n";
import FantasyToken from "./FantasyToken";

/** The bench strip, a separate card below FantasyPitch — kept off the
 *  green pitch so it reads as "not playing" (FPL's bench-below-the-pitch
 *  layout). Any number of reserves (extra buys beyond the league's
 *  starting squad size sit here, never scoring). Tapping one calls
 *  onSelect(player) → FantasyPlayerSheet ("Tornar titular"). */
export default function FantasyBench({ group, reserveIds, captainId, weights, lastRoundLines, readOnly, onSelect }) {
  const reserves = (reserveIds || []).map((id) => group.find((x) => x.uuid === id)).filter(Boolean);
  return (
    <div style={{ ...cardStyle, marginBottom: S.xl }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: reserves.length ? S.sm : S.xs }}>
        {t("Suplentes")}
      </div>
      {reserves.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.md }}>
          {reserves.map((p) => (
            <FantasyToken key={p.uuid} p={p} group={group} bench onPitch={false}
              pts={lastRoundLines ? computeRoundPoints([p.uuid], captainId, lastRoundLines, weights, [p.uuid]) : null}
              onClick={readOnly || !onSelect ? null : () => onSelect(p)} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.4 }}>
          {t("Sem suplentes definidos.")}{!readOnly && onSelect ? ` ${t("Toca num jogador no campo para o enviar para o banco.")}` : ""}
        </div>
      )}
    </div>
  );
}
