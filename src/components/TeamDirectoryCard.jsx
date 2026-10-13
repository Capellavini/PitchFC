import { Swords } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";
import RoleBadge from "./RoleBadge";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";

/** One team in the directory: crest, name, city · format · squad size,
 *  Capitão / Vice highlighted, "Ver equipa", and "Desafiar" (armed by
 *  `onChallenge` in PR5 — disabled "em breve" until then). */
export default function TeamDirectoryCard({ team, onOpen, onChallenge }) {
  const n = team.memberCount;
  const mine = Boolean(team.myRole);
  return (
    <div style={{ ...cardStyle, marginBottom: S.md, borderLeft: mine ? `3px solid ${C.accent}` : cardStyle.border }}>
      <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
        <TeamBadge team={team} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[team.city || team.region, team.format, n === 1 ? t(RC.playersOne) : tf(RC.playersN, { n })].filter(Boolean).join(" · ")}
          </div>
        </div>
        {mine ? <Chip variant="lime">{t(RC.yourTeamBadge)}</Chip> : team.sameCity ? <Chip>{t(RC.inYourCity)}</Chip> : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: `${S.xs}px ${S.lg}px`, marginTop: S.md }}>
        {team.captain && <RoleBadge role="captain" name={team.captain.nick} />}
        {team.vice && <RoleBadge role="vice" name={team.vice.nick} />}
      </div>
      <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
        <BtnGhost onClick={onOpen} style={{ flex: 1 }}>{t(RC.seeTeam)}</BtnGhost>
        {!mine && (
          <BtnGhost onClick={onChallenge} disabled={!onChallenge} style={{ flex: 1 }} aria-label={onChallenge ? t(RC.challenge) : `${t(RC.challenge)} · ${t(RC.soon)}`}>
            <Swords size={16} /> {t(RC.challenge)}{!onChallenge && <span style={{ fontSize: T.min, color: C.text2 }}>· {t(RC.soon)}</span>}
          </BtnGhost>
        )}
      </div>
    </div>
  );
}
