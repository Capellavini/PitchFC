import { useState } from "react";
import { Users, LogOut, ShieldCheck, ArrowRight } from "lucide-react";
import { C, cardStyle, displayFont, BRAND, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";

/** Logged-in player with no group yet: paste an invite code (or arrive
 *  via a ?join= link, handled upstream) to attach to a group — or skip
 *  and explore the app without one. */
export default function JoinGroup({ onJoin, onLogout, onSkip, isAdmin, onOpenAdmin }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    if (!code.trim()) return setError(t("Cola o código de convite do teu grupo."));
    setBusy(true);
    const res = await onJoin(code.trim());
    setBusy(false);
    if (res?.error) setError(res.error);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 20px", ...fieldBackdrop(0.5, 0.94) }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ width: "58%", maxWidth: 210 }} />
      </div>

      <div style={{ ...cardStyle, padding: 22, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Users size={24} color={C.accent} />
        </div>
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 6 }}>{t("Entra num grupo")}</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 18, lineHeight: 1.5 }}>
          {t("Pede ao organizador o link ou o código de convite do grupo. Abrir o link do convite junta-te automaticamente.")}
        </div>

        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("Código de convite")}
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: C.text1, outline: "none", textAlign: "center", fontFamily: "monospace", marginBottom: 12 }} />

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}

        <BtnPrimary onClick={submit} disabled={busy} style={{ width: "100%", fontSize: 15, padding: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? t("A entrar…") : t("Juntar-me ao grupo")}
        </BtnPrimary>
      </div>

      {/* No group yet — explore the app anyway */}
      {onSkip && (
        <button onClick={onSkip} style={{ ...cardStyle, marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: C.text1 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Ainda não tenho grupo")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Explora a app na mesma — entras num grupo quando quiseres.")}</div>
          </div>
          <ArrowRight size={16} color={C.accent} />
        </button>
      )}

      {isAdmin && (
        <button onClick={onOpenAdmin} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", marginTop: 18, display: "flex", alignItems: "center", gap: 7, justifyContent: "center" }}>
          <ShieldCheck size={15} /> {t("Painel de administrador")}
        </button>
      )}

      <button onClick={onLogout} style={{ background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", marginTop: 14, display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
        <LogOut size={14} /> {t("Sair")}
      </button>
    </div>
  );
}
