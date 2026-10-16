import { C, R, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, ROLE_LABEL } from "../../lib/leagueCopy";
import SegmentedControl from "../SegmentedControl";

const ROLES = ["fan", "athlete", "captain", "manager"];

/** Demo-only role switcher (Adepto · Atleta · Capitão · Gestor). Clearly
 *  marked: it changes the view, never grants anything real. */
export default function LeagueRoleSwitcher({ role, onRole }) {
  return (
    <section aria-label={t(LG.viewAs)} style={{ background: C.surface, border: `1px dashed ${C.orange}66`, borderRadius: R.card, padding: `${S.sm}px ${S.md}px ${S.xs}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.xs }}>
        <span style={{ fontSize: T.meta, fontWeight: 800, color: C.orange, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t(LG.demoMode)} · {t(LG.viewAs)}</span>
      </div>
      <SegmentedControl options={ROLES.map((id) => ({ id, label: ROLE_LABEL[id] }))} value={role} onChange={onRole} style={{ marginBottom: S.xs }} />
      <div style={{ fontSize: T.min, color: C.text2, lineHeight: 1.4, paddingBottom: S.xs }}>{t(LG.roleNote)}</div>
    </section>
  );
}
