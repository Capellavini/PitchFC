import { Home, Zap, Trophy, User, Flame, Building2, Swords } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";

// "Compete" folds Stats + League + Manager (Fantasy) into one icon, with
// its own sub-nav (see CompeteTab.jsx) — the bottom nav was getting
// crowded at up to 8 possible icons; this brings a regular logged-in
// user back down to 5 (Home, Jogo, Matchday, Compete, Perfil).
const NAV = [
  { id: "home",     Icon: Home,       label: "Home"     },
  { id: "jogo",     Icon: Zap,        label: "Jogo"     },
  { id: "matchday", Icon: Swords,     label: "Matchday" },
  { id: "clube",    Icon: Building2,  label: "Clube"    },
  { id: "social",   Icon: Flame,      label: "Social"   },
  { id: "compete",  Icon: Trophy,     label: "Compete"  },
  { id: "perfil",   Icon: User,       label: "Perfil"   },
];

export default function BottomNav({ tab, onSelect, showClube = false, showSocial = false }) {
  // Clube ("em breve") is hidden from regular users during testing — only
  // the admin sees it for now. Social is parked (feedback: photo/video
  // sharing won't beat dedicated apps) — code stays, just not linked.
  const items = NAV.filter((n) =>
    (n.id !== "clube" || showClube) && (n.id !== "social" || showSocial)
  );
  return (
    <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: 14, paddingTop: 10 }}>
      {items.map(({ id, Icon, label }) => {
        const active = tab === id || (id === "compete" && ["stats", "grupo", "fantasy"].includes(tab));
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
