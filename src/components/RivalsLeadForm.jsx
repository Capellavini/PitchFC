import { useRef, useState } from "react";
import { C, R, S, T, displayFont } from "../theme";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import BtnPrimary from "./BtnPrimary";

const FORMATS = [["F5", "Futebol 5"], ["F7", "Futebol 7"], ["F11", "Futebol 11"]];
const PLAYS = ["Sim, com frequência", "De vez em quando", "Ainda não — queremos começar"];
const EMPTY = { name: "", whatsapp: "", city: "", team_name: "", players_count: "", modality: "", plays: "", email: "" };

const fieldBase = {
  width: "100%", minHeight: 48, marginTop: 6, background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: R.control, padding: "0 14px", fontSize: 16, color: C.text1, outline: "none", fontFamily: "inherit",
};
const labelText = { fontSize: T.meta, fontWeight: 700, color: C.text2 };

const choice = (on) => ({
  minHeight: 44, padding: "0 14px", borderRadius: R.pill, cursor: "pointer", fontSize: T.body, fontWeight: 700,
  background: on ? C.accentDim : C.surface, color: on ? C.accent : C.text2, border: `1px solid ${on ? C.accentBorder : C.border}`,
});

const digits = (s) => s.replace(/\D/g, "").length;

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Diz-nos o teu nome.";
  if (digits(f.whatsapp) < 9) e.whatsapp = "Precisamos de um número de WhatsApp válido.";
  if (!f.city.trim()) e.city = "Em que cidade jogam?";
  if (!f.team_name.trim()) e.team_name = "Como se chama a equipa?";
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Este email não parece válido.";
  return e;
}

/**
 * Early-access form for /rivals. Writes into `leads` through the
 * submit_lead(payload jsonb) RPC (anon-callable) with role "capitão",
 * has_team true, modality = format, source "rivals". In local demo mode
 * (no Supabase keys) nothing is sent and the visitor is told so.
 */
export default function RivalsLeadForm() {
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | busy | ok | demo | error
  const busy = useRef(false);
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async (ev) => {
    ev.preventDefault();
    if (busy.current) return; // double-submit guard (double tap, Enter + click)
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`rv-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    if (!supabaseEnabled) { setStatus("demo"); return; }
    busy.current = true;
    setStatus("busy");
    const payload = {
      name: f.name.trim(), whatsapp: f.whatsapp.trim(), email: f.email.trim(), city: f.city.trim(),
      role: "capitão", has_team: "true", team_name: f.team_name.trim(),
      players_count: f.players_count ? String(parseInt(f.players_count, 10) || "") : "",
      modality: f.modality, interest: f.plays ? [f.plays] : [], source: "rivals",
    };
    try {
      const { error } = await supabase.rpc("submit_lead", { payload });
      if (error) throw error;
      setStatus("ok");
      setF(EMPTY);
      trackEvent("rivals_lead_submitted", { format: f.modality || "n/a" });
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  };

  if (status === "ok" || status === "demo") {
    const ok = status === "ok";
    return (
      <div role="status" style={{ background: C.card, border: `1px solid ${ok ? C.greenBorder : C.accentBorder}`, borderRadius: R.card + 2, padding: "clamp(24px,5vw,40px)", textAlign: "center" }}>
        <div style={{ ...displayFont, fontSize: 28, color: ok ? C.green : C.accent, marginBottom: S.sm }}>{ok ? "Estás dentro! ⚽" : "Modo demo"}</div>
        <p style={{ color: C.text2, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
          {ok
            ? "Vamos falar contigo no WhatsApp para o primeiro desafio."
            : "Esta versão está a correr sem servidor, por isso a inscrição não foi enviada. No site publicado fica registada."}
        </p>
        {!ok && <button type="button" onClick={() => setStatus("idle")} style={{ ...choice(false), marginTop: S.lg }}>Voltar ao formulário</button>}
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

  return (
    <form onSubmit={submit} noValidate style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card + 2, padding: "clamp(18px,4vw,32px)" }}>
      <div className="rv-form-grid">
        {input("name", "O teu nome *", { autoComplete: "name" })}
        <div>
          {input("whatsapp", "WhatsApp *", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "+351 912 345 678", "aria-describedby": "rv-whatsapp-hint" })}
          {!errors.whatsapp && <div id="rv-whatsapp-hint" style={{ fontSize: T.min, color: C.text2, marginTop: 4 }}>Com indicativo do país (ex: +351).</div>}
        </div>
        {input("city", "Cidade *", { autoComplete: "address-level2", placeholder: "Porto, Matosinhos…" })}
        {input("team_name", "Nome da equipa *", { placeholder: "Coletes FC" })}
        {input("players_count", "Nº de jogadores no plantel", { type: "number", inputMode: "numeric", min: 1, max: 60 })}
        {input("email", "Email (opcional)", { type: "email", autoComplete: "email" })}
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: `${S.lg}px 0 0` }}>
        <legend style={{ ...labelText, padding: 0, marginBottom: S.sm }}>Formato</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
          {FORMATS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={f.modality === id} aria-label={label}
              onClick={() => set("modality", f.modality === id ? "" : id)} style={{ ...choice(f.modality === id), minWidth: 64 }}>
              {id}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: `${S.lg}px 0 0` }}>
        <legend style={{ ...labelText, padding: 0, marginBottom: S.sm }}>Já jogam contra outras equipas?</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
          {PLAYS.map((p) => (
            <button key={p} type="button" aria-pressed={f.plays === p} onClick={() => set("plays", f.plays === p ? "" : p)} style={choice(f.plays === p)}>{p}</button>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite">
        {status === "error" && (
          <div role="alert" style={{ marginTop: S.lg, background: C.redDim, color: C.red, borderRadius: R.control, padding: S.md, fontSize: T.body }}>
            Não conseguimos enviar agora. Verifica a ligação e tenta outra vez.
          </div>
        )}
      </div>

      <BtnPrimary type="submit" block disabled={isBusy} aria-busy={isBusy} style={{ marginTop: S.xl, minHeight: 52, fontSize: 16 }}>
        {isBusy ? "A enviar…" : "Inscrever a minha equipa"}
      </BtnPrimary>
      <div style={{ textAlign: "center", fontSize: T.min, color: C.text2, marginTop: S.md }}>Grátis · sem spam · só te contactamos sobre o PITCH Rivals.</div>
    </form>
  );
}
