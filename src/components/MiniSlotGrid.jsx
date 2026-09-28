import { C, R, S, T, displayFont } from "../theme";
import { ini } from "../lib/helpers";
import { t } from "../lib/i18n";

/**
 * MiniSlotGrid — the compact "do we have a game?" answer for Home's
 * next-action card: one square per spot (rows of 5), filled squares show
 * the player's initials in their palette colour (or photo), empty ones
 * are dashed. Counter on top ("7/10").
 *
 * Props:
 *  - taken  [{ id, name, photo?, color, isMe? }] — players with a spot.
 *  - spots  total spots (default 10).
 *  - onClick optional: whole grid becomes a button (e.g. open Jogar).
 */
export default function MiniSlotGrid({ taken = [], spots = 10, onClick }) {
  const n = Math.max(1, Math.min(spots || 10, 20));
  const cells = Array.from({ length: n }, (_, i) => taken[i] ?? null);
  const full = taken.length >= n;

  const body = (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: S.sm }}>
        <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 700 }}>
          {full ? t("Jogo completo") : `${n - taken.length} ${n - taken.length === 1 ? t("vaga livre") : t("vagas livres")}`}
        </span>
        <span style={{ ...displayFont, fontSize: T.h, color: full ? C.green : C.text1, fontVariantNumeric: "tabular-nums" }}>
          {Math.min(taken.length, n)}<span style={{ color: C.text2, fontSize: T.body }}>/{n}</span>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: S.xs + 2 }}>
        {cells.map((p, i) => (
          <div key={p?.id ?? `empty-${i}`} title={p?.name} style={{
            height: 40, borderRadius: R.control - 2, boxSizing: "border-box", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: p ? `${p.color}2E` : "transparent",
            border: p ? `1.5px solid ${p.isMe ? C.accent : `${p.color}AA`}` : `1.5px dashed ${C.border}`,
            color: p?.color, fontSize: T.meta, fontWeight: 900, letterSpacing: "-0.02em",
          }}>
            {p && (p.photo
              ? <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : ini(p.name || "?"))}
          </div>
        ))}
      </div>
    </div>
  );

  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} aria-label={t("Ver jogo")} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }}>
      {body}
    </button>
  );
}
