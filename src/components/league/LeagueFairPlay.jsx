import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { PLAYERS, TEAMS, teamById } from "../../lib/leagueDemo";
import { fairPlayTable } from "../../lib/leagueFairPlay";
import SectionLabel from "../SectionLabel";
import TeamCrest from "../TeamCrest";

const cell = { padding: `${S.sm}px ${S.xs}px`, textAlign: "right", fontVariantNumeric: "tabular-nums" };

/** Taça Fair Play (module "fairplay"): amarelos × 1 + vermelhos × 3 per team,
 *  from the cards of the homologated matches. Lower is better. The board
 *  decides — sanctions are the Conselho de Disciplina's, this is the count. */
export default function LeagueFairPlay({ ctx, competition }) {
  const { derived, open } = ctx;
  const ids = competition.teamIds?.length ? competition.teamIds : TEAMS.map((x) => x.id);
  const rows = fairPlayTable(ids, PLAYERS, derived.stats);
  return (
    <section style={{ marginTop: S.xl }}>
      <SectionLabel>{t("Taça Fair Play")}</SectionLabel>
      <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.body }}>
          <thead>
            <tr style={{ color: C.text2, fontSize: T.meta }}>
              <th scope="col" style={{ ...cell, textAlign: "left", paddingLeft: S.md, width: 36 }}>P</th>
              <th scope="col" style={{ ...cell, textAlign: "left" }}>{t("Equipa")}</th>
              <th scope="col" style={cell} aria-label={t("Amarelos")}>A</th>
              <th scope="col" style={cell} aria-label={t("Vermelhos")}>V</th>
              <th scope="col" style={{ ...cell, paddingRight: S.md }}>{t("Total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tm = teamById[r.teamId];
              return (
                <tr key={r.teamId} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...cell, textAlign: "left", paddingLeft: S.md, fontWeight: 800 }}>{i + 1}</td>
                  <td style={{ ...cell, textAlign: "left" }}>
                    <button type="button" onClick={() => open({ kind: "team", id: r.teamId })} style={{ display: "inline-flex", alignItems: "center", gap: S.sm, background: "none", border: "none", color: C.text1, cursor: "pointer", fontSize: T.body, fontWeight: 700, padding: 0, minHeight: 32 }}>
                      <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={22} /> {tm.name}
                    </button>
                  </td>
                  <td style={cell}>{r.yellows}</td>
                  <td style={cell}>{r.reds}</td>
                  <td style={{ ...cell, paddingRight: S.md, fontWeight: 800 }}>{r.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
        {t("Amarelos × 1 + vermelhos × 3, só jogos homologados. Quem tem menos pontos fica à frente. As sanções são decisões do Conselho de Disciplina: o PITCH calcula, a direção decide.")}
      </div>
    </section>
  );
}
