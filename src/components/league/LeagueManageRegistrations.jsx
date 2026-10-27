import { C, S, T, TOUCH, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf, POSITION_LABEL } from "../../lib/leagueCopy";
import { TEAMS, PLAYERS, COMPETITION, captainOf } from "../../lib/leagueDemo";
import Chip from "../Chip";
import TeamCrest from "../TeamCrest";

/** Inscrições: registered teams + the squad snapshot inscribed in this
 *  competition (read-only in Fase 1). */
export default function LeagueManageRegistrations({ ctx }) {
  return (
    <div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {tf(t("{n} equipas inscritas em {c}. A equipa é a mesma identidade de época para época — só o plantel inscrito é por época."), { n: TEAMS.length, c: COMPETITION.name })}
      </div>
      {TEAMS.map((tm) => {
        const squad = PLAYERS.filter((p) => p.teamId === tm.id);
        return (
          <details key={tm.id} style={{ ...cardStyle, marginBottom: S.sm, padding: `0 ${S.md}px` }}>
            <summary style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.button + 4, cursor: "pointer", listStyle: "none" }}>
              <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={26} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{tm.name}</span>
                <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{tf(t("{n} atletas · capitão {c}"), { n: squad.length, c: PLAYERS.find((p) => p.id === captainOf(tm.id)).name })}</span>
              </span>
              <Chip variant="green">{t("Inscrita")}</Chip>
            </summary>
            <ol style={{ margin: `0 0 ${S.md}px`, paddingLeft: S.lg, fontSize: T.meta, lineHeight: 1.8, color: C.text1 }}>
              {squad.map((p) => <li key={p.id}>{p.number} · {p.name} · {t(POSITION_LABEL[p.position])}</li>)}
            </ol>
          </details>
        );
      })}
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md }}>{t("Abrir/fechar inscrições, prazos e validação de documentos chegam na Fase 2.")}</div>
    </div>
  );
}
