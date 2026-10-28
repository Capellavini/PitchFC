import { useState } from "react";
import { Check, Ban } from "lucide-react";
import { C, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { tf, POSITION_LABEL } from "../../lib/leagueCopy";
import { PLAYERS, teamById } from "../../lib/leagueDemo";
import Sheet from "../Sheet";
import BtnPrimary from "../BtnPrimary";

/** Captain's call-up for ONE match (own team only). Players with a
 *  pending suspension (DEMO_RULES) can't be called up. */
export default function LeagueLineupSheet({ match, teamId, discipline, onSave, onClose }) {
  const squad = PLAYERS.filter((p) => p.teamId === teamId);
  const suspended = (id) => (discipline[id]?.pending || 0) > 0;
  const [sel, setSel] = useState(() => new Set(match.lineups?.[teamId]?.length ? match.lineups[teamId] : squad.filter((p) => !suspended(p.id)).map((p) => p.id)));
  const toggle = (id) => setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => { const r = onSave([...sel]); if (r?.ok || r?.same) onClose(); };
  return (
    <Sheet title={tf(t("Convocatória · {team}"), { team: teamById[teamId].name })} onClose={onClose}
      footer={<BtnPrimary block onClick={save} disabled={sel.size < 5}>{tf(t("Guardar convocatória ({n})"), { n: sel.size })}</BtnPrimary>}>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm, lineHeight: 1.5 }}>{t("Mínimo de 5 atletas para o jogo se realizar (regra por defeito). Só atletas inscritos nesta competição.")}</div>
      {squad.map((p) => {
        const ban = suspended(p.id);
        const on = sel.has(p.id);
        return (
          <button key={p.id} type="button" role="checkbox" aria-checked={on} disabled={ban} onClick={() => toggle(p.id)}
            style={{ width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: ban ? C.text2 : C.text1, cursor: ban ? "not-allowed" : "pointer", textAlign: "left", padding: 0 }}>
            <span aria-hidden style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? C.accent : C.border}`, background: on ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {on && <Check size={14} color={C.bg} strokeWidth={3} />}
              {ban && <Ban size={14} color={C.red} />}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: T.body }}>{p.number} · {p.name} <span style={{ color: C.text2, fontSize: T.meta }}>{t(POSITION_LABEL[p.position])}</span></span>
            {ban && <span style={{ fontSize: T.meta, color: C.red, fontWeight: 700 }}>{t("Suspenso")}</span>}
          </button>
        );
      })}
    </Sheet>
  );
}
