import { useState } from "react";
import { Gamepad2, Check } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "../../../theme";
import { t } from "../../../lib/i18n";
import { onColor } from "../../../lib/leagueBrand";
import { landingApi, signupErrorText } from "../../../lib/leagueLandingApi";

/** A fan leaves a name and an email to be told when the league's Pitch Manager opens. No account,
 *  no password: one tap and a tick for consent. Needs the consent box; a hidden field catches bots. */
export default function LandingSignup({ slug, leagueName, teams, brand, ink }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState(""); // bots fill every field; people never see this one
  const [phase, setPhase] = useState("idle"); // idle | sending | done
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (phase === "sending") return;
    if (trap) { setPhase("done"); return; }
    setError(null);
    setPhase("sending");
    const r = await landingApi.signup(slug, { name, email, teamId: teamId || null, consent });
    if (r.error) { setPhase("idle"); setError(signupErrorText(r.error)); return; }
    setPhase("done");
  };

  const box = { background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.lg };
  if (phase === "done") {
    return (
      <div role="status" style={{ ...box, display: "flex", gap: S.md, alignItems: "flex-start", borderColor: `${brand}88` }}>
        <Check size={22} color={ink} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t("Estás inscrito!")}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.5, marginTop: S.xs }}>{t("Avisamos-te por email quando o Pitch Manager da liga abrir. Obrigado por acompanhares a liga.")}</div>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} style={{ ...box, display: "grid", gap: S.md }} noValidate>
      <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
        <Gamepad2 size={24} color={ink} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.5 }}>
          {t("Monta a tua equipa com atletas reais da liga e soma pontos com os golos e as assistências de cada jornada. Deixa o teu email e avisamos-te quando abrir.")}
        </div>
      </div>
      <label style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
        {t("O teu nome")}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required style={{ ...inputStyle(), marginTop: S.xs }} />
      </label>
      <label style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
        {t("Email")}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" inputMode="email" required style={{ ...inputStyle(), marginTop: S.xs }} />
      </label>
      {teams.length > 0 && (
        <label style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
          {t("A tua equipa (opcional)")}
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ ...inputStyle(), marginTop: S.xs }}>
            <option value="">{t("Ainda não escolhi")}</option>
            {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </label>
      )}
      <div aria-hidden style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
      </div>
      <label style={{ display: "flex", gap: S.md, alignItems: "flex-start", fontSize: T.meta, color: C.text2, lineHeight: 1.5, cursor: "pointer", minHeight: TOUCH.min }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1, accentColor: brand, flexShrink: 0 }} />
        <span>
          {t("Aceito que a organização da")} {leagueName} {t("guarde o meu nome e email só para me avisar do Pitch Manager. Posso pedir para os apagar quando quiser.")}{" "}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: ink }}>{t("Política de privacidade")}</a>
        </span>
      </label>
      {error && <div role="alert" style={{ color: C.red, fontSize: T.body }}>{t(error)}</div>}
      <button type="submit" disabled={phase === "sending" || !consent || name.trim().length < 2 || !email.includes("@")}
        style={{ minHeight: TOUCH.button, border: `1px solid ${ink}`, borderRadius: R.control, background: brand, color: onColor(brand), fontWeight: 800, fontSize: T.body, cursor: "pointer", opacity: phase === "sending" || !consent || name.trim().length < 2 || !email.includes("@") ? 0.55 : 1 }}>
        {phase === "sending" ? t("A inscrever…") : t("Quero jogar o Pitch Manager")}
      </button>
    </form>
  );
}
