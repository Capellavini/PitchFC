import { useState } from "react";
import { Shield, Link2 } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, RIVALS_BRAND, rivalsError } from "../lib/rivalsCopy";
import { parseTeamLink } from "../lib/rivals";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/** No team yet: the PITCH Rivals pitch + "Criar equipa" (primary) and
 *  "Entrar por convite" (paste a ?tjoin= link → onJoin(token)). */
export default function TeamEmptyState({ onCreate, onJoin }) {
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const join = async () => {
    const { token } = parseTeamLink(text);
    if (!token) { setError(t(RC.notAnInvite)); return; }
    setBusy(true); setError(null);
    const r = await onJoin(token);
    setBusy(false);
    if (r?.error) setError(rivalsError(r.error));
  };

  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl + 4}px ${S.lg + 4}px`, marginBottom: S.lg }}>
      <div style={{ width: 56, height: 56, borderRadius: R.card, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${S.lg}px` }}>
        <Shield size={26} color={C.accent} />
      </div>
      <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.1em", color: C.accent, marginBottom: S.sm }}>{RIVALS_BRAND.toUpperCase()}</div>
      <div style={{ ...displayFont, fontSize: 22, color: C.text1, marginBottom: S.sm }}>{t(RC.emptyTitle)}</div>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.6, marginBottom: S.xl - 4 }}>{t(RC.emptyBody)}</div>
      <BtnPrimary block onClick={onCreate}>{t(RC.createTeam)}</BtnPrimary>
      {pasting ? (
        <div style={{ marginTop: S.md, textAlign: "left" }}>
          <label style={{ display: "block", fontSize: T.meta, color: C.text2, marginBottom: 6 }} htmlFor="rivals-invite-paste">{t(RC.pasteInvite)}</label>
          <div style={{ display: "flex", gap: S.sm }}>
            <input id="rivals-invite-paste" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="https://pitch-fc.com/?tjoin=…" style={{ ...inputStyle(), flex: 1, minWidth: 0 }} autoFocus />
            <BtnGhost onClick={join} disabled={busy}>{t(RC.join)}</BtnGhost>
          </div>
          {error && <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{error}</div>}
        </div>
      ) : (
        <BtnGhost block onClick={() => setPasting(true)} style={{ marginTop: S.sm }}><Link2 size={16} /> {t(RC.joinByInvite)}</BtnGhost>
      )}
    </div>
  );
}
