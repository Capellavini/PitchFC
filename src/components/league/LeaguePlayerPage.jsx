import { Star } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tf, POSITION_LABEL, EVENT_LABEL } from "../../lib/leagueCopy";
import { playerById, teamById, COMPETITION } from "../../lib/leagueDemo";
import { activeEvents, countedMatches } from "../../lib/core/league";
import BackHeader from "../BackHeader";
import SectionLabel from "../SectionLabel";
import Avatar from "../Avatar";
import StatTile from "../StatTile";
import BtnGhost from "../BtnGhost";
import BtnPrimary from "../BtnPrimary";

/** Athlete page — stats for THIS competition/season only (never mixed
 *  with weekly-group games), each number traceable to a match event. */
export default function LeaguePlayerPage({ ctx, playerId }) {
  const { state, derived, acc, back, open, act } = ctx;
  const p = playerById[playerId];
  if (!p) return <div><BackHeader title={t("Atleta não encontrado")} onBack={back} /></div>;
  const s = derived.stats[playerId] || {};
  const sp = derived.statsProvisional[playerId] || {};
  const disc = derived.discipline[playerId];
  const isMe = acc.playerId === playerId;
  const follows = (state.prefs.followPlayerIds || []).includes(playerId);
  const toggle = () => act.setPrefs({ followPlayerIds: follows ? state.prefs.followPlayerIds.filter((x) => x !== playerId) : [...(state.prefs.followPlayerIds || []), playerId] });
  const trace = countedMatches(state.matches, { includeProvisional: true }).flatMap((m) =>
    activeEvents(state.logs[m.id] || []).filter((e) => e.playerId === playerId || e.assistId === playerId).map((e) => ({ m, e })));

  return (
    <div>
      <BackHeader title={p.name} subtitle={`${teamById[p.teamId].name} · ${COMPETITION.name}`} onBack={back} />
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.lg, marginBottom: S.md }}>
        <Avatar name={p.name} color={teamById[p.teamId].color} size={64} isMe={isMe} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: T.h + 2 }}>{p.name}{isMe ? ` · ${t("tu")}` : ""}</div>
          <button type="button" onClick={() => open({ kind: "team", id: p.teamId })} style={{ background: "none", border: "none", padding: 0, minHeight: 32, color: C.accent, cursor: "pointer", fontSize: T.meta, fontWeight: 700 }}>{teamById[p.teamId].name}</button>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{tf(t("Nº {n} · {pos}"), { n: p.number, pos: t(POSITION_LABEL[p.position]) })}</div>
        </div>
      </div>
      {!isMe && (follows
        ? <BtnGhost block onClick={toggle} style={{ marginBottom: S.lg }}><Star size={16} aria-hidden /> {t("A seguir")}</BtnGhost>
        : <BtnPrimary block onClick={toggle} style={{ marginBottom: S.lg }}><Star size={16} aria-hidden /> {t("Seguir atleta")}</BtnPrimary>)}

      <SectionLabel>{t("Nesta competição · homologados")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.sm }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm }}>
          <StatTile value={s.games || 0} label={t("Jogos")} />
          <StatTile value={s.goals || 0} label={t("Golos")} />
          <StatTile value={s.assists || 0} label={t("Assist.")} />
          <StatTile value={s.mvps || 0} label={t("Craque")} />
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md }}>
          🟨 {s.yellows || 0} · 🟥 {s.reds || 0}{s.ownGoals ? ` · ${t("autogolos")} ${s.ownGoals}` : ""}
          {disc?.pending > 0 && <span style={{ color: C.red, fontWeight: 700 }}> · {t("suspenso no próximo jogo oficial (demo)")}</span>}
        </div>
      </div>
      {(sp.goals !== s.goals || sp.assists !== s.assists) && (
        <div style={{ fontSize: T.meta, color: C.orange, marginBottom: S.lg }}>{tf(t("Com jogos provisórios: {g} golos · {a} assistências."), { g: sp.goals || 0, a: sp.assists || 0 })}</div>
      )}

      <SectionLabel style={{ marginTop: S.lg }}>{t("Origem dos números")}</SectionLabel>
      {trace.length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda sem golos, assistências ou cartões registados.")}</div>}
      {trace.map(({ m, e }) => (
        <button key={e.id + playerId} type="button" onClick={() => open({ kind: "match", id: m.id })}
          style={{ width: "100%", minHeight: 44, display: "flex", justifyContent: "space-between", gap: S.sm, alignItems: "center", background: "none", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", textAlign: "left", fontSize: T.body, padding: `${S.xs}px 0` }}>
          <span>{e.assistId === playerId && e.playerId !== playerId ? t("Assistência") : t(EVENT_LABEL[e.type])}{e.minute != null ? ` ${e.minute}'` : ""}</span>
          <span style={{ fontSize: T.meta, color: C.text2 }}>{teamById[m.homeId].short}–{teamById[m.awayId].short} · {m.state === "homologated" ? t("homologado") : t("provisório")}</span>
        </button>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>{t("Jogos dos grupos semanais e jogos oficiais da liga não se somam — cada competição tem as suas estatísticas.")}</div>
    </div>
  );
}
