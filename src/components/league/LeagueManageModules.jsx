import { Check } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { MODULES, MODULE_GROUPS, CORE_FEATURES, moduleOn, moduleById } from "../../lib/leagueModules";
import SectionLabel from "../SectionLabel";
import LeagueSwitch from "./LeagueSwitch";

/** Módulos da liga: what the league switches on. The core is always there;
 *  everything else starts off (except the light ones) and each league decides. */
export default function LeagueManageModules({ ctx }) {
  const { state, act } = ctx;
  return (
    <div>
      <SectionLabel>{t("Sempre incluído")}</SectionLabel>
      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: S.xl }}>
        {CORE_FEATURES.map((f) => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: S.xs, fontSize: T.meta, color: C.text1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 999, padding: "6px 12px" }}>
            <Check size={14} color={C.green} aria-hidden /> {t(f)}
          </span>
        ))}
      </div>
      {MODULE_GROUPS.map((g) => (
        <section key={g.id} style={{ marginBottom: S.xl }}>
          <SectionLabel>{t(g.name)}</SectionLabel>
          <div style={{ ...cardStyle, padding: `0 ${S.md}px` }}>
            {MODULES.filter((m) => m.group === g.id).map((m, i) => {
              const on = moduleOn(state, m.id);
              const needs = m.requires && !moduleOn(state, m.requires) ? moduleById(m.requires) : null;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px 0`, borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: T.body, fontWeight: 800 }}>{t(m.name)}</div>
                    <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.45, marginTop: 2 }}>{t(m.desc)}</div>
                    {needs && <div style={{ fontSize: T.meta, color: C.orange, marginTop: 4 }}>{t("Liga também")} «{t(needs.name)}».</div>}
                  </div>
                  <LeagueSwitch on={on} label={t(m.name)} onChange={(v) => act.setModule(m.id, v)} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
        {t("Desligar um módulo esconde-o para toda a gente na liga; os dados ficam guardados e voltam quando o ligares outra vez.")}
      </div>
    </div>
  );
}
