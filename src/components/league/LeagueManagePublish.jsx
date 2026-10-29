import { useState } from "react";
import { Copy, ExternalLink, Globe, MessageCircle } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { leaguePageUrl } from "../../lib/leagueLanding";
import { whatsappShareUrl } from "../../lib/leagueRoles";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

const WA_GREEN = "#25D366"; // WhatsApp actions always use this green

/** The league's own page (/leagues/<slug>): published by itself once the league has a name,
 *  hidden with one click and brought back the same way. */
export default function LeagueManagePublish({ ctx }) {
  const { store, notify, state } = ctx;
  const [busy, setBusy] = useState(false);
  if (!store || store.readOnly) return null;
  const url = store.slug ? leaguePageUrl(store.slug, window.location.origin) : "";
  const name = state.data.league?.name || "";
  const toggle = async (on) => {
    setBusy(true);
    const r = await store.publish(on);
    setBusy(false);
    if (r.error) notify(t(r.error === "name_required" ? "Dá primeiro um nome à liga." : "Não foi possível alterar a página. Tenta outra vez."), "error");
    else notify(on ? t("Página publicada.") : t("Página escondida."));
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); notify(t("Ligação copiada.")); } catch { notify(t("Não foi possível copiar. Seleciona a ligação e copia."), "error"); } };
  const share = `${t("Acompanha a")} ${name}: ${t("jornadas, resultados, classificação e artilheiros")}.\n${url}`;
  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("A página da liga")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800 }}>
          <Globe size={18} color={store.published ? C.green : C.text2} aria-hidden /> {store.published ? t("Publicada") : store.slug ? t("Escondida") : t("Ainda sem página")}
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
          {store.slug || name.trim().length >= 2
            ? t("Cada liga tem a sua página, com a vossa marca: jornada a jornada, classificação, artilheiros, equipas, avisos e a inscrição dos adeptos no Pitch Manager. Quem tiver a ligação vê só nomes e números dos atletas. Não mostra contactos nem dados privados. Podes esconder a página quando quiseres.")
            : t("A página é criada sozinha assim que a liga tiver um nome. Dá-lhe um nome em «Identidade da liga».")}
        </div>
        {store.published && url && (
          <>
            <code style={{ overflowWrap: "anywhere", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: T.meta }}>{url}</code>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
              <BtnGhost onClick={copy}><Copy size={16} aria-hidden /> {t("Copiar")}</BtnGhost>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: `0 ${S.md}px`, borderRadius: 12, border: `1px solid ${C.border}`, color: C.text1, fontWeight: 700, fontSize: T.body, textDecoration: "none" }}>
                <ExternalLink size={16} aria-hidden /> {t("Ver a página")}
              </a>
              <a href={whatsappShareUrl(share)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: `0 ${S.md}px`, borderRadius: 12, background: WA_GREEN, color: "#04210f", fontWeight: 800, fontSize: T.body, textDecoration: "none" }}>
                <MessageCircle size={16} aria-hidden /> {t("Enviar por WhatsApp")}
              </a>
            </div>
          </>
        )}
        {(store.slug || name.trim().length >= 2) && (
          <div>{store.published
            ? <BtnGhost disabled={busy} onClick={() => toggle(false)}>{t("Esconder a página")}</BtnGhost>
            : <BtnPrimary disabled={busy} onClick={() => toggle(true)}>{t("Publicar a página")}</BtnPrimary>}</div>
        )}
      </div>
    </div>
  );
}
