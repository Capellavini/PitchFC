import { useState } from "react";
import { Users } from "lucide-react";
import { C, S, R, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";
import ListRow from "./ListRow";

/** Jogar → Grupos: "os meus grupos", one row each → Group page.
 *  `groups`: [{ id, name, meta, active }]. `onOpen(group)` may be async
 *  (switching the active group first, in cloud mode) — the row shows a
 *  busy state and any `{ error }` it returns. */
export default function GroupsList({ groups = [], onOpen }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const open = async (g) => {
    if (busyId) return;
    setError(null);
    setBusyId(g.id);
    const res = await onOpen(g);
    setBusyId(null);
    if (res?.error) setError(res.error);
  };

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <SectionLabel>{t("Os teus grupos")}</SectionLabel>
      <div style={{ ...cardStyle, padding: "0 16px" }}>
        {groups.map((g, i) => (
          <ListRow key={g.id} divider={i > 0} onClick={() => open(g)}
            leading={
              <span style={{ width: 40, height: 40, borderRadius: R.control, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: busyId === g.id ? 0.5 : 1 }}>
                <Users size={20} color={C.text2} />
              </span>
            }
            title={g.name}
            meta={g.meta}
            right={g.active && groups.length > 1 ? <Chip variant="green">{t("Ativo")}</Chip> : null} />
        ))}
      </div>
      {error && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{String(error)}</div>}
    </div>
  );
}
