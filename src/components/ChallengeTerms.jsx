import { PencilLine } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";
import { CC } from "../lib/rivalsCopy";
import { TERM_ROWS, termLabel, termValue } from "../lib/challengeLabels";

/** The terms of one version as label/value rows. `changed` = keys to tag
 *  "mudou" (icon + text). Empty optional rows (address, note) are hidden.
 *  `teams` = { challenger, challenged }. */
export default function ChallengeTerms({ terms, teams, changed = [] }) {
  if (!terms) return null;
  const rows = TERM_ROWS.filter((k) => !((k === "venueAddress" || k === "note") && !terms[k]));
  return (
    <dl style={{ margin: 0 }}>
      {rows.map((k, i) => {
        const isNew = changed.includes(k);
        return (
          <div key={k} style={{ display: "flex", gap: S.md, alignItems: "baseline", padding: `${S.sm}px 0`, borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <dt style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.04em", width: 104, flexShrink: 0 }}>{termLabel(k, terms)}</dt>
            <dd style={{ margin: 0, flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700, color: C.text1, overflowWrap: "anywhere" }}>
              {termValue(k, terms, teams)}
              {isNew && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: S.sm, fontSize: T.min, fontWeight: 800, color: C.accent, whiteSpace: "nowrap" }}>
                  <PencilLine size={12} aria-hidden /> {t(CC.changed)}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
