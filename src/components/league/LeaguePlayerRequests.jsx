import { useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { pendingPlayerRequests } from "../../lib/leaguePlayerRequests";
import BtnPrimary from "./visual/BtnPrimary";
import BtnGhost from "./visual/BtnGhost";
import SectionLabel from "./visual/SectionLabel";

/** Athletes a captain asked to add. The league registers its athletes, so each one waits here for the Gestor:
 *  approve (joins the squad) or refuse (with a reason the captain sees). `compact` = the Início card with a
 *  way in to Inscrições; otherwise the full list where decisions happen. Renders nothing when there are none. */
export default function LeaguePlayerRequests({ ctx, compact = false }) {
  const { state, act, role } = ctx;
  const [refusing, setRefusing] = useState(null);
  const [reason, setReason] = useState("");
  if (role !== "manager" || ctx.store?.readOnly) return null;
  const pending = pendingPlayerRequests(state);
  if (!pending.length) return null;
  const teamName = (id) => (state.data.teams || []).find((x) => x.id === id)?.name || "—";

  if (compact) {
    return (
      <button type="button" onClick={() => ctx.goManage("registrations")} style={{
        width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, textAlign: "left", cursor: "pointer",
        background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 16, color: C.text1,
        padding: S.md, marginBottom: S.md, boxSizing: "border-box",
      }}>
        <UserPlus size={20} color={C.orange} aria-hidden style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{tf(t("Pedidos de novos atletas · {n}"), { n: pending.length })}</span>
          <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{t("Os capitães pediram para inscrever atletas. Decide em Inscrições.")}</span>
        </span>
        <span style={{ fontSize: T.meta, fontWeight: 800, color: C.orange }}>{t("Decidir")}</span>
      </button>
    );
  }

  return (
    <section style={{ marginBottom: S.xl }} aria-label={t("Pedidos de novos atletas")}>
      <SectionLabel>{tf(t("Pedidos de novos atletas · {n}"), { n: pending.length })}</SectionLabel>
      <div style={{ display: "grid", gap: S.sm }}>
        {pending.map((q) => (
          <div key={q.id} style={{ ...cardStyle, padding: S.md, borderColor: C.orange }}>
            <div style={{ fontSize: T.body, fontWeight: 800 }}>{q.number != null ? `${q.number} · ` : ""}{q.name}{q.position ? ` · ${q.position}` : ""}{q.reuseId ? ` · ${t("reinscrição")}` : ""}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{teamName(q.teamId)}</div>
            {refusing === q.id ? (
              <div style={{ display: "grid", gap: S.sm, marginTop: S.md }}>
                <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder={t("Motivo (opcional, o capitão vê)")} aria-label={t("Motivo")} style={inputStyle()} autoFocus />
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                  <BtnGhost tone="danger" onClick={() => { act.refusePlayerRequest(q.id, reason); setRefusing(null); setReason(""); }}><X size={16} aria-hidden /> {t("Recusar")}</BtnGhost>
                  <BtnGhost onClick={() => { setRefusing(null); setReason(""); }}>{t("Cancelar")}</BtnGhost>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
                <BtnPrimary onClick={() => act.approvePlayerRequest(q.id)}><Check size={16} aria-hidden /> {t("Aprovar e inscrever")}</BtnPrimary>
                <BtnGhost onClick={() => { setRefusing(q.id); setReason(""); }}>{t("Recusar")}</BtnGhost>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
