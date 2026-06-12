import { Zap, Users, Trophy, User, Flame } from "lucide-react";
import { C } from "../theme";

const NAV = [
  { id: "jogo",   Icon: Zap,    label: "Jogo"   },
  { id: "social", Icon: Flame,  label: "Social" },
  { id: "stats",  Icon: Trophy, label: "Stats"  },
  { id: "grupo",  Icon: Users,  label: "Grupo"  },
  { id: "perfil", Icon: User,   label: "Perfil" },
];

export default function BottomNav({ tab, onSelect }) {
  return (
    <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: 14, paddingTop: 10 }}>
      {NAV.map(({ id, Icon, label }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => onSelect(id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 0" }}>
            <Icon size={21} strokeWidth={active ? 2.5 : 1.5} color={active ? C.accent : C.text2} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.accent : C.text2 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
