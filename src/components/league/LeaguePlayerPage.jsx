import { Star, GitCompare, Layers } from "lucide-react";
import { C, S, T, TOUCH, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf, plural, EVENT_LABEL } from "../../lib/leagueCopy";
import { playerById, teamById, COMPETITION, futPlayer, OTHER_CONTEXTS, ovrOfPlayer, tierOf } from "../../lib/leagueDemo";
import { activeEvents, countedMatches } from "../../lib/core/league";
import BackHeader from "../BackHeader";
import SectionLabel from "../SectionLabel";
import StatTile from "../StatTile";
import BtnGhost from "../BtnGhost";
import BtnPrimary from "../BtnPrimary";
import FutCard from "../FutCard";
import FormPills from "../FormPills";
import Chip from "../Chip";
import TeamCrest from "../TeamCrest";

/** Athlete page — the PITCH identity (FUT card with OVR/tier, photo or
 *  initials) plus stats for THIS competition only, recent form, and the
 *  athlete's other contexts listed SEPARATELY (never summed — brief §10).
 *  Every number traces back to a match event. */
export default function LeaguePlayerPage({ ctx, playerId, embedded = false }) {
  const { state, derived, acc, back, open, act } = ctx;
  const p = playerById[playerId];
  if (!p) return <div><BackHeader title={t("Atleta não encontrado")} onBack={back} /></div>;
  const team = teamById[p.teamId];
  const s = derived.stats[playerId] || {};
  const sp = derived.statsProvisional[playerId] || {};
  const disc = derived.discipline[playerId];
  const isMe = acc.playerId === playerId;
  const follows = (state.prefs.followPlayerIds || []).includes(playerId);
  const toggle = () => act.setPrefs({ followPlayerIds: follows ? state.prefs.followPlayerIds.filter((x) => x !== playerId) : [...(state.prefs.followPlayerIds || []), playerId] });
  const official = countedMatches(state.matches).filter((m) => (m.lineups?.[p.teamId] || []).includes(playerId)).sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const form = official.slice(0, 5).map((m) => {
    const sc = derived.scores[m.id]; const mine = m.homeId === p.teamId ? sc.home : sc.away; const their = m.homeId === p.teamId ? sc.away : sc.home;
    return mine > their ? "W" : mine < their ? "L" : "D";
  });
  const trace = countedMatches(state.matches, { includeProvisional: true }).flatMap((m) =>
    activeEvents(state.logs[m.id] || []).filter((e) => e.playerId === playerId || e.assistId === playerId).map((e) => ({ m, e })));
  const others = OTHER_CONTEXTS[playerId] || [];
  const ovr = ovrOfPlayer(p);
  const split = Boolean(ctx.wide); // computer: card on the left, numbers on the right

  return (
    <div>
      {!embedded && <BackHeader title={p.nick} subtitle={`${team.name} · ${COMPETITION.name}`} onBack={back} />}
      <div style={split ? { display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: S.xxl, alignItems: "start" } : undefined}>
      <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: S.md }}>
        <FutCard player={futPlayer(p)} width={236} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: S.xs, flexWrap: "wrap", marginBottom: S.md }}>
        <Chip>{tf(t("OVR {n} · {tier}"), { n: ovr, tier: t(tierOf(ovr)) })}</Chip>
        <Chip>{tf(t("Nº {n}"), { n: p.number })}</Chip>
        {isMe && <Chip variant="lime">{t("És tu")}</Chip>}
        {disc?.pending > 0 && <Chip variant="red">{t("Suspenso no próximo jogo oficial")}</Chip>}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginBottom: S.md, lineHeight: 1.5 }}>{t("Atributos de demonstração. No PITCH real, o OVR vem das avaliações dos colegas (mínimo 3).")}</div>

      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        <button type="button" onClick={() => open({ kind: "team", id: p.teamId })}
          style={{ flex: "1 1 160px", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.sm, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text1, cursor: "pointer", padding: `0 ${S.md}px`, fontWeight: 700, fontSize: T.body }}>
          <TeamCrest initials={team.short.slice(0, 2)} color={team.color} size={22} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
        </button>
        {!isMe && (follows
          ? <BtnGhost onClick={toggle} style={{ flex: "1 1 140px" }}><Star size={16} aria-hidden /> {t("A seguir")}</BtnGhost>
          : <BtnPrimary onClick={toggle} style={{ flex: "1 1 140px" }}><Star size={16} aria-hidden /> {t("Seguir atleta")}</BtnPrimary>)}
      </div>

      </div>
      <div>
      <SectionLabel>{t("Nesta competição · homologados")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.sm }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm }}>
          <StatTile value={s.games || 0} label={t("Jogos")} />
          <StatTile value={s.goals || 0} label={t("Golos")} />
          <StatTile value={s.assists || 0} label={t("Assist.")} />
          <StatTile value={s.mvps || 0} label={t("Craque")} />
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md }}>
          🟨 {s.yellows || 0} · 🟥 {s.reds || 0}{s.ownGoals ? ` · ${plural(s.ownGoals, "autogolo", "autogolos")}` : ""}
        </div>
        <div style={{ fontSize: T.min, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, margin: `${S.md}px 0 ${S.xs}px` }}>{t("Forma recente")}</div>
        <FormPills form={form} />
      </div>
      {(sp.goals !== s.goals || sp.assists !== s.assists) && (
        <div style={{ fontSize: T.meta, color: C.orange, marginBottom: S.lg }}>{tf(t("Com jogos provisórios: {g} · {a}."), { g: plural(sp.goals || 0, "golo", "golos"), a: plural(sp.assists || 0, "assistência", "assistências") })}</div>
      )}

      <SectionLabel style={{ marginTop: S.lg }}>{t("Noutros contextos · não somados")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        {others.length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Sem outros contextos públicos neste PITCH.")}</div>}
        {others.map((o, i) => (
          <div key={o.label} style={{ display: "flex", gap: S.sm, alignItems: "flex-start", padding: `${S.sm}px 0`, borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <Layers size={16} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: T.body, fontWeight: 700 }}>{o.label}</div>
              <div style={{ fontSize: T.meta, color: C.text2 }}>{o.season} · {plural(o.games, "jogo", "jogos")} · {plural(o.goals, "golo", "golos")} · {plural(o.assists, "assistência", "assistências")}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.5 }}>{t("Grupos semanais, amigáveis e competições têm estatísticas próprias — nunca se misturam com as desta liga.")}</div>
      </div>

      <BtnGhost block onClick={() => open({ kind: "compare" })} style={{ marginBottom: S.xl }}><GitCompare size={16} aria-hidden /> {t("Comparar atletas")}</BtnGhost>

      <SectionLabel>{t("Origem dos números")}</SectionLabel>
      {trace.length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda sem golos, assistências ou cartões registados.")}</div>}
      {trace.map(({ m, e }) => (
        <button key={e.id + playerId} type="button" onClick={() => open({ kind: "match", id: m.id })}
          style={{ width: "100%", minHeight: 44, display: "flex", justifyContent: "space-between", gap: S.sm, alignItems: "center", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", textAlign: "left", fontSize: T.body, padding: `${S.xs}px 0` }}>
          <span>{e.assistId === playerId && e.playerId !== playerId ? t("Assistência") : t(EVENT_LABEL[e.type])}{e.minute != null ? ` ${e.minute}'` : ""}</span>
          <span style={{ fontSize: T.meta, color: C.text2 }}>{teamById[m.homeId].short}–{teamById[m.awayId].short} · {m.state === "homologated" ? t("homologado") : t("provisório")}</span>
        </button>
      ))}
      </div>
      </div>
    </div>
  );
}
