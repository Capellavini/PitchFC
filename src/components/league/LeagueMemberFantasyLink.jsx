import { C, R, S, T, TOUCH } from "./visual/theme";
import { t } from "../../lib/i18n";

/** Slim bar above a captain's/athlete's league: the league's Pitch Manager lives on the fan page (own account,
 *  own squad), so members get a way in instead of a hidden tab. */
export default function LeagueMemberFantasyLink({ href }) {
  if (!href) return null;
  return (
    <a
      href={href}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, minHeight: TOUCH,
        padding: `0 ${S.lg}px`, background: C.card, borderBottom: `1px solid ${C.border}`, borderRadius: R.card,
        color: C.text1, fontSize: T.body, fontWeight: 700, textDecoration: "none",
      }}
    >
      <span>{t("Pitch Manager da liga")}</span>
      <span style={{ color: C.accent }}>{t("Jogar")} →</span>
    </a>
  );
}
