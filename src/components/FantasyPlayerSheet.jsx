import { Crown, ArmchairIcon, X, ArrowUp, Shield } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * FantasyPlayerSheet — bottom sheet opened by tapping a player on the
 * Pitch Manager pitch or bench: captain / vice-captain for starters,
 * "Tornar titular" / "Subir no banco" for bench players.
 *
 * Props:
 *  - p, group, pts   the player, roster, last round points (or null).
 *  - captain, vice, bench, benchIndex   current state in my squad.
 *  - onCaptain(), onVice(), onToggleBench(), onMoveUp(), onClose().
 */
export default function FantasyPlayerSheet({ p, group, pts = null, captain, vice, bench, benchIndex = -1, onCaptain, onVice, onToggleBench, onMoveUp, onClose }) {
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
              {captain ? ` · ${t("Capitão")}` : vice ? ` · ${t("Vice-capitão")}` : bench ? ` · ${t("Suplente")} ${benchIndex + 1}` : ""}
            </div>
          </div>
          {pts !== null && (
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
            <>
              <BtnPrimary block onClick={() => run(onToggleBench)}>
                <ArmchairIcon size={16} /> {t("Tornar titular")}
              </BtnPrimary>
              {benchIndex > 0 && (
                <BtnGhost block onClick={() => run(onMoveUp)}>
                  <ArrowUp size={16} /> {t("Subir no banco")}
                </BtnGhost>
              )}
            </>
          ) : (
            <>
              <BtnPrimary block disabled={captain} onClick={() => run(onCaptain)}>
                <Crown size={16} /> {captain ? t("Já é o capitão") : t("Tornar capitão")}
              </BtnPrimary>
              <BtnGhost block disabled={vice || captain} onClick={() => run(onVice)}>
                <Shield size={16} /> {vice ? t("Já é o vice-capitão") : t("Tornar vice-capitão")}
              </BtnGhost>
              <BtnGhost block onClick={() => run(onToggleBench)}>
                <ArmchairIcon size={16} /> {t("Enviar para o banco")}
              </BtnGhost>
            </>
          )}
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.md, lineHeight: 1.4 }}>
          {bench ? t("Entra se um titular não jogar — o 1.º do banco tem prioridade.") : t("O capitão pontua a dobrar. Se ele não jogar, o vice-capitão herda o ×2.")}
        </div>
      </div>
    </div>
  );
}
