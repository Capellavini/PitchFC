import { useState } from "react";
import { ChevronDown, Check, Repeat } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";

/** Persistent group switcher for the app header — replaces the old
 *  "Meus grupos" list buried at the bottom of Perfil. Same underlying
 *  action (cloud.switchActiveGroup: swaps which membership is the
 *  active one, restoring that membership's role), just promoted to
 *  somewhere reachable from every tab. Renders nothing if there's
 *  nothing to switch to (single-group players, local demo mode). */
export default function GroupSwitcher({ currentName, myGroups, onSwitchGroup, activeGroupId }) {
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState(null);
  const [error, setError] = useState(null);

  if (!onSwitchGroup || !myGroups || myGroups.length < 2) {
    return currentName ? (
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{currentName}</div>
    ) : null;
  }

  const switchTo = async (groupId) => {
    if (groupId === activeGroupId || switchingId) return;
    setError(null);
    setSwitchingId(groupId);
    const res = await onSwitchGroup(groupId);
    setSwitchingId(null);
    if (res?.error) setError(res.error);
    else setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.text1, cursor: "pointer", padding: 0, maxWidth: 170 }}>
        <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</span>
        <ChevronDown size={14} color={C.text3} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: C.bg, borderRadius: "20px 20px 0 0", padding: "20px 16px calc(20px + env(safe-area-inset-bottom))", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 14 }}>{t("Os teus grupos")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myGroups.map((m) => {
                const active = m.group_id === activeGroupId;
                const roleLabel = m.role === "organizer" ? t("Organizador") : m.role === "assistant" ? t("Auxiliar") : t("Membro");
                const busy = switchingId === m.group_id;
                return (
                  <button key={m.group_id} onClick={() => switchTo(m.group_id)} disabled={active || busy}
                    style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: active ? "default" : "pointer", textAlign: "left", color: C.text1, opacity: busy ? 0.6 : 1, padding: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? C.greenDim : C.surface, border: `1px solid ${active ? C.green : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {active ? <Check size={16} color={C.green} /> : <Repeat size={15} color={C.text2} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.groups?.name}</div>
                      <div style={{ fontSize: 11, color: C.text2 }}>{roleLabel}{m.groups?.venue ? ` · ${m.groups.venue}` : ""}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {error && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{error}</div>}
            <button onClick={() => setOpen(false)} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", padding: 8 }}>{t("Fechar")}</button>
          </div>
        </div>
      )}
    </>
  );
}
