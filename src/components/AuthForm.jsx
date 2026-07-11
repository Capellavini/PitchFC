import { useState } from "react";
import { Mail, Lock, User, Phone, ChevronLeft } from "lucide-react";
import { C, cardStyle, displayFont, BRAND, fieldBackdrop } from "../theme";
import BtnPrimary from "./BtnPrimary";

/** Real account: email + password (+ name/phone on signup).
 *  Talks to Supabase Auth via the onSignUp / onSignIn callbacks. */
export default function AuthForm({ onSignUp, onSignIn, onResetPassword, onBack }) {
  const [mode, setMode] = useState("signup"); // 'signup' | 'login'
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const forgotPassword = async () => {
    setError(null); setInfo(null);
    if (!form.email.trim()) return setError("Escreve o teu email primeiro — enviamos-te o link para lá.");
    setBusy(true);
    const res = await onResetPassword(form.email.trim());
    setBusy(false);
    if (res?.error) return setError(res.error);
    setInfo("Enviámos-te um email com o link para criares uma nova palavra-passe. Vê também o spam.");
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isSignup = mode === "signup";

  const submit = async () => {
    setError(null); setInfo(null);
    if (!form.email || !form.password) return setError("Preenche email e palavra-passe.");
    if (form.password.length < 6) return setError("A palavra-passe precisa de pelo menos 6 caracteres.");
    if (isSignup && !form.name.trim()) return setError("Diz-nos o teu nome.");
    setBusy(true);
    const res = isSignup
      ? await onSignUp(form.email.trim(), form.password, { name: form.name.trim(), phone: form.phone.trim() })
      : await onSignIn(form.email.trim(), form.password);
    setBusy(false);
    if (res?.error) return setError(res.error);
    if (res?.needsConfirm) setInfo("Conta criada! Confirma no email que te enviámos e depois faz login.");
  };

  const field = (Icon, label, key, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 12px" }}>
        <Icon size={15} color={C.text3} />
        <input
          type={type} value={form[key]} placeholder={placeholder}
          onChange={(e) => set(key, e.target.value)}
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
        {/* tabs */}
        <div style={{ display: "flex", background: C.surface, borderRadius: 12, padding: 4, marginBottom: 18, gap: 4 }}>
          {[["signup", "Criar conta"], ["login", "Entrar"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setInfo(null); }}
              style={{ flex: 1, background: mode === m ? C.accent : "transparent", color: mode === m ? C.bg : C.text2, border: "none", borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {isSignup && field(User, "Nome completo", "name", "text", "Como te chamas")}
        {isSignup && field(Phone, "Telemóvel", "phone", "tel", "+351 9…")}
        {field(Mail, "Email", "email", "email", "tu@email.com")}
        {field(Lock, "Palavra-passe", "password", "password", "mín. 6 caracteres")}

        {!isSignup && onResetPassword && (
          <div style={{ textAlign: "right", marginTop: -4, marginBottom: 12 }}>
            <button onClick={forgotPassword} disabled={busy}
              style={{ background: "none", border: "none", color: C.text2, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Esqueceste-te da palavra-passe?
            </button>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: C.green, marginBottom: 10 }}>{info}</div>}

        <BtnPrimary onClick={submit} disabled={busy} style={{ width: "100%", fontSize: 15, padding: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Um momento…" : isSignup ? "Criar conta ⚽" : "Entrar"}
        </BtnPrimary>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: C.text2 }}>
          {isSignup ? "Já tens conta? " : "Ainda não tens conta? "}
          <button onClick={() => { setMode(isSignup ? "login" : "signup"); setError(null); setInfo(null); }}
            style={{ background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            {isSignup ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </div>

      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", marginTop: 18, display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
          <ChevronLeft size={15} /> Voltar
        </button>
      )}
    </div>
  );
}
