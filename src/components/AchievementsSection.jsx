import { useState } from "react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { computeAchievements } from "../lib/achievements";
import SectionLabel from "./SectionLabel";
import AchievementBadge from "./AchievementBadge";

export default function AchievementsSection({ player, ctx }) {
  const [selectedId, setSelectedId] = useState(null);
  const achievements = computeAchievements(player, ctx);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const selected = achievements.find((a) => a.id === selectedId);

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <SectionLabel style={{ marginBottom: 0 }}>{t("CONQUISTAS")}</SectionLabel>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>
          {unlockedCount}/{achievements.length} {t("desbloqueadas")}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 16, columnGap: 4, justifyItems: "center" }}>
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
        <div style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: selected.unlocked ? C.text1 : C.text2 }}>{t(selected.name)}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{t(selected.desc)}</div>
        </div>
      )}
    </div>
  );
}
