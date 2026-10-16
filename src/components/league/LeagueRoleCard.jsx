import { ClipboardCheck, Vote } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { teamById, playerById } from "../../lib/leagueDemo";
import { fanVoteOpen } from "../../lib/core/league";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** What this demo role can do right now — the next step for each role. */
export default function LeagueRoleCard({ ctx }) {
  const { state, derived, role, acc, open } = ctx;
  const card = { ...cardStyle, marginBottom: S.xl, borderLeft: `3px solid ${C.accent}` };
  if (role === "manager") {
    const pend = state.matches.filter((m) => m.state === "ended_provisional" || m.state === "in_review").length;
    return (
      <div style={card}>
        <div style={{ display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.md }}>
          <ClipboardCheck size={20} color={C.accent} aria-hidden style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{pend ? tf(t("{n} súmulas à espera de validação"), { n: pend }) : t("Sem súmulas pendentes")}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t("A gestão fica em “Gerir liga”, fora da navegação dos atletas.")}</div>
          </div>
        </div>
        <BtnPrimary block onClick={() => open({ kind: "manage", section: "overview" })}>{t(LG.manage)}</BtnPrimary>
      </div>
    );
  }
  const voteMatch = state.matches.filter(fanVoteOpen).sort((a, b) => b.kickoff.localeCompare(a.kickoff))[0];
  const myVote = voteMatch ? state.fanVotes?.[voteMatch.id]?.[acc.accountId] : null;
  if (role === "athlete" || role === "captain") {
    const me = playerById[acc.playerId];
    const s = derived.stats[acc.playerId] || {};
    const contestable = role === "captain" ? state.matches.find((m) => m.state === "ended_provisional" && (m.homeId === acc.teamId || m.awayId === acc.teamId)) : null;
    const nextMine = state.matches.filter((m) => m.state === "scheduled" && (m.homeId === acc.teamId || m.awayId === acc.teamId)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
    const callupDone = nextMine && (nextMine.lineups?.[acc.teamId] || []).length > 0;
    return (
      <div style={card}>
        <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t(role === "captain" ? "Capitão" : "Atleta")} · {teamById[acc.teamId].name}</div>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, margin: `${S.xs}px 0 ${S.sm}px` }}>{me.name}</div>
        <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md }}>
          {tf(t("{g} golos · {a} assistências · {j} jogos (homologados)"), { g: s.goals || 0, a: s.assists || 0, j: s.games || 0 })}
        </div>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          {role === "captain" && nextMine && (
            <BtnPrimary onClick={() => open({ kind: "match", id: nextMine.id })} style={{ flex: "1 1 180px" }}>{callupDone ? t("Rever convocatória") : t("Fazer convocatória")}</BtnPrimary>
          )}
          {contestable && <BtnGhost tone="accent" onClick={() => open({ kind: "match", id: contestable.id })} style={{ flex: "1 1 180px" }}>{t("Rever resultado provisório")}</BtnGhost>}
          {role === "athlete" && <BtnPrimary onClick={() => open({ kind: "player", id: acc.playerId })} style={{ flex: "1 1 180px" }}>{t("As minhas estatísticas")}</BtnPrimary>}
          {voteMatch && <BtnGhost onClick={() => open({ kind: "match", id: voteMatch.id })} style={{ flex: "1 1 180px" }}><Vote size={16} aria-hidden /> {myVote ? t("Mudar voto") : t("Votar craque da torcida")}</BtnGhost>}
        </div>
      </div>
    );
  }
  // fan
  return (
    <div style={card}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800, marginBottom: S.xs }}>{tf(t("Segues {team}"), { team: teamById[state.prefs.supportTeamId]?.name || "—" })}</div>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>{t("Acompanhar não exige criar organização nem equipa. Muda a equipa seguida em Mais → Preferências.")}</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        {voteMatch && <BtnPrimary onClick={() => open({ kind: "match", id: voteMatch.id })} style={{ flex: "1 1 180px" }}>{myVote ? t("Mudar voto") : t("Votar craque da torcida")}</BtnPrimary>}
        <BtnGhost onClick={() => ctx.goTab("fantasy")} style={{ flex: "1 1 180px" }}>{t("Montar Fantasy")}</BtnGhost>
      </div>
    </div>
  );
}
