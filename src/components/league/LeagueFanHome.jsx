import { Gamepad2, Megaphone, Radio, Star, Target, Vote } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById, playerById, TEAMS, fmtKickoff, fmtDateTime, competitionById, COMPETITION } from "../../lib/leagueDemo";
import { fanHome } from "../../lib/leagueFanHome";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import FormPills from "../FormPills";
import TeamCrest from "../TeamCrest";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueStateChip from "./LeagueStateChip";
import LeagueHighlight from "./LeagueHighlight";

/** Início do adepto: a team to follow, a game on right now, the vote, the
 *  round, highlights, Fantasy and the league's notices. Following needs no
 *  organisation and no team — one tap to follow anyone. Two columns on a
 *  computer. */
export default function LeagueFanHome({ ctx }) {
  const { state, derived, acc, lang, open, act, goTab, wide } = ctx;
  const h = fanHome(state, derived, { accountId: acc.accountId });
  const team = teamById[h.supportId];
  const openMatch = (id) => open({ kind: "match", id });
  const opponent = h.next && team ? teamById[h.next.homeId === team.id ? h.next.awayId : h.next.homeId] : null;
  const more = TEAMS.filter((tm) => !h.followIds.includes(tm.id));
  const matchName = (m) => `${teamById[m.homeId].name} – ${teamById[m.awayId].name}`;

  const hero = team ? (
    <div style={{ ...cardStyle, marginBottom: S.xl, borderLeft: `3px solid ${team.color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
        <TeamCrest initials={team.short.slice(0, 2)} color={team.color} size={56} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("A tua equipa")}</div>
          <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.15, overflowWrap: "anywhere" }}>{team.name}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{h.position >= 0 ? tf(t("{p}º na classificação oficial"), { p: h.position + 1 }) : ""}</div>
        </div>
      </div>
      {h.form.length > 0 && <div style={{ marginBottom: S.md }}><FormPills form={h.form} /></div>}
      {h.next && opponent ? (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.xs }}>{t("Próximo jogo")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.xs }}>
            <TeamCrest initials={opponent.short.slice(0, 2)} color={opponent.color} size={28} />
            <span style={{ fontSize: T.cardTitle, fontWeight: 800, overflowWrap: "anywhere" }}>{t("vs")} {opponent.name}</span>
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>{fmtKickoff(h.next.kickoff, lang)} · {h.next.venue}</div>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
            <Chip>{t(competitionById[h.next.competitionId || COMPETITION.id].short)}</Chip>
            <LeagueStateChip state={h.next.state} />
          </div>
          <BtnPrimary block onClick={() => openMatch(h.next.id)}>{t("Ver jogo")}</BtnPrimary>
        </>
      ) : (
        <div style={{ fontSize: T.body, color: C.text2 }}>{t("Sem jogos agendados para esta equipa. O calendário da próxima jornada aparece aqui quando for publicado.")}</div>
      )}
      <BtnGhost block onClick={() => open({ kind: "team", id: team.id })} style={{ marginTop: S.sm }}>{t("Ver a equipa")}</BtnGhost>
    </div>
  ) : (
    <div style={{ ...cardStyle, marginBottom: S.xl }}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800, marginBottom: S.xs }}>{t("Escolhe a tua equipa")}</div>
      <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Acompanhar não exige criar organização nem equipa. Segue uma equipa e o próximo jogo aparece aqui.")}</div>
    </div>
  );

  const live = h.live.length > 0 && (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("A decorrer agora")}</SectionLabel>
      {h.live.map((m) => {
        const s = derived.scores[m.id];
        return (
          <button key={m.id} type="button" onClick={() => openMatch(m.id)} style={{
            width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, textAlign: "left", cursor: "pointer",
            background: C.card, border: `1px solid ${C.accentBorder}`, borderRadius: R.card, color: C.text1, padding: S.md, marginBottom: S.sm, boxSizing: "border-box",
          }}>
            <Radio size={20} color={C.accent} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1, fontSize: T.body, fontWeight: 800, overflowWrap: "anywhere" }}>{matchName(m)}</span>
            <span style={{ ...displayFont, fontSize: 20, flexShrink: 0 }}>{s.home}–{s.away}</span>
          </button>
        );
      })}
    </div>
  );

  const vote = h.voteMatch && (
    <div style={{ ...cardStyle, marginBottom: S.xl, display: "flex", alignItems: "center", gap: S.md }}>
      <Vote size={22} color={C.accent} aria-hidden style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: T.body, fontWeight: 800 }}>{h.myVote ? t("Já votaste no craque") : t("Vota no craque dos adeptos")}</div>
        <div style={{ fontSize: T.meta, color: C.text2, overflowWrap: "anywhere" }}>{matchName(h.voteMatch)}</div>
      </div>
      <BtnGhost tone={h.myVote ? undefined : "accent"} onClick={() => openMatch(h.voteMatch.id)}>{h.myVote ? t("Mudar voto") : t("Votar")}</BtnGhost>
    </div>
  );

  const round = (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{tf(t("Jornada {n}"), { n: h.round })} · {t("jornada atual")}</SectionLabel>
      {h.roundMatches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} highlightTeamId={h.supportId} />)}
    </div>
  );

  const highlights = (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Destaques")}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: S.sm }}>
        <LeagueHighlight Icon={Target} title={t("Melhor marcador")} sub={t("jogos homologados")}
          value={h.topScorer ? `${playerById[h.topScorer.player.id].name} · ${h.topScorer.value}` : "—"}
          onClick={h.topScorer ? () => open({ kind: "player", id: h.topScorer.player.id }) : null} />
        <LeagueHighlight Icon={Star} title={t("Craque oficial")} sub={h.lastMvpMatch ? `${teamById[h.lastMvpMatch.homeId].short}–${teamById[h.lastMvpMatch.awayId].short}` : ""}
          value={h.lastMvpMatch ? playerById[h.lastMvpMatch.officialMvp.playerId].name : "—"}
          onClick={h.lastMvpMatch ? () => openMatch(h.lastMvpMatch.id) : null} />
      </div>
    </div>
  );

  const fantasy = (
    <div style={{ ...cardStyle, marginBottom: S.xl, display: "flex", alignItems: "center", gap: S.md }}>
      <Gamepad2 size={22} color={C.accent} aria-hidden style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: T.body, fontWeight: 800 }}>{t("Fantasy da liga")}</div>
        <div style={{ fontSize: T.meta, color: C.text2 }}>{h.fantasy.picked ? tf(t("A tua equipa tem {n} pontos"), { n: h.fantasy.points }) : t("Escolhe 5 atletas e soma pontos com os jogos oficiais.")}</div>
      </div>
      <BtnGhost tone="accent" onClick={() => goTab("fantasy")}>{h.fantasy.picked ? t("Ver") : t("Montar")}</BtnGhost>
    </div>
  );

  const notices = state.announcements.length > 0 && (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Comunicados")}</SectionLabel>
      {state.announcements.map((a) => (
        <div key={a.id} style={{ ...cardStyle, display: "flex", gap: S.md, marginBottom: S.sm }}>
          <Megaphone size={18} color={C.accent} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: T.body, fontWeight: 800 }}>{a.title}</div>
            <div style={{ fontSize: T.meta, color: C.text2, margin: "2px 0 6px" }}>{fmtDateTime(a.at, lang)} · {t("Organização da liga")}</div>
            <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{a.body}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const follow = more.length > 0 && (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Segue mais equipas")}</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.xs }}>
        {more.map((tm) => (
          <button key={tm.id} type="button" onClick={() => act.setPrefs({ followTeamIds: [...h.followIds, tm.id] })} style={{ minHeight: TOUCH.min, display: "inline-flex", alignItems: "center", gap: S.xs, padding: `0 ${S.md}px`, borderRadius: R.pill, border: `1px solid ${C.border}`, background: "transparent", color: C.text1, cursor: "pointer", fontSize: T.meta, fontWeight: 700 }}>
            <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={18} /> {tm.name}
          </button>
        ))}
      </div>
    </div>
  );

  return wide ? (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: S.xxl, alignItems: "start" }}>
      <div>{hero}{live}{vote}{round}</div>
      <div>{highlights}{fantasy}{notices}{follow}</div>
    </div>
  ) : (
    <div>{hero}{live}{vote}{round}{highlights}{fantasy}{notices}{follow}</div>
  );
}
