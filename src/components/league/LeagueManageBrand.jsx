import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { C, R, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { setLeagueBrand } from "../../lib/leagueSetup";
import { logoFromFile, onColor, safeLogo } from "../../lib/leagueBrand";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** The league's logo and colour. The colour is taken from the logo when it is
 *  uploaded, and can be changed by hand. */
export default function LeagueManageBrand({ ctx }) {
  const { state, act, notify } = ctx;
  const lg = state.data.league;
  const [logo, setLogo] = useState(safeLogo(lg.logo));
  const [color, setColor] = useState(lg.color || "");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const dirty = (logo || null) !== (safeLogo(lg.logo) || null) || (color || "") !== (lg.color || "");
  const pick = async (file) => {
    setBusy(true);
    const r = await logoFromFile(file);
    setBusy(false);
    if (r.error) { notify(t(r.error === "unsupported" ? "Usa uma imagem PNG, JPG ou WebP." : r.error === "too_large" ? "A imagem é demasiado grande." : "Não consegui ler essa imagem."), "error"); return; }
    setLogo(r.dataUrl);
    if (r.color) setColor(r.color);
  };
  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("Logótipo e cor")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.md }}>
        <div style={{ display: "flex", gap: S.lg, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: 80, height: 80, borderRadius: R.control, background: C.surface, border: `2px solid ${color || C.border}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
            {logo ? <img src={logo} alt={t("Logótipo da liga")} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ color: C.text2, fontSize: T.min }}>{t("Sem logótipo")}</span>}
          </span>
          <div style={{ display: "grid", gap: S.sm }}>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f); }} />
            <BtnGhost onClick={() => input.current?.click()}><Upload size={16} aria-hidden /> {busy ? t("A ler…") : logo ? t("Trocar logótipo") : t("Carregar logótipo")}</BtnGhost>
            {logo && <BtnGhost tone="danger" onClick={() => setLogo(null)}>{t("Remover")}</BtnGhost>}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
          {t("Cor da liga")}
          <input type="color" value={color || "#C8FF00"} onChange={(e) => setColor(e.target.value.toUpperCase())} style={{ width: 44, height: 36, border: `1px solid ${C.border}`, borderRadius: 8, background: "none", padding: 0 }} />
          <span style={{ background: color || C.accent, color: onColor(color || C.accent), borderRadius: 999, padding: "2px 10px", fontSize: T.min, fontWeight: 800 }}>{color || "#C8FF00"}</span>
        </label>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Partilha apenas um logótipo que tenhas autorização para usar. A cor sai do logótipo ao carregá-lo.")}</div>
        <div><BtnPrimary disabled={!dirty} onClick={() => act.setup((s) => setLeagueBrand(s, { logo, color: color || null }), t("Marca guardada."))}>{t("Guardar")}</BtnPrimary></div>
      </div>
    </div>
  );
}
