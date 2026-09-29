import { Check, Cross, Plus } from "lucide-react";
import { C, S, T } from "../theme";
import { ini } from "../lib/helpers";
import { t } from "../lib/i18n";

/**
 * SlotTile — one square of the "temos jogo?" slot grid (Jogar + Home).
 * Filled: rounded-square avatar tile (photo cover or initials in the
 * player's palette colour, lime ring for me), nick underneath, green
 * check badge when paid, red cross when injured. Empty: dashed "+".
 *
 * Props:
 *  - player  { id, name, nick, photo?, color, isMe?, paid?, injured? } | null (empty)
 *  - compact smaller radius/badges/type (Home's card).
 */
export default function SlotTile({ player, compact = false }) {
  const radius = compact ? 12 : 14;
  const badge = compact ? 14 : 16;
  const tile = { width: "100%", aspectRatio: "1", borderRadius: radius, boxSizing: "border-box" };
  const label = { fontSize: T.min, marginTop: S.xs, lineHeight: 1.2, letterSpacing: "-0.02em", marginLeft: -2, marginRight: -2 };

  if (!player) {
    return (
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={{ ...tile, border: `2px dashed ${C.border}`, background: `${C.bg}66`, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3 }}>
          <Plus size={compact ? 14 : 16} />
        </div>
        <div style={{ ...label, color: C.text3 }}>&nbsp;</div>
      </div>
    );
  }

  const { color, isMe, photo } = player;
  return (
    <div title={player.name} style={{ textAlign: "center", minWidth: 0 }}>
      <div style={{
        ...tile,
        background: photo ? C.surface : isMe ? C.accentDim : `${color}22`,
        border: `2px solid ${isMe ? C.accent : color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: compact ? T.meta : T.body, fontWeight: 800, color: isMe ? C.accent : color, position: "relative",
      }}>
        {photo
          ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius - 2, display: "block" }} />
          : ini(player.name || player.nick || "?")}
        {player.paid && (
          <div title={t("Pago")} style={{ position: "absolute", bottom: -4, right: -4, width: badge, height: badge, borderRadius: badge / 2, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
            <Check size={8} strokeWidth={3} color={C.bg} />
          </div>
        )}
        {player.injured && (
          <div title={t("Lesionado")} style={{ position: "absolute", top: -6, left: -6, width: badge, height: badge, borderRadius: badge / 2, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
            <Cross size={9} strokeWidth={3} color={C.text1} />
          </div>
        )}
      </div>
      <div style={{ ...label, color: isMe ? C.accent : C.text2, fontWeight: isMe ? 800 : 600 }}>{player.nick || player.name}</div>
    </div>
  );
}
