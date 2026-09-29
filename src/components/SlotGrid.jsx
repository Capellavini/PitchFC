import { C, S, T, displayFont } from "../theme";
import { Check } from "lucide-react";
import { t } from "../lib/i18n";
import SlotTile from "./SlotTile";

/**
 * SlotGrid — the slot grid hero shared by Jogar's next-game card and
 * Home's next-action card, so the two can never diverge: count row
 * ("8/10" big italic + orange "2 vagas em aberto" / green "Equipa
 * completa!" + waiting-list line), then 5 tiles per row (filled, then
 * dashed empties).
 *
 * Props:
 *  - players   playing players (already capped to spots), see SlotTile.
 *  - spots     total spots.
 *  - waitlist  number on the waiting list (optional).
 *  - compact   smaller count + tiles (Home).
 */
export default function SlotGrid({ players = [], spots = 10, waitlist = 0, compact = false }) {
  const spotsLeft = spots - players.length;
  const full = spotsLeft <= 0;
  const empties = Math.max(0, spotsLeft);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.md, position: "relative" }}>
        <div>
          <span style={{ ...displayFont, fontSize: compact ? 32 : 40, lineHeight: 1, color: full ? C.green : C.text1 }}>{players.length}</span>
          <span style={{ fontSize: compact ? T.cardTitle : T.h, fontWeight: 600, color: C.text2 }}>/{spots}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          {!full
            ? <div style={{ fontSize: T.body, color: C.orange, fontWeight: 700 }}>{spotsLeft} {spotsLeft === 1 ? t("vaga em aberto") : t("vagas em aberto")}</div>
            : <div style={{ fontSize: T.body, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: S.xs, justifyContent: "flex-end" }}><Check size={15} /> {t("Equipa completa!")}</div>}
          {waitlist > 0 && <div style={{ fontSize: T.meta, color: C.orange, fontWeight: 700, marginTop: 2 }}>{waitlist} {t("na lista de espera")}</div>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: compact ? S.sm - 2 : S.sm, rowGap: compact ? S.sm : S.md, position: "relative" }}>
        {players.map((p) => <SlotTile key={p.id} player={p} compact={compact} />)}
        {Array.from({ length: empties }).map((_, i) => <SlotTile key={`empty-${i}`} player={null} compact={compact} />)}
      </div>
    </>
  );
}
