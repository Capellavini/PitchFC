import { useState } from "react";
import { Shield, Lock, Mail, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { C, cardStyle } from "../theme";
import SectionLabel from "./SectionLabel";

/** Account security (cloud only): change password, change email,
 *  sign out of every device. Talks to Supabase Auth via the props. */
export default function SecuritySection({ email, onUpdatePassword, onUpdateEmail, onSignOutEverywhere }) {
  const [open, setOpen] = useState(null); // 'password' | 'email' | null
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const toggle = (panel) => { setOpen(open === panel ? null : panel); setMsg(null); };

  const savePassword = async () => {
    setMsg(null);
    if (pw.length < 6) return setMsg({ ok: false, text: "A palavra-passe precisa de pelo menos 6 caracteres." });
    if (pw !== pw2) return setMsg({ ok: false, text: "As palavras-passe não coincidem." });
    setBusy(true);
    const res = await onUpdatePassword(pw);
    setBusy(false);
    if (res?.error) return setMsg({ ok: false, text: res.error });
    setPw(""); setPw2(""); setOpen(null);
    setMsg({ ok: true, text: "Palavra-passe alterada ✓" });
  };

  const saveEmail = async () => {
    setMsg(null);
    const clean = newEmail.trim();
    if (!clean || !clean.includes("@")) return setMsg({ ok: false, text: "Escreve um email válido." });
    setBusy(true);
    const res = await onUpdateEmail(clean);
    setBusy(false);
    if (res?.error) return setMsg({ ok: false, text: res.error });
    setNewEmail(""); setOpen(null);
    setMsg({ ok: true, text: `Enviámos um link de confirmação para ${clean} — o email só muda depois de o abrires.` });
  };

  const signOutAll = async () => {
    if (!window.confirm("Terminar sessão em todos os dispositivos? Vais ter de voltar a entrar em todos, incluindo este.")) return;
    setBusy(true);
    const res = await onSignOutEverywhere();
    setBusy(false);
    if (res?.error) setMsg({ ok: false, text: res.error });
    // On success the auth listener signs the app out — nothing else to do.
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: C.surface,
    border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px",
    fontSize: 14, color: C.text1, outline: "none", marginBottom: 10,
  };

  const row = (panel, Icon, title, subtitle) => (
    <button onClick={() => toggle(panel)}
      style={{ width: "100%", background: "none", border: "none", padding: "10px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: C.text1 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={C.text2} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.text2 }}>{subtitle}</div>
      </div>
      {open === panel ? <ChevronUp size={15} color={C.text3} /> : <ChevronDown size={15} color={C.text3} />}
    </button>
  );

  const actionBtn = (label, onClick) => (
    <button onClick={onClick} disabled={busy}
      style={{ width: "100%", background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
      {busy ? "Um momento…" : label}
    </button>
  );

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={14} color={C.text2} />
        <SectionLabel style={{ marginBottom: 0 }}>SEGURANÇA</SectionLabel>
      </div>

      {row("password", Lock, "Alterar palavra-passe", "Define uma nova palavra-passe")}
      {open === "password" && (
        <div style={{ paddingBottom: 12 }}>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova palavra-passe (mín. 6)" style={inputStyle} />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirmar palavra-passe"
            onKeyDown={(e) => e.key === "Enter" && savePassword()} style={inputStyle} />
          {actionBtn("Guardar palavra-passe", savePassword)}
        </div>
      )}

      {row("email", Mail, "Trocar email", email ? `Atual: ${email}` : "Muda o email da conta")}
      {open === "email" && (
        <div style={{ paddingBottom: 12 }}>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo@email.com"
            onKeyDown={(e) => e.key === "Enter" && saveEmail()} style={inputStyle} />
          {actionBtn("Enviar confirmação", saveEmail)}
        </div>
      )}

      <button onClick={signOutAll} disabled={busy}
        style={{ width: "100%", background: "none", border: "none", padding: "10px 0", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.redDim, border: `1px solid ${C.red}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <LogOut size={16} color={C.red} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>Sair de todos os dispositivos</div>
          <div style={{ fontSize: 11, color: C.text2 }}>Termina a sessão em todo o lado (incluindo aqui)</div>
        </div>
      </button>

      {msg && <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, marginTop: 6 }}>{msg.text}</div>}
    </div>
  );
}
