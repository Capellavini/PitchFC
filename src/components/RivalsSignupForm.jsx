import { useRef, useState } from "react";
import { MailCheck } from "lucide-react";
import { C, R, S, T, displayFont } from "../theme";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { makeCreateIntent, formatFromModality, countryFromPhone } from "../lib/pendingIntent";
import BtnPrimary from "./BtnPrimary";
import PhoneInput from "./PhoneInput";

const FORMATS = [["F5", "Futebol 5"], ["F7", "Futebol 7"], ["F11", "Futebol 11"]];
const PLAYS = [RC.suPlaysOften, RC.suPlaysSometimes, RC.suPlaysNotYet];
const EMPTY = { name: "", whatsapp: "", city: "", team_name: "", players_count: "", modality: "", plays: "", email: "", password: "" };

const fieldBase = {
  width: "100%", minHeight: 48, marginTop: 6, background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: R.control, padding: "0 14px", fontSize: 16, color: C.text1, outline: "none", fontFamily: "inherit",
};
const labelText = { fontSize: T.meta, fontWeight: 700, color: C.text2 };
const linkBtn = { background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", minHeight: 44, padding: "0 8px", textDecoration: "underline", fontFamily: "inherit" };
const choice = (on) => ({
  minHeight: 44, padding: "0 14px", borderRadius: R.pill, cursor: "pointer", fontSize: T.body, fontWeight: 700,
  background: on ? C.accentDim : C.surface, color: on ? C.accent : C.text2, border: `1px solid ${on ? C.accentBorder : C.border}`,
});
const digits = (s) => s.replace(/\D/g, "").length;

function validate(f, loggedIn) {
  const e = {};
  if (!loggedIn) {
    if (!f.name.trim()) e.name = t(RC.errName);
    if (digits(f.whatsapp) < 9) e.whatsapp = t(RC.errWhatsApp);
  }
  if (!f.city.trim()) e.city = t(RC.errCity);
  const tn = f.team_name.trim();
  if (tn.length < 2 || tn.length > 40) e.team_name = t(RC.errTeamName);
  if (!loggedIn) {
    if (!f.email.trim()) e.email = t(RC.errEmail);
    else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = t(RC.errEmailBad);
    if (f.password.length < 6) e.password = t(RC.errPassword);
  }
  return e;
}

/** Supabase auth code → { field?, msg }. */
function authError(code) {
  if (code === "weak_password") return { field: "password", msg: t(RC.errWeakPassword) };
  if (code === "network") return { msg: t(RC.errNetwork) };
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return { msg: t(RC.errRateLimit) };
  if (code === "invalid_credentials") return { field: "password", msg: t(RC.errBadLogin) };
  if (code === "email_not_confirmed") return { msg: t(RC.errNotConfirmed) };
  if (code === "email_address_invalid") return { field: "email", msg: t(RC.errEmailBad) };
  return { msg: t(RC.errGeneric) };
}

/**
 * /rivals form (decision 2026-10-13 a): creates the captain's ACCOUNT and,
 * once the email is confirmed, the TEAM — no more "inscrição enviada".
 *
 *   signUp (user_metadata: name, phone, pending_intent create_team)
 *   + submit_lead (source "rivals", best effort — keeps the CRM funnel)
 *   → "Confirma o teu email" → the confirmation link lands in the app,
 *   which resumes the intent (quick card → create_team → team page with
 *   the invite sheet open). See PitchApp's create-team intent.
 *
 * Already registered → login, then the same resume. Already logged in →
 * only the team fields + "Criar a minha equipa". Demo mode (no Supabase)
 * simulates the confirmation.
 *
 * `account` = { mode: "cloud"|"demo", loggedIn, who, signUp(email, pw,
 *   {name, phone}, intent), signIn(email, pw), resend(email),
 *   resetPassword(email), start(intent) } — start() hands over to the app.
 * Copy stays honest: no field booking, payments or charges.
 */
export default function RivalsSignupForm({ account }) {
  const loggedIn = Boolean(account?.loggedIn);
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | busy | confirm | demo
  const [mode, setMode] = useState("signup"); // signup | login (email already registered)
  const [banner, setBanner] = useState(null);
  const [resent, setResent] = useState(false);
  const busy = useRef(false);
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const intent = () => makeCreateIntent(
    { name: f.team_name, city: f.city, format: formatFromModality(f.modality), country: countryFromPhone(f.whatsapp) },
    { name: f.name.trim(), phone: f.whatsapp.trim() },
  );

  const submitLead = async () => {
    if (!supabaseEnabled) return;
    const payload = {
      name: f.name.trim() || account?.who || "", whatsapp: f.whatsapp.trim(), email: f.email.trim(), city: f.city.trim(),
      role: "capitão", has_team: "true", team_name: f.team_name.trim(),
      players_count: f.players_count ? String(parseInt(f.players_count, 10) || "") : "",
      modality: f.modality, interest: f.plays ? [f.plays] : [], source: "rivals",
    };
    try { await supabase.rpc("submit_lead", { payload }); } catch { /* the account matters more than the lead */ }
  };

  const focusFirst = (e) => {
    const el = document.getElementById(`rv-${Object.keys(e)[0]}`);
    (el?.matches?.("input, textarea, select") ? el : el?.querySelector("input"))?.focus();
  };

  const run = async (fn) => {
    if (busy.current) return; // double-submit guard (double tap, Enter + click)
    busy.current = true;
    setStatus("busy"); setBanner(null);
    try { await fn(); } finally { busy.current = false; }
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = validate(f, loggedIn);
    setErrors(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    const it = intent();
    if (loggedIn) {
      run(async () => {
        await submitLead();
        trackEvent("rivals_team_create_started", { from: "lp_logged_in" });
        account.start(it);
      });
      return;
    }
    if (account?.mode === "demo") { setStatus("demo"); return; }
    run(async () => {
      const r = await account.signUp(f.email.trim(), f.password, { name: f.name.trim(), phone: f.whatsapp.trim() }, it);
      if (r?.error) {
        if (r.code === "user_already_exists" || r.code === "email_exists") { setMode("login"); setStatus("idle"); return; }
        const m = authError(r.code);
        if (m.field) setErrors((x) => ({ ...x, [m.field]: m.msg })); else setBanner(m.msg);
        setStatus("idle");
        return;
      }
      if (r?.alreadyRegistered) { setMode("login"); setStatus("idle"); return; }
      await submitLead();
      trackEvent("rivals_signup", { format: f.modality || "n/a" });
      if (!r?.needsConfirm) { account.start(it); return; } // confirmation OFF: already in
      setStatus("confirm");
    });
  };

  const login = (ev) => {
    ev.preventDefault();
    if (f.password.length < 6) { setErrors({ password: t(RC.errPassword) }); return; }
    run(async () => {
      const r = await account.signIn(f.email.trim(), f.password);
      if (r?.error) {
        const m = authError(r.code);
        if (m.field) setErrors({ [m.field]: m.msg }); else setBanner(m.msg);
        setStatus("idle");
        return;
      }
      await submitLead();
      account.start(intent());
    });
  };

  const resend = async () => {
    setBanner(null);
    const r = await account.resend(f.email.trim());
    if (r?.error) setBanner(authError(r.code).msg); else setResent(true);
  };

  const errorBox = (
    <div aria-live="polite">
      {banner && (
        <div role="alert" style={{ marginTop: S.lg, background: C.redDim, color: C.red, borderRadius: R.control, padding: S.md, fontSize: T.body }}>{banner}</div>
      )}
    </div>
  );

  const panel = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card + 2, padding: "clamp(18px,4vw,32px)" };

  if (status === "confirm" || status === "demo") {
    const demo = status === "demo";
    return (
      <div role="status" style={{ ...panel, borderColor: C.accentBorder, textAlign: "center" }}>
        <MailCheck size={36} color={C.accent} aria-hidden style={{ marginBottom: S.sm }} />
        <div style={{ ...displayFont, fontSize: 28, color: C.accent, marginBottom: S.sm }}>{t(demo ? RC.demoTitle : RC.confirmTitle)}</div>
        <p style={{ color: C.text2, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
          {demo ? t(RC.demoBody) : tf(RC.confirmBody, { email: f.email.trim(), team: f.team_name.trim() })}
        </p>
        {demo ? (
          <BtnPrimary block onClick={() => account.start(intent())} style={{ marginTop: S.xl, minHeight: 52 }}>{t(RC.demoConfirm)}</BtnPrimary>
        ) : (
          <>
            <p style={{ color: C.text2, fontSize: T.meta, margin: `${S.md}px 0 0` }}>{t(RC.confirmSpam)}</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: S.sm, marginTop: S.md }}>
              <button type="button" onClick={resend} disabled={resent} style={{ ...choice(resent), minWidth: 140 }}>{t(resent ? RC.resent : RC.resend)}</button>
              <button type="button" onClick={() => { setStatus("idle"); setResent(false); }} style={choice(false)}>{t(RC.useOtherEmail)}</button>
            </div>
            {errorBox}
          </>
        )}
      </div>
    );
  }

  const input = (k, label, props = {}) => (
    <div>
      <label htmlFor={`rv-${k}`} style={labelText}>{label}</label>
      <input id={`rv-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)}
        aria-invalid={Boolean(errors[k])} aria-describedby={errors[k] ? `rv-${k}-err` : props["aria-describedby"]}
        {...props} style={{ ...fieldBase, borderColor: errors[k] ? C.red : C.border }} />
      {errors[k] && <div id={`rv-${k}-err`} style={{ color: C.red, fontSize: T.meta, marginTop: 4 }}>{errors[k]}</div>}
    </div>
  );
  const isBusy = status === "busy";

  if (mode === "login") {
    return (
      <form onSubmit={login} noValidate style={panel}>
        <div style={{ ...displayFont, fontSize: 24, marginBottom: S.sm }}>{t(RC.existsTitle)}</div>
        <p style={{ color: C.text2, fontSize: 15, lineHeight: 1.5, margin: `0 0 ${S.lg}px` }}>{tf(RC.existsBody, { team: f.team_name.trim() })}</p>
        <div className="rv-form-grid">
          {input("email", t(RC.suEmail), { type: "email", autoComplete: "email" })}
          {input("password", t(RC.suPassword), { type: "password", autoComplete: "current-password" })}
        </div>
        {errorBox}
        <BtnPrimary type="submit" block disabled={isBusy} aria-busy={isBusy} style={{ marginTop: S.xl, minHeight: 52, fontSize: 16 }}>
          {isBusy ? t(RC.suBusy) : t(RC.existsLogin)}
        </BtnPrimary>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", marginTop: S.sm }}>
          {account?.resetPassword && (
            <button type="button" style={linkBtn} onClick={async () => {
              const r = await account.resetPassword(f.email.trim());
              setBanner(r?.error ? authError(r.code).msg : null);
              if (!r?.error) setResent(true);
            }}>{resent ? t(RC.resent) : t(RC.forgotPassword)}</button>
          )}
          <button type="button" style={linkBtn} onClick={() => { setMode("signup"); setStatus("idle"); setErrors({}); setBanner(null); setResent(false); }}>{t(RC.useOtherEmail)}</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={panel}>
      {loggedIn && (
        <p style={{ color: C.text2, fontSize: T.body, lineHeight: 1.5, margin: `0 0 ${S.lg}px` }}>{tf(RC.suLoggedAs, { who: account.who || "" })}</p>
      )}
      <div className="rv-form-grid">
        {!loggedIn && input("name", t(RC.suYourName), { autoComplete: "name" })}
        {!loggedIn && (
          <div>
            <label htmlFor="rv-whatsapp" style={labelText}>{t(RC.suWhatsApp)}</label>
            {/* Same country-code picker as signup/Perfil — value is always E.164. */}
            <div id="rv-whatsapp" style={{ marginTop: 6 }}>
              <PhoneInput value={f.whatsapp} onChange={(v) => set("whatsapp", v)} />
            </div>
            {errors.whatsapp && <div id="rv-whatsapp-err" style={{ color: C.red, fontSize: T.meta, marginTop: 4 }}>{errors.whatsapp}</div>}
          </div>
        )}
        {input("city", t(RC.suCity), { autoComplete: "address-level2", placeholder: t(RC.suCityPh) })}
        {input("team_name", t(RC.suTeamName), { placeholder: "Coletes FC", maxLength: 40 })}
        {!loggedIn && input("email", t(RC.suEmail), { type: "email", autoComplete: "email" })}
        {!loggedIn && input("password", t(RC.suPassword), { type: "password", autoComplete: "new-password", "aria-describedby": "rv-password-hint" })}
      </div>
      {!loggedIn && <div id="rv-password-hint" style={{ fontSize: T.min, color: C.text2, marginTop: S.xs }}>{t(RC.suPasswordHint)}</div>}

      {errorBox}

      <BtnPrimary type="submit" block disabled={isBusy} aria-busy={isBusy} style={{ marginTop: S.xl, minHeight: 52, fontSize: 16 }}>
        {isBusy ? t(RC.suBusy) : t(loggedIn ? RC.suSubmitLogged : RC.suSubmit)}
      </BtnPrimary>
      <div style={{ textAlign: "center", fontSize: T.min, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>
        {t(RC.suFine)}
        {!loggedIn && <><br /><a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: C.text2 }}>{t(RC.suTerms)}</a></>}
      </div>
    </form>
  );
}
