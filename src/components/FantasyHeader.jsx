import { Lock } from "lucide-react";
import { C, S, T, displayFont } from "../theme";
import { lisbonTimeLabel } from "../lib/helpers";
import { t } from "../lib/i18n";
import "../lib/fantasyConnectionCopy";
import { fmtLeft } from "./FantasyLockBar";
import Chip from "./Chip";

/**
 * FantasyHeader — where I am: group + league, the round being edited and
 * when it locks (the DB locks at kick-off; this only mirrors it).
 *  - title     league name; groupName is the eyebrow.
 *  - roundNo   number of the round being edited.
 *  - kickoffAt next kick-off; inProgress = a locked round awaits its night.
 */
export default function FantasyHeader({ groupName, title, roundNo, kickoffAt, inProgress, now = Date.now() }) {
  const ko = kickoffAt ? new Date(kickoffAt).getTime() : null;
  const open = ko && ko > now;
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: S.md, flexWrap: "wrap", margin: `${S.xs}px 0 ${S.lg}px` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, overflowWrap: "anywhere" }}>
          {groupName || "Pitch Manager"}
        </div>
        <h2 style={{ ...displayFont, margin: `${S.xs}px 0 0`, fontSize: T.title - 4, lineHeight: 1.1, color: C.text1, overflowWrap: "anywhere" }}>{title}</h2>
      </div>
      <Chip variant={inProgress ? "orange" : open ? "lime" : "neutral"} Icon={Lock}
        title={inProgress ? t("Ronda em curso — as mudanças contam para a próxima ronda.") : undefined}>
        {t("Ronda")} {String(roundNo).padStart(2, "0")}
        {" · "}
        {inProgress ? t("A ronda fechou") : open ? `${t("Fecha em")} ${fmtLeft(ko - now)} · ${lisbonTimeLabel(new Date(ko))}` : t("Fecha no começo do próximo jogo.")}
      </Chip>
    </header>
  );
}
