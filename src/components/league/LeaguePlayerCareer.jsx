import { C, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { athleteCareer } from "../../lib/leagueCareer";
import SectionLabel from "./visual/SectionLabel";

const th = { textAlign: "right", padding: "4px 6px", fontSize: T.min, color: C.text2, fontWeight: 800 };
const td = { textAlign: "right", padding: "6px", fontSize: T.meta, fontVariantNumeric: "tabular-nums" };

/** Season by season: games, goals, assists and cards, from the closed seasons' archive plus the season in progress.
 *  Hidden until the athlete has at least one season behind them. */
export default function LeaguePlayerCareer({ state, playerId }) {
  const { rows, totals } = athleteCareer(state, playerId);
  if (!rows.some((r) => !r.current)) return null;
  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Carreira")}</SectionLabel>
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{t("Época")}</th><th style={{ ...th, textAlign: "left" }}>{t("Equipa")}</th><th style={th}>{t("Jogos")}</th><th style={th}>{t("Golos")}</th><th style={th}>{t("Assist.")}</th><th style={th}>🟨</th><th style={th}>🟥</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seasonId} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>{r.label}{r.current ? ` · ${t("em curso")}` : ""}</td>
                <td style={{ ...td, textAlign: "left", overflowWrap: "anywhere" }}>{r.teamName}</td>
                <td style={td}>{r.games}</td><td style={td}>{r.goals}</td><td style={td}>{r.assists}</td><td style={td}>{r.yellows}</td><td style={td}>{r.reds}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${C.border}` }}>
              <td style={{ ...td, textAlign: "left", fontWeight: 900 }} colSpan={2}>{t("Total")}</td>
              <td style={{ ...td, fontWeight: 800 }}>{totals.games}</td><td style={{ ...td, fontWeight: 800 }}>{totals.goals}</td><td style={{ ...td, fontWeight: 800 }}>{totals.assists}</td><td style={td}>{totals.yellows}</td><td style={td}>{totals.reds}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
