import { useState } from "react";
import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import LeagueReasonSheet from "./LeagueReasonSheet";

const pill = (active) => ({
  minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontWeight: 700, fontSize: T.meta, flex: "1 1 120px",
  border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "transparent", color: active ? C.bg : C.text1,
});

/** W.O. (record_walkover): which team didn't show + mandatory reason. The
 *  score comes from the regulation; it counts as homologated. */
export default function LeagueCloudWalkoverSheet({ home, away, match, onConfirm, onClose }) {
  const [absent, setAbsent] = useState(null);
  return (
    <LeagueReasonSheet title={t("Falta de comparência (W.O.)")} text={t("O resultado sai do regulamento e conta como homologado. Indica a equipa que faltou.")}
      confirmLabel={t("Registar W.O.")} onClose={onClose}
      onConfirm={(reason) => (absent ? onConfirm(absent, reason) : { message: t("Escolhe a equipa que faltou.") })}>
      <div role="radiogroup" aria-label={t("Equipa que faltou")} style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.md }}>
        {[[match.homeId, home], [match.awayId, away]].map(([id, tm]) => (
          <button key={id} type="button" role="radio" aria-checked={absent === id} onClick={() => setAbsent(id)} style={pill(absent === id)}>{tm.name}</button>
        ))}
      </div>
    </LeagueReasonSheet>
  );
}
