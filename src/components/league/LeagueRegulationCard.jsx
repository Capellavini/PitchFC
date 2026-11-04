import { useState } from "react";
import { FileText } from "lucide-react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { regulationOf, REGULATION_MAX } from "../../lib/leagueRegulation";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** The league's regulation, kept as text so the Adjunto can check the champion and the promotions against it.
 *  Paste the articles that matter, or send the PDF to the Adjunto and confirm what it proposes to keep. */
export default function LeagueRegulationCard({ ctx }) {
  const { state, act } = ctx;
  const saved = regulationOf(state);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const show = editing || !saved;
  return (
    <section style={{ ...cardStyle, marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
        <FileText size={18} color={C.accent} aria-hidden />
        <h2 style={{ margin: 0, fontSize: T.cardTitle }}>{t("Regulamento")}</h2>
      </div>
      <p style={{ margin: `0 0 ${S.md}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
        {t("O Adjunto consulta o regulamento para te ajudar a decidir o campeão e as subidas e descidas, e cita o artigo. Não é público. A decisão é sempre da direção.")}
      </p>
      {saved && !editing && (
        <div style={{ display: "grid", gap: S.sm }}>
          <div style={{ fontSize: T.body, fontWeight: 800 }}>{saved.name} <span style={{ color: C.text2, fontWeight: 400 }}>· {tf(t("{n} caracteres"), { n: saved.text.length })}</span></div>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
            <BtnGhost onClick={() => { setText(saved.text); setName(saved.name); setEditing(true); }}>{t("Editar")}</BtnGhost>
            <BtnGhost tone="danger" onClick={() => act.saveRegulation("", "")}>{t("Remover")}</BtnGhost>
          </div>
        </div>
      )}
      {show && (
        <div style={{ display: "grid", gap: S.sm }}>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={t("Nome do documento (opcional)")} aria-label={t("Nome do documento")} style={inputStyle()} />
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, REGULATION_MAX))} rows={7} placeholder={t("Cola aqui os artigos do regulamento: campeão e desempates, subidas e descidas, castigos, faltas de comparência.")} aria-label={t("Texto do regulamento")} style={{ ...inputStyle(), minHeight: 140, resize: "vertical", padding: S.md }} />
          <div style={{ fontSize: T.meta, color: C.text2 }}>{tf(t("{n} de {max} caracteres. Também podes enviar o PDF ao Adjunto: ele propõe guardar os artigos que interessam."), { n: text.length, max: REGULATION_MAX })}</div>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
            <BtnPrimary disabled={text.trim().length < 40} onClick={() => { if (act.saveRegulation(name, text).ok) { setEditing(false); setText(""); setName(""); } }}>{t("Guardar regulamento")}</BtnPrimary>
            {saved && <BtnGhost onClick={() => setEditing(false)}>{t("Cancelar")}</BtnGhost>}
          </div>
        </div>
      )}
    </section>
  );
}
