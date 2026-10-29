import { Link2, ArrowRight, Check } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { FANTASY_CONNECTION } from "../lib/core/fantasyRules";
import "../lib/fantasyConnectionCopy";
import Chip from "./Chip";

/**
 * FantasyConnectionResult — what the round's Conexão did, from the score's
 * breakdown.connection (connectionBonus() output, frozen pair in
 * breakdown.connectionPair). Each state reads differently on purpose:
 * zero events with complete data is NOT the same as not being able to
 * settle the round, and a provisional play never shows as official bonus.
 *
 * Props:
 *  - score          fantasy score row of ONE round (breakdown.connection null
 *                   = the rule wasn't active then → renders nothing).
 *  - group          roster (nicks).
 *  - bonusPerEvent, maxEvents   the league rules of that round.
 *  - onOpenRecord() optional: opens the group's match history. Offered only
 *                   when the app can really take the user there.
 */
export default function FantasyConnectionResult({ score, group, maxEvents = FANTASY_CONNECTION.maxEvents, bonusPerEvent = FANTASY_CONNECTION.bonusPerEvent, onOpenRecord }) {
  const c = score?.breakdown?.connection;
  if (!c) return null;
  const nick = (id) => group.find((p) => String(p.uuid) === String(id))?.nick ?? "?";
  const pair = score.breakdown.connectionPair;
  const names = pair ? `${nick(pair.creator_id)} → ${nick(pair.finisher_id)}` : null;
  const box = (borderColor) => ({ ...cardStyle, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg, borderColor });
  const eyebrow = (right) => (
    <div style={{ marginBottom: S.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 }}>
        <Link2 size={14} aria-hidden style={{ flexShrink: 0 }} /> {t("Conexão desta ronda")}
      </div>
      {right && <div style={{ marginTop: S.sm }}>{right}</div>}
    </div>
  );

  if (c.status === "none" || !pair) {
    return (
      <section aria-label={t("Conexão desta ronda")} style={box(C.border)}>
        {eyebrow(null)}
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1 }}>{t("Sem conexão nesta ronda")}</div>
        <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>{t("Não escolheste uma dupla. Sem penalização.")}</div>
      </section>
    );
  }

  const pairLine = (
    <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", fontSize: T.h, fontWeight: 900, color: C.text1, marginBottom: S.xs }}>
      {names.split(" → ")[0]} <ArrowRight size={18} color={C.accent} aria-hidden /> {names.split(" → ")[1]}
    </div>
  );

  if (c.status === "insufficient" || c.status === "invalid") {
    return (
      <section aria-label={t("Conexão desta ronda")} style={box(C.orange)}>
        {eyebrow(<Chip variant="orange">{t("Dados insuficientes")}</Chip>)}
        {pairLine}
        <div role="status" style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.orange }}>{t("Faltam dados para apurar a conexão")}</div>
        <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>{t("Mantemos a pontuação base. Isto não conta como falha tua.")}</div>
      </section>
    );
  }

  if (c.status === "provisional") {
    return (
      <section aria-label={t("Conexão desta ronda")} style={box(C.orange)}>
        {eyebrow(<Chip variant="orange">{t("Provisória")}</Chip>)}
        {pairLine}
        <div role="status" style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.orange }}>
          {c.provisional} {c.provisional === 1 ? t("lance em apuração") : t("lances em apuração")}
        </div>
        <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>{t("Ainda não conta para o total oficial.")}</div>
      </section>
    );
  }

  if (c.status === "no_match") {
    return (
      <section aria-label={t("Conexão desta ronda")} style={box(C.border)}>
        {eyebrow(null)}
        {pairLine}
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1 }}>{t("A conexão não foi ativada nesta ronda")}</div>
        <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>{t("Sem lances que liguem os dois. +0, sem desconto.")}</div>
      </section>
    );
  }

  const capped = c.capped;
  return (
    <section aria-label={t("Conexão desta ronda")} style={box(C.accent)}>
      {eyebrow(<Chip variant="green" Icon={Check}>{t("Conexão ativada")}</Chip>)}
      {pairLine}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.4 }}>
        {c.totalValid} {c.totalValid === 1 ? t("assistência para golo confirmada") : t("assistências para golo confirmadas")}
      </div>
      <div style={{ ...displayFont, fontSize: T.title + 6, color: C.accent, margin: `${S.xs}px 0` }}>+{c.points} <span style={{ fontSize: T.cardTitle }}>{t("pontos")}</span></div>
      <div style={{ fontSize: T.meta, color: C.text2 }}>
        {capped ? `+${c.points} · ${t("limite da ronda alcançado")}` : `${c.awarded} ${t("de")} ${maxEvents} ${t("lances com bónus nesta ronda")}`}
      </div>

      <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, margin: `${S.lg}px 0 ${S.sm}px` }}>
        {c.totalValid === 1 ? t("O lance que fez a diferença") : t("Os lances que fizeram a diferença")}
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.sm }}>
        {c.events.map((e) => (
          <li key={e.id} style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.sm}px ${S.md}px`, borderRadius: R.control, background: C.surface, border: `1px solid ${C.border}`, opacity: e.awarded ? 1 : 0.65 }}>
            <span style={{ ...displayFont, fontSize: T.h, minWidth: 44, textAlign: "center", color: C.text1 }}>{e.min != null ? `${e.min}'` : `J${e.game}`}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: T.body - 1, lineHeight: 1.4, color: C.text1 }}>
              <strong>{t("Jogo")} {e.game}</strong> · {t("Golo")}: {nick(e.by)} · {t("Assistência")}: {nick(e.ast)}
              {!e.awarded && <span style={{ color: C.text2 }}> · {t("sem bónus (limite)")}</span>}
            </span>
            <span style={{ ...displayFont, color: e.awarded ? C.accent : C.text2, fontSize: T.cardTitle }}>{e.awarded ? `+${bonusPerEvent}` : "+0"}</span>
          </li>
        ))}
      </ol>
      {onOpenRecord && (
        <button type="button" onClick={onOpenRecord} style={{ minHeight: TOUCH.min, marginTop: S.sm, background: "none", border: "none", color: C.accent, fontSize: T.body, fontWeight: 800, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: S.xs }}>
          {t("Ver registo do jogo")} <ArrowRight size={16} aria-hidden />
        </button>
      )}
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4 }}>{t("Um lance, um bónus. O capitão não multiplica os pontos da conexão.")}</div>
    </section>
  );
}
