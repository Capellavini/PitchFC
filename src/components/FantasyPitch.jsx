import { Crown, ArmchairIcon } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { ini, playerColor, computeOverall } from "../lib/helpers";
import { computeRoundPoints } from "../lib/fantasy";
import { t } from "../lib/i18n";

const ROW_ORDER = ["Avançado", "Médio", "Defesa", "Guarda-redes"]; // top → bottom, like FPL

/** The squad laid out on a drawn pitch (green + white lines, no photo —
 *  closer to fantasy.premierleague.com than a real field photo), rows
 *  grouped by each player's actual position. The reserve sits apart in
 *  a "Banco" strip below and never scores. Tap the bench icon on any
 *  player to make them the reserve (swaps automatically with whoever
 *  was benched); tap the crown to captain (only non-bench players can
 *  be captain). readOnly renders another participant's squad (from the
 *  leaderboard) with no tap actions. lastRoundLines, if given, overlays
 *  each player's points from that round. */
export default function FantasyPitch({ group, playerIds, captainId, reserveId, weights, lastRoundLines, readOnly, onSetCaptain, onSetReserve }) {
  const byId = (uuid) => group.find((p) => p.uuid === uuid);
  const starters = playerIds.filter((id) => id !== reserveId);
  const reserve = reserveId && playerIds.includes(reserveId) ? byId(reserveId) : null;

  const rows = ROW_ORDER.map((pos) => ({
    pos,
    players: starters.map(byId).filter((p) => p && p.position === pos),
  })).filter((r) => r.players.length > 0);
  // Anyone whose position isn't one of the 4 known ones (shouldn't
  // happen, but keeps the layout from silently dropping a pick).
  const unmatched = starters.map(byId).filter((p) => p && !ROW_ORDER.includes(p.position));
  if (unmatched.length) rows.push({ pos: null, players: unmatched });

  const pointsFor = (uuid) => (lastRoundLines ? computeRoundPoints([uuid], captainId, lastRoundLines, weights, reserveId) : null);

  const renderIcon = (p, { bench } = {}) => {
    const isCaptain = p.uuid === captainId;
    const pts = pointsFor(p.uuid);
    const line = lastRoundLines?.find((l) => l.key === p.uuid);
    return (
      <div key={p.uuid} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 58, opacity: bench ? 0.75 : 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 21, flexShrink: 0,
          background: p.photo ? C.surface : `${playerColor(group, p)}22`,
          border: `2px solid ${isCaptain ? C.gold : playerColor(group, p)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: playerColor(group, p),
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)", position: "relative", overflow: "visible",
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
        <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)", maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
        {pts !== null && (
          <span style={{ fontSize: 10, fontWeight: 800, color: bench ? C.text3 : (line?.goals || line?.assists) ? C.accent : C.text2, background: "rgba(10,15,24,0.75)", borderRadius: 8, padding: "1px 6px" }}>
            {bench ? t("banco") : `${pts > 0 ? "+" : ""}${Math.round(pts)}`}
          </span>
        )}
        {!readOnly && (
          <div style={{ display: "flex", gap: 4 }}>
            {!bench && (
              <button onClick={() => onSetCaptain(p.uuid)} title={t("Capitão")}
                style={{ width: 20, height: 20, borderRadius: 10, background: isCaptain ? C.goldDim : C.card, border: `1px solid ${isCaptain ? C.gold : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                <Crown size={10} color={isCaptain ? C.gold : C.text3} />
              </button>
            )}
            <button onClick={() => onSetReserve(p.uuid)} title={bench ? t("Tornar titular") : t("Enviar para o banco")}
              style={{ width: 20, height: 20, borderRadius: 10, background: bench ? C.orangeDim : C.card, border: `1px solid ${bench ? C.orange : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <ArmchairIcon size={10} color={bench ? C.orange : C.text3} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      ...cardStyle, position: "relative", padding: 0, overflow: "hidden", marginBottom: 10,
      background: "linear-gradient(180deg, #1D7A46 0%, #16603A 100%)", border: `1px solid ${C.border}`,
    }}>
      {/* pitch line markings */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 36px, transparent 36px, transparent 72px)" }} />
      <div style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: "rgba(255,255,255,0.35)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 76, height: 76, marginTop: -38, marginLeft: -38, border: "1px solid rgba(255,255,255,0.35)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: "1px solid rgba(255,255,255,0.3)", borderTop: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: "50%", width: 120, height: 36, marginLeft: -60, border: "1px solid rgba(255,255,255,0.3)", borderBottom: "none" }} />

      <div style={{ position: "relative", padding: "18px 10px 14px" }}>
        {rows.map(({ pos, players }) => (
          <div key={pos ?? "outros"} style={{ display: "flex", justifyContent: "space-evenly", marginBottom: 18 }}>
            {players.map((p) => renderIcon(p))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The bench strip, rendered as a separate card below FantasyPitch —
 *  kept out of the green pitch so it visually reads as "not playing",
 *  matching FPL's bench-below-the-pitch layout. */
export function FantasyBench({ group, reserveId, captainId, weights, lastRoundLines, readOnly, onSetReserve }) {
  const p = group.find((x) => x.uuid === reserveId);
  return (
    <div style={{ ...cardStyle, marginBottom: 14, background: C.surface }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: p ? 10 : 0 }}>{t("BANCO")}</div>
      {p ? (
        <div style={{ display: "flex" }}>
          <BenchIcon p={p} group={group} captainId={captainId} weights={weights} lastRoundLines={lastRoundLines} readOnly={readOnly} onSetReserve={onSetReserve} />
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.text3 }}>{t("Sem suplente definido.")}</div>
      )}
    </div>
  );
}

function BenchIcon({ p, group, captainId, weights, lastRoundLines, readOnly, onSetReserve }) {
  const pts = lastRoundLines ? computeRoundPoints([p.uuid], captainId, lastRoundLines, weights, p.uuid) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 58, opacity: 0.75 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 21, flexShrink: 0,
        background: p.photo ? C.surface : `${playerColor(group, p)}22`,
        border: `2px solid ${playerColor(group, p)}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, color: playerColor(group, p), position: "relative",
      }}>
        {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 19 }} /> : ini(p.name)}
        <span style={{ position: "absolute", bottom: -5, left: -5, fontSize: 8, fontWeight: 800, color: C.bg, background: C.accent, borderRadius: 6, padding: "0 4px", border: `1px solid ${C.card}` }}>
          {computeOverall(p.position, p.attrs)}
        </span>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: C.text1, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
      {pts !== null && <span style={{ fontSize: 10, fontWeight: 700, color: C.text3 }}>{t("não pontua")}</span>}
      {!readOnly && (
        <button onClick={() => onSetReserve(p.uuid)} title={t("Tornar titular")}
          style={{ width: 20, height: 20, borderRadius: 10, background: C.orangeDim, border: `1px solid ${C.orange}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <ArmchairIcon size={10} color={C.orange} />
        </button>
      )}
    </div>
  );
}
