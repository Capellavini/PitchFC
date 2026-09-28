import { Home, Zap, Trophy, User, Swords } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";

// Phase-1 information architecture (decisões 2026-09-28): always exactly
// 5 slots — Home · Jogar · Matchday · Competir · Perfil — with Matchday
// as the emphasized CENTER button. Social lives inside Home now, the
// old "Clube" tab moved behind Perfil → Definições (admin only), and
// Stats/League moved to Jogar → Grupos.
const NAV = [
  { id: "home",     Icon: Home,   label: "Home"     },
  { id: "jogar",    Icon: Zap,    label: "Jogar"    },
  { id: "matchday", Icon: Swords, label: "Matchday", center: true },
  { id: "competir", Icon: Trophy, label: "Competir" },
  { id: "perfil",   Icon: User,   label: "Perfil"   },
];

/** `matchdayHot`: there's a game today / a live matchday, or an open
 *  game the player still hasn't answered — the center button turns
 *  solid lime and pulses. Otherwise it's a muted ("cold") circle, still
 *  tappable. */
export default function BottomNav({ tab, onSelect, matchdayHot = false }) {
  // Keyframes need a real stylesheet; built from C at render time so the
  // pulse colour follows the active theme (never a hardcoded hex).
  const pulseCss = `@keyframes pitchMdPulse{0%{box-shadow:0 0 0 0 ${C.accentBorder}}70%{box-shadow:0 0 0 12px rgba(0,0,0,0)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}`;

  return (
    <nav style={{ position: "sticky", bottom: 0, zIndex: 20, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "flex-end", padding: "6px 8px calc(10px + env(safe-area-inset-bottom))" }}>
      <style>{pulseCss}</style>
      {NAV.map(({ id, Icon, label, center }) => {
        const active = tab === id;
        if (center) {
          const hot = matchdayHot;
          const circleBg = hot ? C.accent : active ? C.accentDim : C.card;
          const circleBorder = hot ? C.accent : active ? C.accentBorder : C.border;
          const iconColor = hot ? C.bg : active ? C.accent : C.text2;
          return (
            <button key={id} onClick={() => onSelect(id)} aria-label={t(label)}
              style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0, minHeight: 44 }}>
              <span style={{
                position: "relative", width: 52, height: 52, borderRadius: 26, marginTop: -22,
                background: circleBg, border: `1px solid ${circleBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: hot ? "pitchMdPulse 1.8s ease-out infinite" : "none",
              }}>
                <Icon size={23} strokeWidth={hot || active ? 2.5 : 1.75} color={iconColor} />
                {hot && !active && (
                  <span style={{ position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5, background: C.red, border: `2px solid ${C.surface}` }} />
                )}
              </span>
              <span style={{ fontSize: 10, fontWeight: active || hot ? 800 : 500, color: active || hot ? C.accent : C.text2 }}>{t(label)}</span>
            </button>
          );
        }
        return (
          <button key={id} onClick={() => onSelect(id)}
            style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, padding: "6px 0 0", minHeight: 44 }}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.6} color={active ? C.accent : C.text2} />
            <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? C.accent : C.text2 }}>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
