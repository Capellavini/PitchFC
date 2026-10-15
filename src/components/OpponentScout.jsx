import { useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { C, S, T, AVATAR_PALETTE, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { personLabel } from "../lib/rivalsResults";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";
import TeamRecordStrip from "./TeamRecordStrip";
import ListRow from "./ListRow";
import Avatar from "./Avatar";

/**
 * Scouting the opponent once the challenge is agreed (scout_opponent): their
 * record + form, and their players with position, OVR (computed from the
 * player's attributes here, never stored), appearances, goals and assists —
 * all from matches CONFIRMED on PITCH. Only nickname, position and match
 * numbers: never phone, email or full names. Collapsed by default.
 * Props: teams (useTeams), matchId, opponent ({ name }).
 */
export default function OpponentScout({ teams, matchId, opponent }) {
  const [shown, setShown] = useState(false);
  const { data, error, loading } = useRivalsRead(() => teams.scoutOpponent(matchId), [matchId, teams.revision], { enabled: shown });
  const name = opponent?.name || "";

  return (
    <>
      <SectionLabel>{t(MC.scoutTitle)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <button type="button" aria-expanded={shown} onClick={() => setShown((s) => !s)}
          style={{ width: "100%", minHeight: 44, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: S.sm, padding: 0, fontFamily: "inherit", fontSize: T.body, fontWeight: 700, textAlign: "left" }}>
          <Eye size={18} color={C.accent} aria-hidden style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>{shown ? t(MC.scoutHide) : tf(MC.scoutShow, { team: name })}</span>
          <ChevronDown size={18} color={C.text2} aria-hidden style={{ transform: shown ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
        </button>

        {shown && (
          <div style={{ marginTop: S.md }}>
            {error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red }}>{["match_not_scheduled", "scout_unavailable"].includes(error) ? t(MC.scoutUnavailable) : rivalsError(error)}</div>}
            {!data && !error && loading && <div aria-busy="true" style={{ fontSize: T.body, color: C.text2 }}>{t(MC.scoutLoading)}</div>}
            {data && (
              <>
                <TeamRecordStrip record={data.record} flat />
                <div style={{ fontSize: T.meta + 1, color: C.text2, marginBottom: S.sm }}>{t(MC.scoutSub)}</div>
                <div style={{ padding: `0 ${S.xs}px` }}>
                  {data.items.map((p, i) => (
                    <ListRow key={p.playerId} divider={i > 0}
                      leading={<Avatar name={p.name || p.nick || "?"} photo={p.photoUrl} color={AVATAR_PALETTE[i % AVATAR_PALETTE.length]} size={36} />}
                      title={personLabel(p)}
                      meta={[p.position ? t(p.position) : null, `${t(MC.scoutApps)} ${p.appearances}`, `${t(MC.goalsShort)} ${p.goals}`, `${t(MC.assistsShort)} ${p.assists}`].filter(Boolean).join(" · ")}
                      right={p.ovr != null ? (
                        <span aria-label={`${t(MC.scoutOvr)} ${p.ovr}`} style={{ textAlign: "center" }}>
                          <span style={{ ...displayFont, fontSize: T.h, color: C.text1, display: "block", lineHeight: 1 }}>{p.ovr}</span>
                          <span style={{ fontSize: T.min, color: C.text2, fontWeight: 700 }}>{t(MC.scoutOvr)}</span>
                        </span>
                      ) : <span style={{ fontSize: T.meta, color: C.text2 }}>{t(MC.scoutNoRating)}</span>} />
                  ))}
                  {!data.items.length && <div style={{ fontSize: T.body, color: C.text2 }}>{t(MC.scoutNoPlayers)}</div>}
                </div>
                <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>{t(MC.scoutPrivacy)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
