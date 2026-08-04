import { useEffect, useRef, useState } from "react";
import { C, cardStyle } from "../theme";
import { ini, playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";

// Top → bottom, same convention as FantasyPitch.jsx's ROW_ORDER.
const ROWS_META = [
  { key: "fwd", label: "Avançado" },
  { key: "mid", label: "Médio" },
  { key: "def", label: "Defesa" },
];

/** A handful of sensible [def, mid, fwd] line splits per outfield count
 *  (team size minus the goalkeeper) — not a rigid FIFA-accurate table,
 *  just enough variety to feel like real formation choices for casual
 *  7-to-11-a-side teams. Falls back to a computed split outside that
 *  range (very small/large teams, shouldn't normally happen here since
 *  the board only shows for teams of 7+). */
const FORMATION_TABLE = {
  6:  [[2, 3, 1], [3, 2, 1], [2, 2, 2]],
  7:  [[3, 3, 1], [3, 2, 2], [2, 3, 2]],
  8:  [[3, 3, 2], [4, 3, 1], [3, 4, 1]],
  9:  [[4, 3, 2], [3, 4, 2], [4, 4, 1]],
  10: [[4, 4, 2], [4, 3, 3], [3, 5, 2]],
};
function formationOptions(outfield) {
  if (FORMATION_TABLE[outfield]) return FORMATION_TABLE[outfield];
  const def = Math.max(1, Math.round(outfield * 0.4));
  const fwd = Math.max(1, Math.round(outfield * 0.25));
  const mid = Math.max(1, outfield - def - fwd);
  return [[def, mid, fwd]];
}
const labelOf = ([def, mid, fwd]) => `${def}-${mid}-${fwd}`;
const rowsFor = (label) => {
  const [def, mid, fwd] = label.split("-").map(Number);
  const counts = { fwd, mid, def, gk: 1 };
  return [...ROWS_META, { key: "gk", label: "Guarda-redes" }].map((r) => ({ ...r, count: counts[r.key] }));
};

/** One team's personal, device-local tactical lineup — drag players from
 *  the bench onto pitch slots, pick a formation. Purely organizational:
 *  no effect on goals/assists/GK pickers, stats or Fantasy, and not
 *  synced anywhere — each viewer gets their own (localStorage). */
export default function TacticsBoard({ team, group }) {
  const byId = (id) => group.find((p) => p.id === id);
  const players = (team.players || []).map(byId).filter(Boolean);
  const outfield = Math.max(1, players.length - 1);
  const options = formationOptions(outfield).map(labelOf);
  const storageKey = `pitch:tactics:${team.id}`;
  const readSaved = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; }
  };

  // Read persisted state synchronously via lazy useState initializers
  // (run once, on mount) rather than in a separate effect — loading in
  // an effect and persisting in another race each other on first mount
  // (the persist effect can fire with the pre-load default values before
  // the load effect's state updates land, clobbering what was saved).
  const [formation, setFormation] = useState(() => {
    const saved = readSaved();
    return saved?.formation && options.includes(saved.formation) ? saved.formation : options[0];
  });
  const [slots, setSlots] = useState(() => readSaved()?.slots || {});

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ formation, slots })); } catch { /* ignore */ }
  }, [storageKey, formation, slots]);

  const changeFormation = (label) => {
    const newRows = rowsFor(label);
    setSlots((prev) => {
      const next = {};
      newRows.forEach((r) => {
        for (let i = 0; i < r.count; i++) {
          const key = `${r.key}-${i}`;
          if (prev[key] != null) next[key] = prev[key];
        }
      });
      return next;
    });
    setFormation(label);
  };

  const placedIds = new Set(Object.values(slots));
  const bench = players.filter((p) => !placedIds.has(p.id));

  // ── Drag (Pointer Events — mouse + touch uniformly, no library) ────
  const slotRefs = useRef({});
  const benchRef = useRef(null);
  const [drag, setDrag] = useState(null); // { playerId, from, x, y }
  const [hoverKey, setHoverKey] = useState(null);

  const hitTest = (x, y) => {
    for (const [key, el] of Object.entries(slotRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { type: "slot", key };
    }
    if (benchRef.current) {
      const r = benchRef.current.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { type: "bench" };
    }
    return null;
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const hit = hitTest(e.clientX, e.clientY);
      setHoverKey(hit?.type === "slot" ? hit.key : hit?.type === "bench" ? "bench" : null);
    };
    const onUp = (e) => {
      const target = hitTest(e.clientX, e.clientY);
      if (target) {
        setSlots((prev) => {
          const next = { ...prev };
          if (drag.from !== "bench") delete next[drag.from];
          if (target.type === "slot") {
            const occupant = prev[target.key];
            if (drag.from !== "bench" && occupant != null) next[drag.from] = occupant;
            next[target.key] = drag.playerId;
          }
          return next;
        });
      }
      setDrag(null);
      setHoverKey(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const startDrag = (e, playerId, from) => {
    e.preventDefault();
    setDrag({ playerId, from, x: e.clientX, y: e.clientY });
  };

  const chip = (p, { ghost, dim } = {}) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 58 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 22, flexShrink: 0,
        background: `${playerColor(group, p)}22`, border: `2px solid ${playerColor(group, p)}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, color: playerColor(group, p),
        boxShadow: ghost ? "0 4px 14px rgba(0,0,0,0.5)" : "0 2px 6px rgba(0,0,0,0.35)",
        opacity: dim ? 0.35 : 1,
      }}>
        {ini(p.name)}
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)", maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.nick}
      </span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {options.map((label) => {
          const active = label === formation;
          return (
            <button key={label} onClick={() => changeFormation(label)}
              style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "linear-gradient(180deg, #1D7A46 0%, #16603A 100%)", border: `1px solid ${C.border}`, marginBottom: 10 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 30px, transparent 30px, transparent 60px)" }} />
        <div style={{ position: "absolute", top: "50%", left: 10, right: 10, height: 1, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ position: "relative", padding: "18px 8px 14px" }}>
          {rowsFor(formation).map((row) => (
            <div key={row.key} style={{ display: "flex", justifyContent: "space-evenly", marginBottom: 16 }}>
              {Array.from({ length: row.count }).map((_, i) => {
                const key = `${row.key}-${i}`;
                const playerId = slots[key];
                const p = playerId != null ? byId(playerId) : null;
                const hovering = hoverKey === key;
                return (
                  <div key={key}
                    ref={(el) => { slotRefs.current[key] = el; }}
                    style={{ width: 58, minHeight: 58, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", border: hovering ? `2px dashed ${C.accent}` : "2px dashed rgba(255,255,255,0.25)", background: hovering ? "rgba(200,255,0,0.12)" : "transparent" }}>
                    {p ? (
                      <div onPointerDown={(e) => startDrag(e, p.id, key)} style={{ touchAction: "none", cursor: "grab", opacity: drag?.playerId === p.id ? 0.3 : 1 }}>
                        {chip(p)}
                      </div>
                    ) : (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{t(row.label)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div ref={benchRef} style={{
        ...cardStyle, background: hoverKey === "bench" ? C.accentDim : C.surface,
        border: hoverKey === "bench" ? `1px dashed ${C.accent}` : `1px solid ${C.border}`,
        padding: 12, minHeight: 70,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: bench.length ? 10 : 0 }}>{t("BANCO")}</div>
        {bench.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {bench.map((p) => (
              <div key={p.id} onPointerDown={(e) => startDrag(e, p.id, "bench")} style={{ touchAction: "none", cursor: "grab", opacity: drag?.playerId === p.id ? 0.3 : 1 }}>
                {chip(p)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: C.text3 }}>{t("Todos colocados no campo.")}</div>
        )}
      </div>

      {drag && (() => {
        const p = byId(drag.playerId);
        return p ? (
          <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 999 }}>
            {chip(p, { ghost: true })}
          </div>
        ) : null;
      })()}
    </div>
  );
}
