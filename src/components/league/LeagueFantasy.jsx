import { useState } from "react";
import { FlaskConical, Check } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf, POSITION_LABEL } from "../../lib/leagueCopy";
import { PLAYERS, teamById } from "../../lib/leagueDemo";
import { FANTASY_DEMO_RULES as F, fantasyTeamPoints, validateFantasyPicks } from "../../lib/core/league";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";

const KIND = { appearance: "Jogou", goal: "Golo", assist: "Assistência", cleanSheet: "Baliza a zero", yellow: "Amarelo", red: "Vermelho", ownGoal: "Autogolo", officialMvp: "Craque oficial" };
const ERR = {
  squad_size: "Escolhe exatamente {n} atletas.", over_budget: "Passaste o orçamento.", max_per_team: "Máximo {m} atletas da mesma equipa.", duplicate: "Atleta repetido.",
};
const POS = ["GR", "DEF", "MED", "AVA"];

/** Fantasy PREVIEW: pick 5 within a demo budget; points come from the
 *  same event log as the table (homologated matches only). The rules are
 *  FANTASY_DEMO_RULES — examples, not a regulation. No money, no prizes. */
export default function LeagueFantasy({ ctx }) {
  const { state, acc, act } = ctx;
  const saved = state.fantasy?.[acc.accountId] || [];
  const [picks, setPicks] = useState(saved);
  const [errors, setErrors] = useState([]);
  const [pos, setPos] = useState("AVA");
  const spent = picks.reduce((n, id) => n + (PLAYERS.find((p) => p.id === id)?.price || 0), 0);
  const savedPoints = fantasyTeamPoints(saved, PLAYERS, state.matches, state.logs);
  const provPoints = fantasyTeamPoints(saved, PLAYERS, state.matches, state.logs, { includeProvisional: true });
  const dirty = picks.join() !== saved.join();

  const toggle = (id) => {
    setErrors([]);
    setPicks((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= F.squadSize ? cur : [...cur, id]));
  };
  const save = () => {
    const r = act.setPicks(picks, PLAYERS);
    setErrors(r.errors || []);
  };
  const live = validateFantasyPicks(picks, PLAYERS).filter((e) => e !== "squad_size");

  return (
    <div>
      <div role="note" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", border: `1px dashed ${C.orange}88`, background: C.orangeDim, borderRadius: R.control, padding: S.md, marginBottom: S.lg }}>
        <FlaskConical size={18} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: T.meta, lineHeight: 1.55, color: C.text1 }}>
          <b>{t("Prévia do Fantasy")} · {t(LG.fantasyRules)}.</b>{" "}
          {tf("Orçamento {b} · {n} atletas · máx. {m} por equipa. Jogou +{ap}, golo GR/DEF +{gd} · MED +{gm} · AVA +{ga}, assistência +{as}, baliza a zero GR/DEF +{cs}, amarelo {y}, vermelho {r}, autogolo {og}, craque oficial +{mvp}. O voto da torcida não pontua. Sem dinheiro nem prémios. Prazos, bloqueio da escalação e ligas privadas ficam para a Fase 4.", {
            b: F.budget, n: F.squadSize, m: F.maxPerTeam, ap: F.points.appearance, gd: F.points.goal.DEF, gm: F.points.goal.MED, ga: F.points.goal.AVA,
            as: F.points.assist, cs: F.points.cleanSheet.DEF, y: F.points.yellow, r: F.points.red, og: F.points.ownGoal, mvp: F.points.officialMvp,
          })}
        </div>
      </div>

      {saved.length > 0 && (
        <>
          <SectionLabel>{t("A tua equipa guardada")}</SectionLabel>
          <div style={{ ...cardStyle, marginBottom: S.xl }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
              <span style={{ ...displayFont, fontSize: 36, color: C.accent }}>{savedPoints.total}</span>
              <span style={{ fontSize: T.meta, color: C.text2 }}>{t("pontos · jogos homologados")}</span>
              {provPoints.total !== savedPoints.total && <Chip variant="orange">{tf("{n} com provisórios", { n: provPoints.total })}</Chip>}
            </div>
            {savedPoints.rows.map((r) => (
              <details key={r.player.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, minHeight: TOUCH.min, cursor: "pointer", listStyle: "none", fontSize: T.body }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{r.player.name}</b> <span style={{ color: C.text2, fontSize: T.meta }}>{t(POSITION_LABEL[r.player.position])} · {teamById[r.player.teamId].short}</span></span>
                  <span style={{ ...displayFont, fontSize: 18, flexShrink: 0 }}>{r.total}</span>
                </summary>
                <ul style={{ margin: `0 0 ${S.sm}px`, paddingLeft: S.lg, fontSize: T.meta, color: C.text2, lineHeight: 1.7 }}>
                  {r.breakdown.length ? r.breakdown.map((b, i) => {
                    const m = state.matches.find((x) => x.id === b.matchId);
                    return <li key={i}>{t(KIND[b.kind])} {b.pts > 0 ? `+${b.pts}` : b.pts} · {teamById[m.homeId].short}–{teamById[m.awayId].short}</li>;
                  }) : <li>{t("Ainda sem pontos em jogos homologados.")}</li>}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}

      <SectionLabel right={<span style={{ fontSize: T.meta, color: spent > F.budget ? C.red : C.text2, fontWeight: 800 }}>{spent}/{F.budget} · {picks.length}/{F.squadSize}</span>}>
        {saved.length ? t("Editar equipa") : t("Escolhe 5 atletas")}
      </SectionLabel>
      <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.md }}>
        {POS.map((p) => (
          <button key={p} type="button" onClick={() => setPos(p)} aria-pressed={pos === p}
            style={{ minHeight: TOUCH.min, minWidth: 64, borderRadius: R.pill, border: `1px solid ${pos === p ? C.accent : C.border}`, background: pos === p ? C.accent : "transparent", color: pos === p ? C.bg : C.text2, fontWeight: 800, cursor: "pointer" }}>
            {t(POSITION_LABEL[p])} {picks.filter((id) => PLAYERS.find((x) => x.id === id)?.position === p).length || ""}
          </button>
        ))}
      </div>
      <div style={{ ...cardStyle, padding: 0, marginBottom: S.md }}>
        {PLAYERS.filter((p) => p.position === pos).map((p) => {
          const on = picks.includes(p.id);
          const isMe = p.id === acc.playerId;
          return (
            <button key={p.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)}
              style={{ width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, padding: `0 ${S.md}px`, background: on ? C.accentDim : "transparent", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", textAlign: "left" }}>
              <span aria-hidden style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? C.accent : C.border}`, background: on ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {on && <Check size={14} color={C.bg} strokeWidth={3} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{isMe ? ` · ${t("tu")}` : ""}</span>
                <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{teamById[p.teamId].name}</span>
              </span>
              <span style={{ fontWeight: 800, fontSize: T.body, flexShrink: 0 }}>{p.price}</span>
            </button>
          );
        })}
      </div>
      {[...new Set([...errors, ...live])].map((e) => (
        <div key={e} role="alert" style={{ color: C.red, fontSize: T.meta, marginBottom: S.xs }}>{tf(ERR[e] || e, { n: F.squadSize, m: F.maxPerTeam })}</div>
      ))}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.sm }}>
        <BtnPrimary onClick={save} disabled={!dirty || picks.length !== F.squadSize} style={{ flex: "1 1 200px" }}>{t("Guardar equipa (demo)")}</BtnPrimary>
        {dirty && <BtnGhost onClick={() => { setPicks(saved); setErrors([]); }} style={{ flex: "1 1 120px" }}>{t("Desfazer")}</BtnGhost>}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>
        {t("Atletas podem escolher-se a si próprios. Pontos recalculam-se sempre que a súmula é corrigida.")}
      </div>
    </div>
  );
}
