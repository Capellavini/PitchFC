import { useState } from "react";
import { Copy, Globe } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** The public page of the league (/l/<slug>): off until the Gestor publishes it. */
export default function LeagueManagePublish({ ctx }) {
  const { store, notify } = ctx;
  const [busy, setBusy] = useState(false);
  if (!store || store.readOnly) return null;
  const url = store.slug ? `${window.location.origin}/l/${store.slug}` : "";
  const toggle = async (on) => {
    setBusy(true);
    const r = await store.publish(on);
    setBusy(false);
    if (r.error) notify(t(r.error === "name_required" ? "Dá primeiro um nome à liga." : "Não foi possível alterar a página pública. Tenta outra vez."), "error");
    else notify(on ? t("Página pública publicada.") : t("Página pública escondida."));
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); notify(t("Ligação copiada.")); } catch { notify(t("Não foi possível copiar. Seleciona a ligação e copia."), "error"); } };
  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("Página pública")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800 }}><Globe size={18} color={store.published ? C.green : C.text2} aria-hidden /> {store.published ? t("Publicada") : t("Escondida")}</div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
          {t("Quem tiver a ligação vê calendário, resultados, classificação e plantéis (só nome e número). Não mostra contactos nem dados privados. Podes esconder a página quando quiseres.")}
        </div>
        {store.published && url && (
          <div style={{ display: "flex", gap: S.sm, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: T.meta }}>{url}</code>
            <BtnGhost onClick={copy}><Copy size={16} aria-hidden /> {t("Copiar")}</BtnGhost>
          </div>
        )}
        <div>{store.published
          ? <BtnGhost disabled={busy} onClick={() => toggle(false)}>{t("Esconder a página")}</BtnGhost>
          : <BtnPrimary disabled={busy} onClick={() => toggle(true)}>{t("Publicar a página")}</BtnPrimary>}</div>
      </div>
    </div>
  );
}
