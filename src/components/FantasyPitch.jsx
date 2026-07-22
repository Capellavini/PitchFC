import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { C, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { ini, playerColor, computeOverall } from "../lib/helpers";
import { computeRoundPoints } from "../lib/fantasy";
import { t } from "../lib/i18n";

// field.jpg is a landscape pitch photo (touchlines top/bottom, goals at
// each end) — the layout runs left→right to match it: GR near the left
// edge, forwards toward the right. Fixed tables for the common squad
// sizes; anything outside 4–8 falls back to a plain wrapping grid so an
// unusual squad_size still renders instead of breaking.
const LAYOUTS = {
  4: [[12, 50], [40, 25], [40, 75], [85, 50]],
  5: [[10, 50], [32, 25], [32, 75], [60, 50], [88, 50]],
  6: [[10, 50], [30, 25], [30, 75], [62, 25], [62, 75], [88, 50]],
  7: [[8, 50], [28, 20], [28, 50], [28, 80], [58, 30], [58, 70], [88, 50]],
  8: [[8, 50], [26, 18], [26, 50], [26, 82], [56, 25], [56, 50], [56, 75], [86, 50]],
};
const slotsFor = (n) => LAYOUTS[n] || Array.from({ length: n }, (_, i) => [
  20 + Math.floor(i / 3) * 30, 20 + (i % 3) * 26,
]);

/** The confirmed squad laid out on the pitch — drag an icon onto another
 *  to swap their spots (Pointer Events, so it works with touch and mouse
 *  alike; no dnd library). Purely cosmetic ordering, saved separately
 *  from the squad itself so it never touches the budget/lock rules.
 *  readOnly renders another participant's squad (from the leaderboard)
 *  without the drag handlers. lastRoundLines, if given, overlays each
 *  player's points from that round. */
export default function FantasyPitch({ group, playerIds, formationOrder, captainId, weights, lastRoundLines, readOnly, onSaveFormation }) {
  const initialOrder = formationOrder?.length === playerIds.length ? formationOrder : playerIds;
  const [order, setOrder] = useState(initialOrder);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const startRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    setOrder(formationOrder?.length === playerIds.length ? formationOrder : playerIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIds.join(","), formationOrder?.join(",")]);

  const byId = (uuid) => group.find((p) => p.uuid === uuid);
  const slots = slotsFor(order.length);

  const pointerDown = (e, idx) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragIdx(idx);
    setDragPos({ x: 0, y: 0 });
  };
  const pointerMove = (e) => {
    if (dragIdx === null) return;
    setDragPos({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const pointerUp = (e) => {
    if (dragIdx === null) return;
    // The dragged icon is visually on top of (and hit-tests over) whatever
    // it's hovering — hide it from elementFromPoint for a moment so it
    // finds the slot underneath instead of itself.
    const draggedEl = e.currentTarget;
    draggedEl.style.pointerEvents = "none";
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot-idx]");
    draggedEl.style.pointerEvents = "";
    const targetIdx = target ? Number(target.getAttribute("data-slot-idx")) : null;
    if (targetIdx !== null && targetIdx !== dragIdx) {
      const next = [...order];
      [next[dragIdx], next[targetIdx]] = [next[targetIdx], next[dragIdx]];
      setOrder(next);
      onSaveFormation?.(next);
    }
    setDragIdx(null);
    setDragPos({ x: 0, y: 0 });
  };

  return (
    <div ref={containerRef} style={{
      ...cardStyle, ...fieldBackdrop(0.15, 0.55), position: "relative",
      aspectRatio: "4/3", padding: 0, overflow: "hidden", marginBottom: 14,
      border: `1px solid ${C.blueBorder}`,
    }}>
      {order.map((uuid, idx) => {
        const p = byId(uuid);
        if (!p) return null;
        const [x, y] = slots[idx] || [50, 50];
        const isCaptain = uuid === captainId;
        const dragging = dragIdx === idx;
        const line = lastRoundLines?.find((l) => l.key === uuid);
        const pts = lastRoundLines ? computeRoundPoints([uuid], captainId, lastRoundLines, weights) : null;
        return (
          <div key={uuid} data-slot-idx={idx}
            onPointerDown={(e) => pointerDown(e, idx)} onPointerMove={pointerMove} onPointerUp={pointerUp}
            style={{
              position: "absolute", left: `${x}%`, top: `${y}%`,
              transform: `translate(-50%, -50%) translate(${dragging ? dragPos.x : 0}px, ${dragging ? dragPos.y : 0}px)`,
              zIndex: dragging ? 5 : 1, touchAction: "none", cursor: readOnly ? "default" : "grab",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 56,
            }}>
            <div style={{
              width: 42, height: 42, borderRadius: 21, flexShrink: 0,
              background: p.photo ? C.surface : `${playerColor(group, p)}22`,
              border: `2px solid ${isCaptain ? C.gold : playerColor(group, p)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: playerColor(group, p),
              boxShadow: dragging ? "0 8px 20px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.35)",
              position: "relative", overflow: "visible",
            }}>
              {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 19 }} /> : ini(p.name)}
              {isCaptain && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: 8, background: C.goldDim, border: `1px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Crown size={9} color={C.gold} />
                </span>
              )}
              <span style={{ position: "absolute", bottom: -5, left: -5, fontSize: 8, fontWeight: 800, color: C.bg, background: C.accent, borderRadius: 6, padding: "0 4px", border: `1px solid ${C.card}` }}>
                {computeOverall(p.position, p.attrs)}
              </span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)", maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
            {pts !== null && (
              <span style={{ fontSize: 10, fontWeight: 800, color: (line?.goals || line?.assists) ? C.accent : C.text2, background: "rgba(10,15,24,0.75)", borderRadius: 8, padding: "1px 6px" }}>
                {pts > 0 ? "+" : ""}{Math.round(pts)}
              </span>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
          {t("Arrasta um jogador para trocar de posição")}
        </div>
      )}
    </div>
  );
}
