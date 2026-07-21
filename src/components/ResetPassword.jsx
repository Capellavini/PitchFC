import { useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import { C, cardStyle, BRAND, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";

/** Shown after the user lands from the recovery email link:
 *  they're already authenticated by the token — just set a new password. */
export default function ResetPassword({ onSubmit, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError(t("A palavra-passe precisa de pelo menos 6 caracteres."));
    if (password !== confirm) return setError(t("As palavras-passe não coincidem."));
    setBusy(true);
    const res = await onSubmit(password);
    setBusy(false);
    if (res?.error) return setError(res.error);
    setDone(true);
  };

  const field = (label, value, setter, placeholder) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 12px" }}>
        <Lock size={15} color={C.text3} />
        <input
          type="password" value={value} placeholder={placeholder}
          onChange={(e) => setter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ flex: 1, background: "none", border: "none", padding: "11px 0", fontSize: 14, color: C.text1, outline: "none" }}
        />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 20px", ...fieldBackdrop(0.5, 0.94) }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ width: "62%", maxWidth: 230 }} />
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <KeyRound size={18} color={C.accent} />
          <div style={{ fontSize: 16, fontWeight: 800 }}>{t("Nova palavra-passe")}</div>
        </div>

        {done ? (
          <>
            <div style={{ fontSize: 13, color: C.green, fontWeight: 700, margin: "10px 0 16px" }}>
              {t("Palavra-passe alterada ✓ Já estás dentro.")}
            </div>
            <BtnPrimary onClick={onCancel} style={{ width: "100%", fontSize: 15, padding: 13 }}>
              {t("Ir para a app ⚽")}
            </BtnPrimary>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 16 }}>
              {t("Escolhe a nova palavra-passe da tua conta.")}
            </div>
            {field(t("Nova palavra-passe"), password, setPassword, t("mín. 6 caracteres"))}
            {field(t("Confirmar palavra-passe"), confirm, setConfirm, t("repete a mesma"))}

            {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}

            <BtnPrimary onClick={submit} disabled={busy} style={{ width: "100%", fontSize: 15, padding: 13, opacity: busy ? 0.6 : 1 }}>
              {busy ? t("Um momento…") : t("Guardar nova palavra-passe")}
            </BtnPrimary>
            <button onClick={onCancel}
              style={{ width: "100%", background: "none", border: "none", color: C.text2, fontSize: 12, cursor: "pointer", marginTop: 12 }}>
              {t("Cancelar")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
