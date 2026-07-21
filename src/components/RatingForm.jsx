import { useState } from "react";
import { C, cardStyle, displayFont } from "../theme";
import { ATTR_LABELS } from "../lib/helpers";
import { t, attrName } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";

const DEFAULT_ATTRS = { rit: 70, rem: 70, pas: 70, dri: 70, def: 70, fis: 70 };

/** Inline stats rating, submitted right from the target player's profile
 *  (cloud mode) — replaces the old WhatsApp-link + paste-code flow.
 *  Re-submitting updates the rater's previous rating instead of adding a
 *  second one (one rating per rater per player, enforced server-side). */
export default function RatingForm({ nick, existing, onSubmit }) {
  const [attrs, setAttrs] = useState(existing ?? DEFAULT_ATTRS);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const setAttr = (k, v) => setAttrs((a) => ({ ...a, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await onSubmit(attrs);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
        {existing ? t("A tua avaliação de") : t("Avaliar")} {nick}
      </div>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
        {t("Sê justo — a média com as avaliações dos outros amigos forma o cartão dele.")}
      </div>
      {Object.keys(ATTR_LABELS).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ width: 52, fontSize: 12, color: C.text2 }}>{attrName(k)}</span>
          <input type="range" min="40" max="99" value={attrs[k]}
            onChange={(e) => setAttr(k, Number(e.target.value))}
            style={{ flex: 1, accentColor: C.accent }} />
          <span style={{ ...displayFont, width: 28, fontSize: 16, color: C.accent, textAlign: "right" }}>{attrs[k]}</span>
        </div>
      ))}
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
      <BtnPrimary onClick={submit} disabled={busy} style={{ width: "100%", opacity: busy ? 0.6 : 1 }}>
        {busy ? t("Um momento…") : done ? t("Avaliação enviada ✓") : existing ? t("Atualizar avaliação") : t("Enviar avaliação")}
      </BtnPrimary>
    </div>
  );
}
