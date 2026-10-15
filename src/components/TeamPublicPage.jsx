import { useEffect, useState } from "react";
import { Shield, Swords, MapPin } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC, RIVALS_BRAND, rivalsError, tf } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";
import TeamRecordStrip from "./TeamRecordStrip";
import TeamTopPlayers from "./TeamTopPlayers";
import BackHeader from "./BackHeader";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * Someone's team by slug (?team=<slug>, directory "Ver equipa"). Public
 * identity only — crest, name, place, format, squad size, record — never
 * the roster (team_profile, works logged out). CTA by viewer:
 *  - logged out → "Entrar no PITCH" (onEnter);
 *  - member → "Abrir a minha equipa" (onOpenMine(teamId));
 *  - anyone else signed in → "Desafiar" (PR5 hook; "em breve" until then).
 */
export default function TeamPublicPage({ teams, slug, onBack, onEnter, onOpenMine, onChallenge, standalone = false }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let live = true;
    teams.fetchPublicTeam(slug).then((r) => live && setState(r.error ? { error: r.error } : { data: r.data }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const wrap = (children) => (
    <div style={standalone ? { minHeight: "100vh", padding: `0 ${S.lg}px ${S.xl}px`, boxSizing: "border-box" } : undefined}>
      <BackHeader title={RIVALS_BRAND} onBack={onBack} />
      {children}
    </div>
  );

  if (state.loading) return wrap(<div aria-busy="true" style={{ fontSize: T.body, color: C.text2 }}>{t(RC.loading)}</div>);
  if (state.error) {
    return wrap(
      <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px` }}>
        <Shield size={28} color={C.text2} style={{ marginBottom: S.md }} />
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1 }}>{t(RC.teamNotFound)}</div>
        <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.xs, lineHeight: 1.5 }}>
          {state.error === "team_not_found" ? t(RC.teamNotFoundBody) : rivalsError(state.error)}
        </div>
        {onEnter && <BtnPrimary block onClick={onEnter} style={{ marginTop: S.lg }}>{t(RC.enterPitch)}</BtnPrimary>}
      </div>,
    );
  }

  const { team, memberCount: n, myRole, record, topScorers, topAssisters } = state.data;
  return wrap(
    <>
      <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px`, marginBottom: S.lg }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: S.md }}><TeamBadge team={team} size={88} /></div>
        <h1 style={{ ...displayFont, fontSize: T.title - 4, lineHeight: 1.1, color: C.text1, margin: 0, overflowWrap: "anywhere" }}>{team.name}</h1>
        <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.sm, display: "flex", gap: 4, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          {(team.city || team.region) && <MapPin size={13} aria-hidden />}
          {[team.city || team.region, team.format, n === 1 ? t(RC.playersOne) : tf(RC.playersN, { n })].filter(Boolean).join(" · ")}
        </div>
        {team.archived && <div role="status" style={{ marginTop: S.md, fontSize: T.meta, color: C.orange, background: C.orangeDim, borderRadius: R.control, padding: S.sm }}>{t(RC.archivedTeam)}</div>}
      </div>
      {/* The team card: record, form, streak (confirmed results only) + top scorers when signed in */}
      <TeamRecordStrip record={record} />
      <TeamTopPlayers scorers={topScorers} assisters={topAssisters} />
      {myRole ? (
        <BtnPrimary block onClick={() => onOpenMine?.(team.id)}>{t(RC.openMyTeam)}</BtnPrimary>
      ) : onEnter ? (
        <BtnPrimary block onClick={onEnter}>{t(RC.enterPitch)}</BtnPrimary>
      ) : !team.archived ? (
        <BtnGhost block onClick={onChallenge ? () => onChallenge(team) : undefined} disabled={!onChallenge}>
          <Swords size={16} /> {t(RC.challenge)}{!onChallenge && <span style={{ fontSize: T.min, color: C.text2 }}>· {t(RC.soon)}</span>}
        </BtnGhost>
      ) : null}
    </>,
  );
}
