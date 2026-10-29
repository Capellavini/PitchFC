import { useState } from "react";
import { Megaphone, Pin, PinOff } from "lucide-react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { fmtDateTime } from "../../lib/leagueDemo";
import { notices, postNotice, editNotice, removeNotice } from "../../lib/leagueLanding";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import LeagueField from "./LeagueField";

const BODY_MAX = 1200;
const TITLE_MAX = 120;

/** Avisos: what the league tells its fans on the page (a game moved, a round confirmed, a rule).
 *  Published the moment it is saved; pinned notices stay on top. */
export default function LeagueManageNotices({ ctx }) {
  const { state, act, lang } = ctx;
  const [editing, setEditing] = useState(null); // notice id | null
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const list = notices(state);
  const reset = () => { setEditing(null); setTitle(""); setBody(""); setPinned(false); };
  const submit = (e) => {
    e.preventDefault();
    const r = editing
      ? act.setup((s) => editNotice(s, editing, { title, body, pinned }), t("Aviso atualizado."))
      : act.setup((s) => postNotice(s, { title, body, pinned }), t("Aviso publicado na página."));
    if (r.ok) reset();
  };
  const start = (n) => { setEditing(n.id); setTitle(n.title); setBody(n.body); setPinned(Boolean(n.pinned)); setConfirmDelete(null); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* jsdom */ } };
  const togglePin = (n) => act.setup((s) => editNotice(s, n.id, { pinned: !n.pinned }), n.pinned ? t("Aviso desafixado.") : t("Aviso fixado no topo."));
  const remove = (id) => { if (confirmDelete !== id) { setConfirmDelete(id); return; } act.setup((s) => removeNotice(s, id), t("Aviso apagado.")); setConfirmDelete(null); if (editing === id) reset(); };

  return (
    <div style={{ marginBottom: S.xl, maxWidth: 640 }}>
      <SectionLabel>{t("Avisos")}</SectionLabel>
      <form onSubmit={submit} style={{ ...cardStyle, display: "grid", gap: S.md, marginBottom: S.md }}>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
          {t("Escreve um aviso e ele aparece logo na página da liga: jogo adiado, jornada confirmada, uma regra, uma festa. Quem acompanha a liga vê-o no topo.")}
        </div>
        <LeagueField label={t("Título")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} style={inputStyle()} autoComplete="off" placeholder={t("Ex.: Jornada 6 adiada")} />
        </LeagueField>
        <LeagueField label={t("Texto")} hint={`${body.length}/${BODY_MAX}`}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={4} style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5 }} />
        </LeagueField>
        <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44, fontSize: T.body, cursor: "pointer" }}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ width: 22, height: 22, accentColor: C.accent }} />
          {t("Fixar no topo da página")}
        </label>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          <BtnPrimary type="submit" disabled={title.trim().length < 2 || !body.trim()}>{editing ? t("Guardar aviso") : t("Publicar aviso")}</BtnPrimary>
          {editing && <BtnGhost onClick={reset}>{t("Cancelar")}</BtnGhost>}
        </div>
      </form>

      {list.length === 0
        ? <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>{t("Ainda não publicaste nenhum aviso.")}</div>
        : (
          <div style={{ display: "grid", gap: S.sm }}>
            {list.map((n) => (
              <div key={n.id} style={{ ...cardStyle, display: "grid", gap: S.xs, borderColor: editing === n.id ? C.accentBorder : undefined }}>
                <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start" }}>
                  <Megaphone size={18} color={n.pinned ? C.accent : C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: T.body, fontWeight: 800, overflowWrap: "anywhere" }}>{n.title}{n.pinned && <span style={{ color: C.accent, fontSize: T.meta, marginLeft: S.sm }}>{t("Fixado")}</span>}</div>
                    <div style={{ fontSize: T.meta, color: C.text2 }}>{fmtDateTime(n.at, lang)}</div>
                  </div>
                </div>
                <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.body}</div>
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.xs }}>
                  <BtnGhost compact onClick={() => start(n)}>{t("Editar")}</BtnGhost>
                  <BtnGhost compact onClick={() => togglePin(n)}>{n.pinned ? <><PinOff size={14} aria-hidden /> {t("Desafixar")}</> : <><Pin size={14} aria-hidden /> {t("Fixar")}</>}</BtnGhost>
                  <BtnGhost compact tone="danger" onClick={() => remove(n.id)}>{confirmDelete === n.id ? t("Confirmar: apagar") : t("Apagar")}</BtnGhost>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
