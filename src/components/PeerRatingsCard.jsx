import { useState } from "react";
import { Star, MessageCircle } from "lucide-react";
import { C, S, R, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import BtnGhost from "./BtnGhost";

/** Own profile → "Avaliação dos amigos": how many peer ratings the FUT
 *  card still needs (3+ unlocks it), who already rated, and — local demo
 *  only — the WhatsApp request + paste-code flow (cloud players rate
 *  each other straight from a teammate's profile via RatingForm). */
export default function PeerRatingsCard({ player, cloudMode, onRequest, addPeerRating }) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeStatus, setCodeStatus] = useState(null); // 'ok' | 'error'
  const count = player.ratingsCount ?? 0;
  const unlocked = count >= 3;

  const submitCode = () => {
    const ok = addPeerRating(codeDraft);
    setCodeStatus(ok ? "ok" : "error");
    if (ok) setCodeDraft("");
  };

  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel right={<span style={{ fontSize: T.meta, fontWeight: 700, color: unlocked ? C.green : C.orange }}>{Math.min(count, 3)}/3</span>}>
        {t("AVALIAÇÃO DOS AMIGOS")}
      </SectionLabel>
      <div style={{ ...cardStyle, borderLeft: unlocked ? cardStyle.border : `3px solid ${C.accent}` }}>
        <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.45, marginBottom: S.md }}>
          {unlocked
            ? t("O cartão mostra a média das avaliações que recebeste.")
            : `${t("Faltam")} ${Math.max(0, 3 - count)} ${t("avaliações para desbloquear o teu cartão.")}`}
        </div>

        {player.raters?.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
            {player.raters.map((r, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: S.xs, height: 28, padding: `0 ${S.md - 2}px`, borderRadius: R.pill, background: C.surface, border: `1px solid ${C.border}`, fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
                <Star size={12} color={C.gold} fill={C.gold} /> {r.nick}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Ainda ninguém te avaliou.")}</div>
        )}

        {!cloudMode && (
          <div style={{ marginTop: S.lg, paddingTop: S.lg, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={onRequest} style={{ flex: 1.4, minHeight: 48, background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, fontSize: T.body - 1, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs + 2 }}>
                <MessageCircle size={16} /> {t("Pedir avaliação")}
              </button>
              <BtnGhost onClick={() => { setCodeOpen(!codeOpen); setCodeStatus(null); }} style={{ flex: 1, padding: `0 ${S.sm}px` }}>
                <Star size={15} /> {t("Inserir código")}
              </BtnGhost>
            </div>

            {codeOpen && (
              <div style={{ marginTop: S.md }}>
                <div style={{ display: "flex", gap: S.sm }}>
                  <input value={codeDraft} onChange={(e) => { setCodeDraft(e.target.value); setCodeStatus(null); }} placeholder={t("Cola aqui o código recebido…")}
                    style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px`, fontSize: T.meta + 1, color: C.text1, outline: "none", fontFamily: "monospace" }} />
                  <BtnGhost tone="accent" compact onClick={submitCode} style={{ minHeight: 44 }}>{t("Adicionar")}</BtnGhost>
                </div>
                {codeStatus === "ok" && <div style={{ fontSize: T.meta, color: C.green, marginTop: S.sm }}>{t("Avaliação adicionada — o teu cartão já reflete a opinião ✓")}</div>}
                {codeStatus === "error" && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{t("Código inválido — confirma que copiaste tudo.")}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
