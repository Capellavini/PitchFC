import { useLayoutEffect, useRef, useState } from "react";
import { C, S, cardStyle } from "../theme";
import FantasyToken from "./FantasyToken";

const ROW_ORDER = ["Avançado", "Médio", "Defesa", "Guarda-redes"]; // top → bottom, like FPL

/** The starting XI laid out on a drawn pitch, rows grouped by each
 *  player's position. The bench sits apart in FantasyBench below.
 *  Tapping a player calls onSelect(player) — FantasyTab opens
 *  FantasyPlayerSheet (captain / vice / bench). readOnly renders no tap
 *  actions. pointsById, if given, overlays each player's raw points from
 *  the last scored round (fantasy_round_players).
 *  connection { creatorId, finisherId } draws the Conexão arrow creator →
 *  finisher, measured from the real token positions (never fixed
 *  coordinates) and re-measured on resize. It sits under the tokens and
 *  ignores pointer events; the tokens carry the labelled role, and the
 *  card below the pitch spells the direction out in words. */
export default function FantasyPitch({ group, playerIds, captainId, viceId, reserveIds, pointsById, readOnly, onSelect, connection = null }) {
  const rowsRef = useRef(null);
  const [arrow, setArrow] = useState(null);
  const cId = connection?.creatorId ?? null, fId = connection?.finisherId ?? null;
  useLayoutEffect(() => {
    const root = rowsRef.current;
    if (!root || cId == null || fId == null) { setArrow(null); return undefined; }
    const measure = () => {
      const box = root.getBoundingClientRect();
      const avatarCenter = (id) => {
        const el = root.querySelector(`[data-pid="${CSS.escape(String(id))}"]`);
        const av = el?.firstElementChild?.getBoundingClientRect();
        return av ? { x: av.left + av.width / 2 - box.left, y: av.top + av.height / 2 - box.top, r: av.width / 2 } : null;
      };
      const a = avatarCenter(cId), b = avatarCenter(fId);
      setArrow(a && b ? { a, b, w: box.width, h: box.height } : null);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(root);
    return () => ro?.disconnect();
  }, [cId, fId, playerIds, reserveIds]);
  const byId = (uuid) => group.find((p) => p.uuid === uuid);
  const reserveSet = new Set(reserveIds || []);
  const starters = (playerIds || []).filter((id) => !reserveSet.has(id));

  const rows = ROW_ORDER.map((pos) => ({
    pos,
    players: starters.map(byId).filter((p) => p && p.position === pos),
  })).filter((r) => r.players.length > 0);
  const unmatched = starters.map(byId).filter((p) => p && !ROW_ORDER.includes(p.position));
  if (unmatched.length) rows.push({ pos: null, players: unmatched });

  const mark = `1px solid ${C.pitchMark}`;
  return (
    <div style={{
      ...cardStyle, position: "relative", padding: 0, overflow: "hidden", marginBottom: S.md,
      background: `linear-gradient(180deg, ${C.pitchTop} 0%, ${C.pitchBottom} 100%)`,
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${C.pitchStripe} 0px, ${C.pitchStripe} 36px, transparent 36px, transparent 72px)` }} />
      <div style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: C.pitchMark }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 76, height: 76, marginTop: -38, marginLeft: -38, border: mark, borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: mark, borderTop: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: mark, borderBottom: "none" }} />

      <div ref={rowsRef} style={{ position: "relative", zIndex: 1, padding: `${S.xl}px ${S.sm}px ${S.md}px` }}>
        {arrow && <ConnectionArrow {...arrow} />}
        {rows.map(({ pos, players }) => (
          <div key={pos ?? "outros"} style={{ display: "flex", justifyContent: "space-evenly", flexWrap: "wrap", rowGap: S.md, marginBottom: S.lg }}>
            {players.map((p) => {
              const pts = pointsById ? (pointsById[p.uuid] ?? null) : null;
              return (
                <FantasyToken key={p.uuid} p={p} group={group} captain={p.uuid === captainId} vice={p.uuid === viceId}
                  connRole={p.uuid === cId ? "creator" : p.uuid === fId ? "finisher" : null}
                  pts={pts} highlight={pts != null && pts >= 10}
                  onClick={readOnly || !onSelect ? null : () => onSelect(p)} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Arrow from avatar edge to avatar edge, behind the tokens (they are
 *  positioned above it), so it never covers a button or a name. */
function ConnectionArrow({ a, b, w, h }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const pad = 4;
  const x1 = a.x + (dx / len) * (a.r + pad), y1 = a.y + (dy / len) * (a.r + pad);
  const x2 = b.x - (dx / len) * (b.r + pad), y2 = b.y - (dy / len) * (b.r + pad);
  return (
    <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: -1, overflow: "visible" }}>
      <defs>
        <marker id="fantasy-conn-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={C.accent} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" markerEnd="url(#fantasy-conn-head)" />
    </svg>
  );
}
