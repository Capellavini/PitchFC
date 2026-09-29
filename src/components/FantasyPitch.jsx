import { C, S, cardStyle } from "../theme";
import { computeRoundPoints } from "../lib/fantasy";
import FantasyToken from "./FantasyToken";

const ROW_ORDER = ["Avançado", "Médio", "Defesa", "Guarda-redes"]; // top → bottom, like FPL

/** The squad laid out on a drawn pitch (green + white lines, no photo —
 *  closer to fantasy.premierleague.com than a real field photo), rows
 *  grouped by each player's actual position. Reserves sit apart in
 *  FantasyBench below and never score. Tapping a player calls
 *  onSelect(player) — FantasyTab opens FantasyPlayerSheet (captain /
 *  bench). readOnly (another participant's squad, or a locked round)
 *  renders no tap actions. lastRoundLines, if given, overlays each
 *  player's points from that round. */
export default function FantasyPitch({ group, playerIds, captainId, reserveIds, weights, lastRoundLines, readOnly, onSelect }) {
  const byId = (uuid) => group.find((p) => p.uuid === uuid);
  const reserveSet = new Set(reserveIds || []);
  const starters = playerIds.filter((id) => !reserveSet.has(id));

  const rows = ROW_ORDER.map((pos) => ({
    pos,
    players: starters.map(byId).filter((p) => p && p.position === pos),
  })).filter((r) => r.players.length > 0);
  // Anyone whose position isn't one of the 4 known ones (shouldn't
  // happen, but keeps the layout from silently dropping a pick).
  const unmatched = starters.map(byId).filter((p) => p && !ROW_ORDER.includes(p.position));
  if (unmatched.length) rows.push({ pos: null, players: unmatched });

  const pointsFor = (uuid) => (lastRoundLines ? computeRoundPoints([uuid], captainId, lastRoundLines, weights, reserveIds) : null);
  const mark = `1px solid ${C.pitchMark}`;

  return (
    <div style={{
      ...cardStyle, position: "relative", padding: 0, overflow: "hidden", marginBottom: S.md,
      background: `linear-gradient(180deg, ${C.pitchTop} 0%, ${C.pitchBottom} 100%)`,
    }}>
      {/* pitch line markings */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${C.pitchStripe} 0px, ${C.pitchStripe} 36px, transparent 36px, transparent 72px)` }} />
      <div style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: C.pitchMark }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 76, height: 76, marginTop: -38, marginLeft: -38, border: mark, borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: mark, borderTop: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: mark, borderBottom: "none" }} />

      <div style={{ position: "relative", padding: `${S.xl}px ${S.sm}px ${S.md}px` }}>
        {rows.map(({ pos, players }) => (
          <div key={pos ?? "outros"} style={{ display: "flex", justifyContent: "space-evenly", marginBottom: S.lg }}>
            {players.map((p) => {
              const line = lastRoundLines?.find((l) => l.key === p.uuid);
              return (
                <FantasyToken key={p.uuid} p={p} group={group} captain={p.uuid === captainId}
                  pts={pointsFor(p.uuid)} highlight={Boolean(line?.goals || line?.assists)}
                  onClick={readOnly || !onSelect ? null : () => onSelect(p)} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
