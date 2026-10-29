import { useState } from "react";
import { C, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { roleErrorText } from "../../lib/leagueRoles";
import Avatar from "../Avatar";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

/** An athlete who came in through the team link says who they are in the squad. Once: to change it
 *  the Gestor removes the access and sends a new invite. */
export default function LeagueClaimPlayer({ team, players, onClaim }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const pick = async (p) => {
    setBusy(p.id); setError("");
    const r = await onClaim(p.id);
    setBusy(null);
    if (r?.error) setError(roleErrorText(r.error));
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: FONT, padding: `${S.xl}px ${S.lg}px` }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>
        <div style={{ ...displayFont, fontSize: 16, letterSpacing: "0.14em", color: C.accent }}>LIGAS</div>
        <h1 style={{ margin: `${S.sm}px 0`, fontSize: T.title, fontWeight: 900, lineHeight: 1.15 }}>{t("Quem és tu?")}</h1>
        <p style={{ margin: `0 0 ${S.lg}px`, color: C.text2, fontSize: T.body, lineHeight: 1.5 }}>
          {t("Escolhe o teu nome no plantel de")} <strong style={{ color: C.text1 }}>{team?.name}</strong>. {t("Fica ligado à tua conta e só o gestor o pode mudar.")}
        </p>
        <div style={{ display: "grid", gap: S.sm }}>
          {players.map((p) => (
            <button key={p.id} type="button" disabled={Boolean(busy)} onClick={() => pick(p)}
              style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.button, textAlign: "left", cursor: busy ? "wait" : "pointer", color: C.text1, opacity: busy && busy !== p.id ? 0.5 : 1 }}>
              <Avatar name={p.name} photo={p.photo} color={team?.color || C.accent} size={36} />
              <span style={{ flex: 1, minWidth: 0, fontWeight: 800, overflowWrap: "anywhere" }}>{p.name}</span>
              {p.number !== null && p.number !== undefined && <span style={{ ...displayFont, color: C.text2, fontSize: T.cardTitle }}>{p.number}</span>}
            </button>
          ))}
        </div>
        {!players.length && <div style={{ ...cardStyle, color: C.text2 }}>{t("O plantel desta equipa ainda está vazio. Pede ao capitão ou ao gestor para te acrescentarem.")}</div>}
        {error && <p role="alert" style={{ color: C.orange, fontSize: T.meta, marginTop: S.md }}>{t(error)}</p>}
      </div>
    </div>
  );
}
