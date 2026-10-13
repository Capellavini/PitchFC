import { PencilLine } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";
import { CC, tf } from "../lib/rivalsCopy";
import { diffTerms } from "../lib/rivalsChallenges";
import { termLabel, termValue } from "../lib/challengeLabels";

/** What changed between two versions of the terms: one row per changed
 *  field with the new value, a "mudou" tag (icon + text, not colour only)
 *  and the previous value. Nothing changed / no previous → renders null
 *  (or `emptyText`). `teams` = { challenger, challenged }. */
export default function VersionDiff({ prev, next, teams, emptyText }) {
  const keys = diffTerms(prev, next).filter((k) => k !== "timezone" && k !== "venueUrl");
  if (!prev || !keys.length) return emptyText ? <div style={{ fontSize: T.meta, color: C.text2 }}>{emptyText}</div> : null;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.xs + 2 }}>
      {keys.map((k) => (
        <li key={k} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.sm}px ${S.md}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, justifyContent: "space-between" }}>
            <span style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em" }}>{termLabel(k, next)}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.min, fontWeight: 800, color: C.accent }}>
              <PencilLine size={12} aria-hidden /> {t(CC.changed)}
            </span>
          </div>
          <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, marginTop: 2, overflowWrap: "anywhere" }}>{termValue(k, next, teams)}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>
            {tf(CC.wasValue, { v: termValue(k, prev, teams) })}
          </div>
        </li>
      ))}
    </ul>
  );
}
