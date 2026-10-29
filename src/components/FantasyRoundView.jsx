import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import "../lib/fantasyConnectionCopy";
import FantasyConnectionResult from "./FantasyConnectionResult";
import FantasyRoundBreakdown from "./FantasyRoundBreakdown";

/**
 * FantasyRoundView — the "Rodada" area: one CLOSED round at a time (never
 * mixed up with the editable lineup of the next round), my total split into
 * base + Conexão, the connection's own card with the plays behind the bonus,
 * and the player-by-player breakdown.
 *
 * Totals are what the server/demo stored: `score.points` already includes the
 * Conexão, `breakdown.base` is the untouched lineup total. Nothing is added here.
 *
 *  - rounds        scored rounds, newest first: [{ id, no }].
 *  - roundId / onRound   selected closed round.
 *  - score         my score row of that round (or null if I had no lineup).
 *  - rank          my position in that round.
 *  - connection_rules   league.connection_rules (null in leagues without it).
 */
export default function FantasyRoundView({ rounds, roundId, onRound, score, rank, group, rules, myName, onOpenRecord }) {
  if (!rounds.length) {
    return <div style={{ ...cardStyle, fontSize: T.body - 1, color: C.text2, lineHeight: 1.4 }}>{t("Ainda sem rondas encerradas para mostrar.")}</div>;
  }
  const b = score?.breakdown;
  const conn = b?.connection;
  const base = b?.base ?? score?.points;
  return (
    <div>
      <label style={{ display: "block", fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.xs }} htmlFor="fantasy-round-select">
        {t("Escolhe a ronda")}
      </label>
      <select id="fantasy-round-select" value={roundId} onChange={(e) => onRound(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, marginBottom: S.lg, padding: `0 ${S.md}px`, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control, fontSize: T.body }}>
        {rounds.map((r) => <option key={r.id} value={r.id}>{t("Ronda")} {String(r.no).padStart(2, "0")} · {t("Ronda encerrada")}</option>)}
      </select>

      {score ? (
        <>
          <section style={{ ...cardStyle, marginBottom: S.lg, background: C.surface, borderColor: C.greenBorder }}>
            <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 }}>
              {myName} · {t("Apuração concluída")}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, flexWrap: "wrap", margin: `${S.sm}px 0` }}>
              <span style={{ ...displayFont, fontSize: 64, lineHeight: 1, color: C.accent, fontVariantNumeric: "tabular-nums" }}>{Math.round(score.points)}</span>
              <span style={{ fontSize: T.cardTitle, color: C.text2 }}>pts</span>
              {rank && <span style={{ marginLeft: "auto", fontSize: T.body, fontWeight: 700, color: C.green }}>{rank}.º {t("na ronda")}</span>}
            </div>
            <div style={{ fontSize: T.body - 1, color: C.text1 }}>
              {conn?.points > 0
                ? <>{Math.round(base)} {t("do plantel")} + {conn.points} {t("da conexão")}</>
                : <>{t("Total base")} · {Math.round(base)}</>}
            </div>
            {rules?.enabled && (
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>
                {t("Capitão e transferências já estão incluídos no total base.")}
              </div>
            )}
          </section>
          <FantasyConnectionResult score={score} group={group} maxEvents={rules?.max_events} bonusPerEvent={rules?.bonus_per_event} onOpenRecord={onOpenRecord} />
          {b?.players && <FantasyRoundBreakdown score={score} group={group} title={t("Total base")} />}
        </>
      ) : (
        <div style={{ ...cardStyle, fontSize: T.body - 1, color: C.text2, lineHeight: 1.4 }}>{t("Não tinhas escalação nesta ronda.")}</div>
      )}
    </div>
  );
}
