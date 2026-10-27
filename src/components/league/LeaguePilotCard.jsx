import { useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError } from "../../lib/leagueCloudCopy";
import BtnPrimary from "../BtnPrimary";
import {supabase} from '../../lib/supabase';
import OperationsOnboarding from './operations/OperationsOnboarding';
import BtnGhost from "../BtnGhost";

/** Pilot gate (brief §5): request → admin review → create ONE league from the approval.
 *  The page never says "aprovado" until the admin actually approved. */
export default function LeaguePilotCard({ leagues, onCreated }) {
  const reqs = leagues.myRequests;
  const approved = reqs.find((r) => r.status === "approved" && !r.usedByLeagueId);
  const pending = reqs.find((r) => r.status === "pending");
  const lastRejected = !approved && !pending && reqs[0]?.status === "rejected";
  const [f, setF] = useState({ orgName: "", city: "", expectedTeams: "", context: "" });
  const [name, setName] = useState(approved?.orgName || "");
  const [wizard,setWizard]=useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const requestAI=async body=>{try{const {data}=await supabase.auth.getSession();if(!data.session?.access_token)return {error:'Inicia sessão.'};const res=await fetch('/api/league-copilot',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});const r=await res.json();return res.ok?r:{error:r.message||'IA indisponível.'}}catch{return {error:'IA indisponível. Continua por etapas.'}}};
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await leagues.requestPilot(f);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error));
  };
  const create = async () => {
    setBusy(true); setErr(null);
    const r = await leagues.createLeague(name || approved?.orgName, approved?.city ? { city: approved.city } : {},approved ? `req-${approved.id}` : null);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error)); else onCreated?.(r.data.slug);
  };
  const field = (k, label, props = {}) => (
    <label style={{ display: "block", marginBottom: S.sm }}>
      <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{t(label)}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={inputStyle()} {...props} />
    </label>
  );

  return (
    <section style={{ ...cardStyle, padding: S.lg, marginBottom: S.lg }}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t(LC.pilotTitle)}</div>
      {approved ? (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0 ${S.md}px` }}>{t(LC.requestApproved)}</div>
          <label style={{ display: "block", marginBottom: S.md }}>
            <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{t(LC.leagueName)}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} maxLength={80} />
          </label>
          <BtnPrimary block disabled={busy || (name || approved?.orgName || "").trim().length < 2} onClick={()=>setWizard(true)}>{t(LC.createLeague)}</BtnPrimary>
        </>
      ) : pending ? (
        <div style={{ fontSize: T.body, color: C.text1, marginTop: S.sm }}>{t(LC.requestPending)} <span style={{ color: C.text2 }}>· {pending.orgName}</span></div>
      ) : (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0 ${S.md}px` }}>{t(lastRejected ? LC.requestRejected : LC.pilotBody)}</div>
          {field("orgName", LC.orgName, { maxLength: 80 })}
          {field("city", LC.city, { maxLength: 80 })}
          {field("expectedTeams", LC.expectedTeams, { inputMode: "numeric", pattern: "[0-9]*" })}
          {field("context", LC.context, { maxLength: 1000 })}
          <BtnPrimary block disabled={busy || f.orgName.trim().length < 2} onClick={send}>{t(LC.sendRequest)}</BtnPrimary>
        </>
      )}
      {leagues.isAdmin && !approved ? (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: S.lg, paddingTop: S.md }}>
          <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t(LC.adminCreate)}</div>
          <div style={{ display: "flex", gap: S.sm }}>
            <input aria-label={t(LC.leagueName)} placeholder={t(LC.leagueName)} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} maxLength={80} />
            <BtnGhost disabled={busy || name.trim().length < 2} onClick={()=>setWizard(true)}>{t(LC.createLeague)}</BtnGhost>
          </div>
        </div>
      ) : null}
      {wizard&&<OperationsOnboarding requestAI={leagues.mode==='demo'?undefined:requestAI} leagues={leagues} initialName={name||approved?.orgName||''} initialCity={approved?.city||''} clientRef={approved?'req-'+approved.id:undefined} onCreated={slug=>onCreated?.(slug)} onClose={()=>setWizard(false)}/>}
      {err ?<div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{err}</div> : null}
    </section>
  );
}
