import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";

/** Captain / vice marker: lime "C" (filled) and "V" (outlined) — letter +
 *  colour + an accessible name, so it never depends on colour alone.
 *  `label` adds the word ("Capitão: Rui") for directory cards. */
export default function RoleBadge({ role, name, compact = false }) {
  if (role !== "captain" && role !== "vice") return null;
  const captain = role === "captain";
  const word = t(captain ? RC.captainShort : RC.viceShort);
  const full = t(captain ? RC.roleCaptain : RC.roleVice);
  const letter = (
    <span aria-hidden style={{
      width: 20, height: 20, borderRadius: R.pill, flexShrink: 0, boxSizing: "border-box",
      background: captain ? C.accent : C.accentDim, color: captain ? C.bg : C.accent,
      border: `1px solid ${captain ? C.accent : C.accentBorder}`,
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: T.min, fontWeight: 900,
    }}>{captain ? "C" : "V"}</span>
  );
  if (compact) return <span role="img" aria-label={full} title={full} style={{ display: "inline-flex" }}>{letter}</span>;
  return (
    <span title={full} style={{ display: "inline-flex", alignItems: "center", gap: S.xs + 2, minWidth: 0, maxWidth: "100%", fontSize: T.meta, color: C.text1 }}>
      {letter}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: C.text2 }}>{word}:</span> <b style={{ fontWeight: 800 }}>{name}</b>
      </span>
    </span>
  );
}
