import { useState } from "react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { computeAchievements } from "../lib/achievements";
import SectionLabel from "./SectionLabel";
import AchievementBadge from "./AchievementBadge";

/** Perfil → Conquistas: the badge grid (unlocked first-class, locked
 *  dimmed) + a progress bar; tap a badge for its description. */
export default function AchievementsSection({ player, ctx }) {
  const [selectedId, setSelectedId] = useState(null);
  const achievements = computeAchievements(player, ctx);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const selected = achievements.find((a) => a.id === selectedId);
  const pct = achievements.length ? Math.round((unlockedCount / achievements.length) * 100) : 0;

  return (
    <div style={{ ...cardStyle, marginBottom: S.lg }}>
      <SectionLabel right={<span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>{unlockedCount}/{achievements.length} {t("desbloqueadas")}</span>}>
        {t("CONQUISTAS")}
      </SectionLabel>
      <div style={{ height: 6, borderRadius: 3, background: C.surface, overflow: "hidden", marginBottom: S.xl }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.green, borderRadius: 3 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: S.lg, columnGap: S.xs, justifyItems: "center" }}>
        {achievements.map((a) => (
          <AchievementBadge
            key={a.id}
            tier={a.tier}
            icon={a.icon}
            name={t(a.name)}
            unlocked={a.unlocked}
            selected={selected?.id === a.id}
            onClick={() => setSelectedId((id) => (id === a.id ? null : a.id))}
          />
        ))}
      </div>

      {selected && (
        <div style={{ marginTop: S.lg, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1 }}>
            {t(selected.name)}{!selected.unlocked && <span style={{ fontSize: T.meta, fontWeight: 600, color: C.text2 }}> · {t("por desbloquear")}</span>}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xxs }}>{t(selected.desc)}</div>
        </div>
      )}
    </div>
  );
}
