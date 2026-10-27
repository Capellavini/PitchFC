import { Ban, ChevronRight, ClipboardList, Gavel, Vote } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { teamById, playerById, PLAYERS, captainOf, competitionById, COMPETITION, fmtKickoff } from "../../lib/leagueDemo";
import { teamHome } from "../../lib/leagueTeamHome";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import Chip from "../Chip";
import FormPills from "../FormPills";
import TeamCrest from "../TeamCrest";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueSquadGrid from "./LeagueSquadGrid";
import LeagueStateChip from "./LeagueStateChip";

// One entry per kind of duty: icon, tone (a C token) and the call to action.
const KINDS = {
  self_suspended:   { Icon: Ban,           tone: C.red,    cta: "Ver" },
  lineup:           { Icon: ClipboardList, tone: C.orange, cta: "Fazer" },
  banned_in_lineup: { Icon: Ban,           tone: C.red,    cta: "Corrigir" },
  contest:          { Icon: Gavel,         tone: C.orange, cta: "Rever" },
  vote:             { Icon: Vote,          tone: C.accent, cta: "Votar" },
};

/** "Equipa" — home of the captain and the athlete: the team's identity and
 *  form, what needs them (the captain's duties first), the next game across
 *  every competition, recent results and the squad. Nothing here writes;
 *  every card opens the screen where the action lives. */
export default function LeagueTeamHome({ ctx }) {
  const { state, derived, role, acc, lang, open, wide } = ctx;
  const team = teamById[acc.teamId];
  const home = teamHome(state, derived, { teamId: acc.teamId, playerId: acc.playerId, accountId: acc.accountId, role });
  const squad = PLAYERS.filter((p) => p.teamId === acc.teamId);
  const matchName = (m) => `${teamById[m.homeId].name} – ${teamById[m.awayId].name}`;
  const byId = Object.fromEntries(state.matches.map((m) => [m.id, m]));
  const openMatch = (id) => open({ kind: "match", id });
  const captain = role === "captain";
  const form = state.matches.filter((m) => m.state === "homologated" && (m.homeId === acc.teamId || m.awayId === acc.teamId))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff)).slice(0, 5).map((m) => {
      const s = derived.scores[m.id]; const mine = m.homeId === acc.teamId ? s.home : s.away; const their = m.homeId === acc.teamId ? s.away : s.home;
      return mine > their ? "W" : mine < their ? "L" : "D";
    });

  const describe = (it) => {
    const m = byId[it.matchId];
    switch (it.kind) {
      case "self_suspended": return { title: t("Estás suspenso no próximo jogo"), sub: matchName(m) };
      case "lineup": return { title: t("Fazer a convocatória"), sub: `${matchName(m)} · ${fmtKickoff(m.kickoff, lang)}` };
      case "banned_in_lineup": return { title: tf(t("{name} está suspenso e está na convocatória"), { name: playerById[it.playerId].nick }), sub: matchName(m) };
      case "contest": { const s = derived.scores[m.id]; return { title: t("Rever resultado provisório"), sub: `${teamById[m.homeId].name} ${s.home}–${s.away} ${teamById[m.awayId].name}` }; }
      default: return { title: t("Votar craque dos adeptos"), sub: matchName(m) };
    }
  };

  const nextMatch = home.next;
  const opponent = nextMatch ? teamById[nextMatch.homeId === acc.teamId ? nextMatch.awayId : nextMatch.homeId] : null;
  const callup = nextMatch ? (nextMatch.lineups?.[acc.teamId] || []) : [];
  const called = role === "athlete" && callup.includes(acc.playerId);

  return (
    <div>
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl }}>
        <TeamCrest initials={team.short.slice(0, 2)} color={team.color} size={56} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.15, overflowWrap: "anywhere" }}>{team.name}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>
            {t(captain ? "Capitão" : "Atleta")}{home.position >= 0 ? ` · ${tf(t("{p}º na classificação oficial"), { p: home.position + 1 })}` : ""}
          </div>
          {form.length > 0 && <div style={{ marginTop: S.sm }}><FormPills form={form} /></div>}
        </div>
      </div>

      <div style={wide ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: S.xxl, alignItems: "start" } : undefined}>
      <div>
      <SectionLabel>{home.queue.length ? tf(t("Precisa de ti · {n}"), { n: home.queue.length }) : t("Precisa de ti")}</SectionLabel>
      {home.queue.length === 0 && (
        <div style={{ ...cardStyle, color: C.text2, fontSize: T.body, marginBottom: S.lg }}>{t("Nada à espera de ti. Quando houver convocatória, resultado ou voto, aparece aqui.")}</div>
      )}
      {home.queue.map((it) => {
        const k = KINDS[it.kind];
        const d = describe(it);
        return (
          <button key={it.key} type="button" onClick={() => openMatch(it.matchId)} style={{
            width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, textAlign: "left", cursor: "pointer",
            background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${k.tone}`, borderRadius: R.card, color: C.text1,
            padding: S.md, marginBottom: S.sm, boxSizing: "border-box",
          }}>
            <k.Icon size={20} color={k.tone} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{d.title}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>{d.sub}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: T.meta, fontWeight: 800, color: k.tone, flexShrink: 0 }}>{t(k.cta)}<ChevronRight size={16} aria-hidden /></span>
          </button>
        );
      })}

      <SectionLabel style={{ marginTop: S.xl }}>{t("Próximo jogo")}</SectionLabel>
      {nextMatch ? (
        <div style={{ ...cardStyle, marginBottom: S.lg }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
            <TeamCrest initials={opponent.short.slice(0, 2)} color={opponent.color} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: T.cardTitle, fontWeight: 800, overflowWrap: "anywhere" }}>{t("vs")} {opponent.name}</div>
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{fmtKickoff(nextMatch.kickoff, lang)} · {nextMatch.venue}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
            <Chip>{t(competitionById[nextMatch.competitionId || COMPETITION.id].short)}</Chip>
            <LeagueStateChip state={nextMatch.state} />
            {captain
              ? <Chip variant={callup.length ? "green" : "orange"}>{callup.length ? tf(t("Convocatória feita · {n}"), { n: callup.length }) : t("Convocatória por fazer")}</Chip>
              : <Chip variant={called ? "green" : "neutral"}>{called ? t("Estás convocado") : t("À espera da convocatória")}</Chip>}
          </div>
          <BtnPrimary block onClick={() => openMatch(nextMatch.id)}>{captain && !callup.length ? t("Fazer convocatória") : t("Ver jogo")}</BtnPrimary>
        </div>
      ) : (
        <div style={{ ...cardStyle, color: C.text2, fontSize: T.body, marginBottom: S.lg }}>{t("Sem jogos agendados para esta equipa. O calendário da próxima jornada aparece aqui quando for publicado.")}</div>
      )}

      </div>
      <div>
      {home.recent.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: wide ? 0 : S.xl }}>{t("Resultados recentes")}</SectionLabel>
          {home.recent.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} highlightTeamId={acc.teamId} />)}
        </>
      )}

      <SectionLabel style={{ marginTop: S.xl }}>{tf(t("Plantel inscrito ({n})"), { n: squad.length })}</SectionLabel>
      <LeagueSquadGrid players={squad} suspended={home.banned} captainId={captainOf(acc.teamId)} meId={acc.playerId} onPlayer={(id) => open({ kind: "player", id })} />
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>{t(LG.demoData)}</div>
      </div>
      </div>
    </div>
  );
}
