import { Zap, Users, Trophy, User, Flame, Building2, Crown } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";

const NAV = [
  { id: "jogo",    Icon: Zap,       label: "Jogo"    },
  { id: "clube",   Icon: Building2, label: "Clube"   },
  { id: "social",  Icon: Flame,     label: "Social"  },
  { id: "stats",   Icon: Trophy,    label: "Stats"   },
  { id: "grupo",   Icon: Users,     label: "Grupo"   },
  { id: "fantasy", Icon: Crown,     label: "Fantasy" },
  { id: "perfil",  Icon: User,      label: "Perfil"  },
];

export default function BottomNav({ tab, onSelect, showClube = false, showFantasy = false }) {
  // Clube ("em breve") and Fantasy (admin-only beta) are hidden from
  // regular users during testing — only the admin sees them for now.
  const items = NAV.filter((n) => (n.id !== "clube" || showClube) && (n.id !== "fantasy" || showFantasy));
  return (
    <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: 14, paddingTop: 10 }}>
      {items.map(({ id, Icon, label }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => onSelect(id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 0" }}>
            <Icon size={21} strokeWidth={active ? 2.5 : 1.5} color={active ? C.accent : C.text2} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.accent : C.text2 }}>{t(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
