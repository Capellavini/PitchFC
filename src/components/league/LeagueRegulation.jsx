import { BookOpen } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { DEMO_RULES, FANTASY_DEMO_RULES } from "../../lib/core/league";
import { COMPETITION, modOn } from "../../lib/leagueDemo";

/** Read-only DEMO regulation, rendered from the same centralized config
 *  the projections use (lib/core/league DEMO_RULES) — so what's written
 *  here is exactly what's computed. Not a real regulation. */
export default function LeagueRegulation() {
  const items = [
    ...(COMPETITION.placeholder ? [] : [tf(t("Formato: {f}{c}."), { f: t(COMPETITION.format), c: COMPETITION.category ? `, ${t(COMPETITION.category)}` : "" })]),
    tf(t("Pontos: vitória {w}, empate {d}, derrota {l}."), { w: DEMO_RULES.points.win, d: DEMO_RULES.points.draw, l: DEMO_RULES.points.loss }),
    t("Desempate: pontos → diferença de golos → golos marcados → confronto direto. Empate absoluto: ordem de inscrição (sorteio ainda não configurado)."),
    t("Classificação oficial só com jogos homologados pela organização. Ao vivo, encerrados e em revisão são provisórios."),
    tf(t("W.O.: {g}–0 para a equipa presente."), { g: DEMO_RULES.walkoverGoals }),
    t("Autogolo conta para a equipa beneficiada e não entra na lista de marcadores. Penáltis de desempate não contam no resultado nem nos marcadores."),
    t("Assistências só contam quando registadas na ficha de jogo (nunca automáticas)."),
    tf(t("Disciplina: {n} amarelos acumulados = 1 jogo de suspensão; vermelho direto ou 2 amarelos no mesmo jogo = {r} jogo. A suspensão cumpre-se no jogo oficial seguinte da equipa."), { n: DEMO_RULES.yellowsForSuspension, r: DEMO_RULES.redSuspensionMatches }),
    t("Contestação: o capitão contesta um resultado provisório com motivo; a organização decide e regista a decisão."),
    ...(modOn("fantasy") ? [tf(t("Fantasy (prévia): orçamento {b}, {n} atletas, máx. {m} por equipa — regras de exemplo."), { b: FANTASY_DEMO_RULES.budget, n: FANTASY_DEMO_RULES.squadSize, m: FANTASY_DEMO_RULES.maxPerTeam })] : []),
  ];
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><BookOpen size={16} aria-hidden /> {t("Regulamento · regras por defeito")}</div>
      <div style={{ fontSize: T.meta, color: C.orange, marginBottom: S.md }}>{t("Regras por defeito do PITCH. O regulamento da liga (castigos, desempates, W.O.) será configurável; por agora é só leitura.")}</div>
      <ol style={{ margin: 0, paddingLeft: S.lg, fontSize: T.body, lineHeight: 1.6, color: C.text1 }}>
        {items.map((x) => <li key={x} style={{ marginBottom: S.xs }}>{x}</li>)}
      </ol>
    </div>
  );
}
