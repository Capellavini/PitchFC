import { Ban } from "lucide-react";
import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { POSITION_LABEL } from "../../lib/leagueCopy";
import { teamById, ovrOfPlayer } from "../../lib/leagueDemo";
import Avatar from "../Avatar";
import LeagueOvrChip from "./LeagueOvrChip";

/** Squad overview: a grid of player tiles — photo or initials avatar in
 *  the team colour, nick, number · position and the OVR chip. Used on the
 *  team page and for opponent scouting in Escalações. `suspended` (Set of
 *  ids) marks players who can't play; `captainId` gets a (C). */
export default function LeagueSquadGrid({ players, onPlayer, suspended = new Set(), captainId, meId }) {
  return (
    <div role="list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: S.sm }}>
      {players.map((p) => {
        const ban = suspended.has(p.id);
        return (
          <button key={p.id} role="listitem" type="button" onClick={() => onPlayer(p.id)}
            aria-label={`${p.name} · OVR ${ovrOfPlayer(p)}${ban ? ` · ${t("Suspenso")}` : ""}`}
            style={{ minHeight: TOUCH.button + 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.xs, background: C.card, border: `1px solid ${ban ? `${C.red}66` : C.border}`, borderRadius: R.card, color: C.text1, cursor: "pointer", padding: `${S.md}px ${S.sm}px`, position: "relative", minWidth: 0 }}>
            <span style={{ position: "absolute", top: S.sm, right: S.sm }}><LeagueOvrChip ovr={ovrOfPlayer(p)} size="sm" /></span>
            <span style={{ position: "absolute", top: S.sm, left: S.sm, fontSize: T.meta, fontWeight: 800, color: C.text2 }}>{p.number}</span>
            <Avatar name={p.name} photo={p.photo} color={teamById[p.teamId].color} size={48} isMe={p.id === meId} />
            <span style={{ fontSize: T.body, fontWeight: 800, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}{p.id === captainId ? " (C)" : ""}</span>
            <span style={{ fontSize: T.meta, color: ban ? C.red : C.text2, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {ban && <Ban size={12} aria-hidden />}{ban ? t("Suspenso") : t(POSITION_LABEL[p.position])}
            </span>
          </button>
        );
      })}
    </div>
  );
}
