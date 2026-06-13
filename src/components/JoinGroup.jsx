import { useState } from "react";
import { Users, LogOut } from "lucide-react";
import { C, cardStyle, displayFont, BRAND, fieldBackdrop } from "../theme";
import BtnPrimary from "./BtnPrimary";

/** Logged-in player with no group yet: paste an invite code (or arrive
 *  via a ?join= link, handled upstream) to attach to a group. */
export default function JoinGroup({ onJoin, onLogout }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    if (!code.trim()) return setError("Cola o código de convite do teu grupo.");
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
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 6 }}>Entra num grupo</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 18, lineHeight: 1.5 }}>
          Pede ao organizador o link ou o código de convite do grupo. Abrir o link do convite junta-te automaticamente.
        </div>

        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Código de convite"
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: C.text1, outline: "none", textAlign: "center", fontFamily: "monospace", marginBottom: 12 }} />

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}

        <BtnPrimary onClick={submit} disabled={busy} style={{ width: "100%", fontSize: 15, padding: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? "A entrar…" : "Juntar-me ao grupo"}
        </BtnPrimary>
      </div>

      <button onClick={onLogout} style={{ background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", marginTop: 18, display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
        <LogOut size={14} /> Sair
      </button>
    </div>
  );
}
