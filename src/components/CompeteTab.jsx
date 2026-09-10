import { useState } from "react";
import { C } from "../theme";
import { t } from "../lib/i18n";
import StatsTab from "./StatsTab";
import GrupoTab from "./GrupoTab";
import FantasyTab from "./FantasyTab";
import NoGroupState from "./NoGroupState";

const SUBS = [
  { id: "stats", label: "Stats" },
  { id: "league", label: "League" },
  { id: "manager", label: "Manager" },
];

/** Consolidates Stats + League (grupo/plantel) + Manager (Pitch Manager
 *  fantasy) under one tab — same three screens, unchanged, just under a
 *  shared sub-nav instead of three separate bottom-nav icons. Cuts the
 *  nav from 6 icons to 4 for a regular logged-in user (Home, Jogo,
 *  Matchday, Compete, Perfil), which was the actual point: the bottom
 *  nav was getting crowded, not that these three screens needed to
 *  change. `showManager` hides the Manager sub-tab the same way the old
 *  bottom-nav icon was hidden (cloud.canSeeFantasy). */
export default function CompeteTab({ showManager, noGroup, onJoinGroup, statsProps, leagueProps, managerProps }) {
  const [sub, setSub] = useState("stats");
  const subs = SUBS.filter((s) => s.id !== "manager" || showManager);
  const active = subs.some((s) => s.id === sub) ? sub : "stats";

  return (
    <div>
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {subs.map((s) => {
            const isActive = active === s.id;
            return (
              <button key={s.id} onClick={() => setSub(s.id)}
                style={{ flex: 1, background: isActive ? C.accentDim : C.surface, color: isActive ? C.accent : C.text2, border: `1px solid ${isActive ? C.accentBorder : C.border}`, borderRadius: 10, padding: "9px 8px", fontSize: 12.5, fontWeight: isActive ? 800 : 600, cursor: "pointer" }}>
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </div>
      {active === "stats" && <StatsTab {...statsProps} />}
      {active === "league" && (noGroup ? <NoGroupState onJoinGroup={onJoinGroup} /> : <GrupoTab {...leagueProps} />)}
      {active === "manager" && showManager && <FantasyTab {...managerProps} />}
    </div>
  );
}
