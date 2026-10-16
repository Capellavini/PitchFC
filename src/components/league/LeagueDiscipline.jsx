import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { playerById, teamById } from "../../lib/leagueDemo";
import { DEMO_RULES } from "../../lib/core/league";

/** Disciplina (official matches, DEMO_RULES): accumulated yellows, reds,
 *  suspensions triggered / served / pending. */
export default function LeagueDiscipline({ discipline, onPlayer }) {
  const rows = Object.values(discipline).sort((a, b) => (b.pending - a.pending) || (b.reds - a.reds) || (b.yellows - a.yellows));
  return (
    <div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {tf(t("Regras demo: {n} amarelos = 1 jogo; vermelho = {r} jogo. Só jogos homologados contam; não é uma regra universal."), { n: DEMO_RULES.yellowsForSuspension, r: DEMO_RULES.redSuspensionMatches })}
      </div>
      {rows.length === 0 && <div style={{ color: C.text2 }}>{t("Sem cartões em jogos homologados.")}</div>}
      <div style={{ ...cardStyle, padding: `0 ${S.md}px` }}>
        {rows.map((d, i) => (
          <button key={d.playerId} type="button" onClick={() => onPlayer(d.playerId)}
            style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: S.sm, background: "none", border: "none", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none", color: C.text1, cursor: "pointer", textAlign: "left", padding: `${S.xs}px 0` }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerById[d.playerId]?.name}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{teamById[d.teamId]?.name} · 🟨 {d.yellows} · 🟥 {d.reds}{d.served ? ` · ${tf(t("cumpriu {n}"), { n: d.served })}` : ""}</span>
            </span>
            <span style={{ fontSize: T.meta, fontWeight: 800, color: d.pending ? C.red : C.green, flexShrink: 0 }}>{d.pending ? tf(t("Suspenso · {n} jogo"), { n: d.pending }) : t("Elegível")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
