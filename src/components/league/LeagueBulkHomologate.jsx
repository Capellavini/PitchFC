import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { C, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import BtnPrimary from "./visual/BtnPrimary";
import BtnGhost from "./visual/BtnGhost";

/** "Homologar a jornada": when several results are waiting, the Gestor can confirm them all at once, after saying
 *  they were checked. Contested games (in review) are never part of it — those are decisions, not confirmations. */
export default function LeagueBulkHomologate({ ids, act }) {
  const [asking, setAsking] = useState(false);
  if (ids.length < 2) return null;
  return (
    <div style={{ ...cardStyle, borderColor: C.accentBorder, marginBottom: S.md, display: "grid", gap: S.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        <ClipboardCheck size={20} color={C.accent} aria-hidden />
        <span style={{ fontSize: T.body, fontWeight: 800 }}>{tf(t("{n} resultados à espera de homologação"), { n: ids.length })}</span>
      </div>
      {!asking ? (
        <div><BtnGhost tone="accent" onClick={() => setAsking(true)}>{t("Homologar todos")}</BtnGhost></div>
      ) : (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Os resultados passam a oficiais e entram na classificação. Só confirmes se já conferiste cada um. Os jogos contestados ficam de fora.")}</div>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
            <BtnPrimary onClick={() => { act.homologateMany(ids); setAsking(false); }}>{tf(t("Conferi: homologar {n}"), { n: ids.length })}</BtnPrimary>
            <BtnGhost onClick={() => setAsking(false)}>{t("Cancelar")}</BtnGhost>
          </div>
        </>
      )}
    </div>
  );
}
