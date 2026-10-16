import { useState } from "react";
import { C, R, S, T, cardStyle, displayFont, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { LP } from "../lib/leaguePageCopy";
import { supabase, supabaseEnabled } from "../lib/supabase";
import PhoneInput from "./PhoneInput";
import BtnPrimary from "./BtnPrimary";
import { leagueLeadPayload, leagueLeadValid, EMPTY_LEAGUE_LEAD as EMPTY } from "../lib/leagueLead";

const MODALITIES = [LP.modalityF5, LP.modalityF7, LP.modalityF11, LP.modalityFutsal, LP.modalityOther];

/** Pilot request form for league organizers (/league). Demo mode (no
 *  Supabase keys) shows the success state without sending anything. */
export default function LeagueLeadForm() {
  const [f, setF] = useState(EMPTY);
  const [status, setStatus] = useState(null); // null | busy | ok | invalid | error
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!leagueLeadValid(f)) { setStatus("invalid"); return; }
    setStatus("busy");
    if (!supabaseEnabled) { setStatus("ok"); return; }
    const { error } = await supabase.rpc("submit_lead", { payload: leagueLeadPayload(f) });
    if (error) { setStatus("error"); return; }
    setF(EMPTY); setStatus("ok");
  };

  if (status === "ok") {
    return (
      <div role="status" style={{ ...cardStyle, borderColor: C.greenBorder, padding: S.xxl, textAlign: "center" }}>
        <div style={{ ...displayFont, fontSize: 26, color: C.green, marginBottom: S.sm }}>{t(LP.okTitle)}</div>
        <div style={{ color: C.text2, fontSize: T.body + 1 }}>{t(LP.okBody)}</div>
      </div>
    );
  }

  const label = (id, text, req) => (
    <label htmlFor={id} style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>
      {text}{req && <span style={{ color: C.text2, fontWeight: 600 }}> · {t(LP.required)}</span>}
    </label>
  );
  const field = (k, text, { type = "text", req, ...extra } = {}) => (
    <div>
      {label(`lgl-${k}`, text, req)}
      <input id={`lgl-${k}`} type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} required={req} {...extra} style={inputStyle()} />
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate style={{ ...cardStyle, padding: "clamp(18px,4vw,32px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: S.md }}>
        {field("name", t(LP.fName), { req: true, autoComplete: "name" })}
        {field("email", t(LP.fEmail), { type: "email", autoComplete: "email", inputMode: "email" })}
        <div>
          <span style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t(LP.fWhatsapp)}</span>
          <PhoneInput value={f.whatsapp} onChange={(v) => set("whatsapp", v)} />
        </div>
        {field("league", t(LP.fLeague), { req: true })}
        {field("city", t(LP.fCity), { autoComplete: "address-level2" })}
        {field("teams", t(LP.fTeams), { type: "number", min: 2, max: 200, inputMode: "numeric" })}
        <div>
          {label("lgl-modality", t(LP.fModality))}
          <select id="lgl-modality" value={f.modality} onChange={(e) => set("modality", e.target.value)} style={{ ...inputStyle(), color: f.modality ? C.text1 : C.text2 }}>
            <option value="">—</option>
            {MODALITIES.map((m) => <option key={m} value={m}>{t(m)}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: S.md }}>
        {label("lgl-message", t(LP.fMessage))}
        <textarea id="lgl-message" value={f.message} onChange={(e) => set("message", e.target.value)} rows={3} maxLength={1000} placeholder={t(LP.fMessagePh)}
          style={{ ...inputStyle(), minHeight: 92, resize: "vertical" }} />
      </div>
      {(status === "invalid" || status === "error") && (
        <div role="alert" style={{ color: C.red, fontSize: T.meta + 1, marginTop: S.md }}>{t(status === "invalid" ? LP.errRequired : LP.errSend)}</div>
      )}
      <BtnPrimary type="submit" block disabled={status === "busy"} style={{ marginTop: S.lg, minHeight: 52, fontSize: T.body + 2, borderRadius: R.control }}>
        {status === "busy" ? t(LP.sending) : t(LP.send)}
      </BtnPrimary>
      <div style={{ textAlign: "center", fontSize: T.meta, color: C.text2, marginTop: S.sm }}>
        {t(LP.privacy)} <a href="/privacidade" style={{ color: C.text2, display: "inline-flex", alignItems: "center", minHeight: 44 }}>{t("Política de Privacidade")}</a>
      </div>
    </form>
  );
}
