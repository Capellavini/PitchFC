import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";
import FantasyToken from "./FantasyToken";

/** The bench strip below FantasyPitch, IN SUB ORDER: when a starter
 *  doesn't play, the first bench player (by this order) who did play
 *  takes his place; otherwise the bench scores 0. Tapping one calls
 *  onSelect(player) → FantasyPlayerSheet ("Tornar titular", "Subir no
 *  banco"). */
export default function FantasyBench({ group, reserveIds, pointsById, readOnly, onSelect }) {
  const reserves = (reserveIds || []).map((id) => group.find((x) => x.uuid === id)).filter(Boolean);
  return (
    <div style={{ ...cardStyle, marginBottom: S.xl }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.xs }}>
        {t("Suplentes")}
      </div>
      <div style={{ fontSize: T.min, color: C.text2, marginBottom: reserves.length ? S.md : 0, lineHeight: 1.4 }}>
        {reserves.length ? t("Por ordem: o 1.º entra por quem não jogar.") : t("Sem suplentes — compra mais jogadores para teres banco.")}
      </div>
      {reserves.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.md, paddingTop: S.xs }}>
          {reserves.map((p, i) => (
            <FantasyToken key={p.uuid} p={p} group={group} bench onPitch={false} order={i + 1}
              pts={pointsById ? (pointsById[p.uuid] ?? null) : null}
              onClick={readOnly || !onSelect ? null : () => onSelect(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
