import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnGhost from "./BtnGhost";

/** Game Detail → "Material": who brings the ball, the bibs… One row per
 *  item inside a single card (tap the box to tick it off). Organizers /
 *  assistants can assign an item to a player and add new items. Still
 *  local state even in cloud mode (see CLAUDE.md "Still local"). */
export default function MaterialChecklist({ items = [], group = [], canManage, onToggle, onAssign, onAdd }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || !onAdd) return;
    onAdd(v);
    setDraft("");
  };
  const nickOf = (id) => group.find((p) => p.id === id)?.nick;

  return (
    <div style={{ ...cardStyle, padding: "0 16px" }}>
      {items.length === 0 && (
        <div style={{ padding: `${S.lg}px 0`, fontSize: T.body, color: C.text2 }}>{t("Sem material na lista.")}</div>
      )}
      {items.map((m, i) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 56, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
          <button onClick={() => onToggle?.(m.id)} aria-label={m.item} aria-pressed={m.done}
            style={{ width: TOUCH.min, height: TOUCH.min, marginLeft: -6, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${m.done ? C.green : C.border}`, background: m.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.done && <Check size={14} strokeWidth={3} color={C.bg} />}
            </span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.body, fontWeight: 700, color: m.done ? C.text2 : C.text1, textDecoration: m.done ? "line-through" : "none" }}>{t(m.item)}</div>
            {!canManage && (
              <div style={{ fontSize: T.meta, color: C.text2 }}>{nickOf(m.assignedTo) || t("Ninguém atribuído")}</div>
            )}
          </div>
          {canManage && (
            <select value={m.assignedTo ?? ""} onChange={(e) => onAssign?.(m.id, e.target.value === "" ? null : (group.find((p) => String(p.id) === e.target.value)?.id ?? null))}
              style={{ maxWidth: 140, minHeight: 36, background: C.surface, color: m.assignedTo ? C.text1 : C.text2, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 8px", fontSize: T.meta, fontWeight: 600 }}>
              <option value="">{t("Ninguém")}</option>
              {group.map((p) => <option key={p.id} value={String(p.id)}>{p.nick}</option>)}
            </select>
          )}
        </div>
      ))}
      {canManage && onAdd && (
        <div style={{ display: "flex", gap: S.sm, padding: `${S.md}px 0`, borderTop: items.length ? `1px solid ${C.border}` : "none" }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder={t("Adicionar item (ex.: Coletes)")}
            style={{ flex: 1, minWidth: 0, minHeight: TOUCH.min, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 12px", fontSize: T.body, color: C.text1, outline: "none" }} />
          <BtnGhost onClick={add} disabled={!draft.trim()} aria-label={t("Adicionar")} style={{ minHeight: TOUCH.min, padding: "0 12px" }}><Plus size={18} /></BtnGhost>
        </div>
      )}
    </div>
  );
}
