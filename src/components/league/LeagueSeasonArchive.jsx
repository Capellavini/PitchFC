import { Trophy } from "lucide-react";
import { C as APP_C, R, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";

const th = { textAlign: "right", padding: "4px 6px", fontSize: T.min, color: APP_C.text2, fontWeight: 800 };
const td = { textAlign: "right", padding: "6px", fontSize: T.meta, fontVariantNumeric: "tabular-nums" };

/** Closed seasons, read-only: who won each competition, the final table or the cup's path, and the top scorers.
 *  Used by the Gestor (Gerir > Época) and by the league's public page, from the same archive. A champion named by
 *  hand shows its reason: that is what people will ask about. */
export default function LeagueSeasonArchive({ seasons = [], ink = APP_C.accent, palette = null }) {
  const C = palette || APP_C;
  if (!seasons.length) return null;
  const list = seasons.slice().sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
  return (
    <div className="pl-season-archive" style={{ display: "grid", gap: S.md }}>
      {list.map((s, i) => {
        const teams = Object.fromEntries((s.teams || []).map((x) => [x.id, x]));
        const nm = (id) => teams[id]?.name || "—";
        return (
          <section key={s.id} style={{ ...cardStyle, background: C.card, color: C.text1, borderColor: C.border, padding: S.lg }} aria-label={`${t("Época")} ${s.label}`}>
            <h3 style={{ margin: `0 0 ${S.md}px`, fontSize: T.cardTitle }}>{t("Época")} {s.label}</h3>
            <div style={{ display: "grid", gap: S.sm }}>
              {(s.competitions || []).map((c) => (
                <details key={c.id} open={i === 0 && (s.competitions || []).length === 1} style={{ border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px` }}>
                  <summary style={{ minHeight: 48, display: "flex", alignItems: "center", gap: S.sm, cursor: "pointer", listStyle: "none" }}>
                    <Trophy size={18} color={ink} aria-hidden style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{c.name}</span>
                      <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{c.champion ? c.champion.name : t("Sem campeão registado")}</span>
                    </span>
                  </summary>
                  <div style={{ paddingBottom: S.md }}>
                    {c.champion?.decidedBy === "manual" && c.champion.note && (
                      <p style={{ margin: `0 0 ${S.md}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Decisão da direção")}: {c.champion.note}</p>
                    )}
                    {c.table && (
                      <div style={{ overflowX: "auto", marginBottom: S.md }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr><th style={{ ...th, textAlign: "left" }}>#</th><th style={{ ...th, textAlign: "left" }}>{t("Equipa")}</th><th style={th}>J</th><th style={th}>V</th><th style={th}>E</th><th style={th}>D</th><th style={th}>DG</th><th style={th}>Pts</th></tr></thead>
                          <tbody>
                            {c.table.map((r) => (
                              <tr key={r.teamId} style={{ borderTop: `1px solid ${C.border}` }}>
                                <td style={{ ...td, textAlign: "left", fontWeight: 800 }}>{r.pos}</td>
                                <td style={{ ...td, textAlign: "left", fontWeight: r.pos === 1 ? 800 : 500, overflowWrap: "anywhere" }}>{nm(r.teamId)}</td>
                                <td style={td}>{r.j}</td><td style={td}>{r.w}</td><td style={td}>{r.d}</td><td style={td}>{r.l}</td><td style={td}>{r.gd}</td>
                                <td style={{ ...td, fontWeight: 800 }}>{r.pts}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {c.bracket && (
                      <div style={{ display: "grid", gap: S.sm, marginBottom: S.md }}>
                        {c.bracket.map((p) => (
                          <div key={p.round}>
                            <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text2, marginBottom: 2 }}>{p.name ? t(p.name) : tf(t("Fase {n}"), { n: p.round })}</div>
                            {p.ties.map((x) => (
                              <div key={x.matchId} style={{ fontSize: T.meta, padding: "3px 0", overflowWrap: "anywhere" }}>
                                <span style={{ fontWeight: x.winnerId === x.homeId ? 800 : 500 }}>{nm(x.homeId)}</span>{` ${x.home}–${x.away} `}<span style={{ fontWeight: x.winnerId === x.awayId ? 800 : 500 }}>{nm(x.awayId)}</span>
                                {x.shootout ? <span style={{ color: C.text2 }}>{` (${t("pen.")} ${x.shootout.home}–${x.shootout.away})`}</span> : null}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {c.scorers?.length > 0 && (
                      <div>
                        <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text2, marginBottom: 2 }}>{t("Artilheiros")}</div>
                        {c.scorers.slice(0, 10).map((p, k) => (
                          <div key={p.playerId} style={{ display: "flex", gap: S.sm, fontSize: T.meta, padding: "3px 0" }}>
                            <span style={{ width: 20, color: C.text2 }}>{k + 1}.</span>
                            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{p.name} <span style={{ color: C.text2 }}>· {nm(p.teamId)}</span></span>
                            <span style={{ fontWeight: 800 }}>{p.goals}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
            {(s.notes || []).length > 0 && (
              <ul style={{ margin: `${S.md}px 0 0`, paddingLeft: S.lg, fontSize: T.meta, color: C.text2, lineHeight: 1.6 }}>
                {s.notes.map((n, k) => <li key={k}>{n.text}</li>)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
