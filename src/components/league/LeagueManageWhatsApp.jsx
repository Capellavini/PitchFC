import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { linkUrl, LINK_ERROR } from "../../lib/leagueWhatsApp";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

const WA_GREEN = "#25D366"; // WhatsApp actions always use this green

/** Adjunto on WhatsApp: link the manager's phone once, then send the Adjunto a
 *  sentence about a game or a photo of the súmula and confirm with "sim". */
export default function LeagueManageWhatsApp({ ctx }) {
  const { store, notify } = ctx;
  const [status, setStatus] = useState(null); // null = loading
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { const r = await store.wa.status(); setStatus(r.error ? { error: true } : r.data); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setBusy(true);
    const r = await store.wa.createCode();
    setBusy(false);
    if (r.error) { notify(t(LINK_ERROR[r.error] || "Não foi possível gerar o código. Tenta outra vez."), "error"); return; }
    setCode(r.data);
  };
  const unlink = async () => {
    setBusy(true);
    const r = await store.wa.unlink();
    setBusy(false);
    if (r.error) { notify(t("Não foi possível desligar. Tenta outra vez."), "error"); return; }
    setCode(null); notify(t("WhatsApp desligado.")); load();
  };
  const url = linkUrl(code);

  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("Adjunto no WhatsApp")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800 }}>
          <MessageCircle size={18} color={status?.linked ? WA_GREEN : C.text2} aria-hidden />
          {status === null ? t("A verificar…") : status.linked ? `${t("Ligado")}${status.phone ? ` · ${status.phone}` : ""}` : t("Não ligado")}
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
          {t("Escreve ao Adjunto, ou manda a foto ou o PDF da súmula, e ele prepara o resultado para confirmares. Só muda a liga quando respondes «sim». Os resultados ficam por homologar na app.")}
        </div>
        {status?.linked ? (
          <div><BtnGhost tone="danger" disabled={busy} onClick={unlink}>{t("Desligar este WhatsApp")}</BtnGhost></div>
        ) : (
          <>
            {!url && <div><BtnPrimary disabled={busy} onClick={generate}>{t("Ligar o meu WhatsApp")}</BtnPrimary></div>}
            {url && (
              <div style={{ display: "grid", gap: S.sm }}>
                <div style={{ fontSize: T.meta, color: C.text2 }}>{t("O código vale 15 minutos e só se usa uma vez:")} <strong style={{ color: C.text1, letterSpacing: "0.08em" }}>{code}</strong></div>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 12, background: WA_GREEN, color: "#04210f", fontWeight: 800, fontSize: T.body, textDecoration: "none", padding: `0 ${S.lg}px` }}>
                  {t("Abrir o WhatsApp e enviar")}
                </a>
                <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Envia a mensagem tal como aparece, sem a editar. Quando o Adjunto responder «Ligado», volta aqui.")}</div>
                <div><BtnGhost disabled={busy} onClick={() => { setCode(null); load(); }}>{t("Já enviei")}</BtnGhost></div>
              </div>
            )}
          </>
        )}
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("O texto e as fotos são lidos por uma IA (Anthropic). Contactos e licenças são mascarados no texto; uma foto pode mostrar nomes de atletas.")}</div>
      </div>
    </div>
  );
}
