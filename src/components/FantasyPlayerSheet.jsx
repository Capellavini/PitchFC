import { Crown, ArmchairIcon, X } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * FantasyPlayerSheet — bottom sheet opened by tapping a player on the
 * Pitch Manager pitch or bench. Replaces the two 28px crown/bench icon
 * buttons that used to sit under every player: one primary action
 * (captain, or "Tornar titular" for a benched player) + one ghost action.
 *
 * Props:
 *  - p, group, pts   the player, roster, last round points (or null).
 *  - captain, bench  current state of this player in my squad.
 *  - onCaptain()     make captain (starters only).
 *  - onToggleBench() bench ↔ starter.
 *  - onClose().
 */
export default function FantasyPlayerSheet({ p, group, pts = null, captain, bench, onCaptain, onToggleBench, onClose }) {
  const run = (fn) => { fn(); onClose(); };
  return (
    <div role="dialog" aria-modal="true" aria-label={p.nick} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: `${C.bg}CC`, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: C.card, borderTop: `1px solid ${C.border}`, borderRadius: `${R.card}px ${R.card}px 0 0`, padding: `${S.md}px ${S.lg}px calc(${S.xl}px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: `0 auto ${S.md}px` }} />
        <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
          <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} injured={p.injured} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>
              {t(p.position)} · OVR {computeOverall(p.position, p.attrs)}
              {captain ? ` · ${t("Capitão")}` : bench ? ` · ${t("Suplente")}` : ""}
            </div>
          </div>
          {pts !== null && !bench && (
            <div style={{ textAlign: "right" }}>
              <div style={{ ...displayFont, fontSize: T.h, color: C.text1 }}>{pts > 0 ? "+" : ""}{Math.round(pts)}</div>
              <div style={{ fontSize: T.min, fontWeight: 800, color: C.text2 }}>PTS</div>
            </div>
          )}
          <button type="button" onClick={onClose} aria-label={t("Fechar")}
            style={{ width: TOUCH.min, height: TOUCH.min, flexShrink: 0, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          {bench ? (
            <BtnPrimary block onClick={() => run(onToggleBench)}>
              <ArmchairIcon size={16} /> {t("Tornar titular")}
            </BtnPrimary>
          ) : (
            <>
              <BtnPrimary block disabled={captain} onClick={() => run(onCaptain)}>
                <Crown size={16} /> {captain ? t("Já é o capitão") : t("Tornar capitão")}
              </BtnPrimary>
              <BtnGhost block onClick={() => run(onToggleBench)}>
                <ArmchairIcon size={16} /> {t("Enviar para o banco")}
              </BtnGhost>
            </>
          )}
        </div>
        {!bench && (
          <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.md }}>{t("O capitão pontua a dobrar.")}</div>
        )}
      </div>
    </div>
  );
}
