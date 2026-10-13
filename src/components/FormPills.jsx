import { C, T } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";

const LETTER = { W: RC.winShort, D: RC.drawShort, L: RC.lossShort };
const NAME = { W: RC.win, D: RC.draw, L: RC.loss };
const tone = (o) => (o === "W" ? C.green : o === "D" ? C.orange : C.red);

/** Recent form, newest first: V/E/D (EN W/D/L) pills. Letter + colour +
 *  a title/aria-label, so it never depends on colour alone. Empty →
 *  "Ainda sem jogos". */
export default function FormPills({ form = [], size = 26 }) {
  if (!form.length) return <span style={{ fontSize: T.meta, color: C.text2 }}>{t(RC.noGamesYet)}</span>;
  return (
    <div role="list" style={{ display: "flex", gap: 6 }}>
      {form.map((o, i) => (
        <span key={i} role="listitem" title={t(NAME[o])} aria-label={t(NAME[o])} style={{
          width: size, height: size, borderRadius: size / 2, background: tone(o), color: C.bg,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 900,
        }}>
          {t(LETTER[o])}
        </span>
      ))}
    </div>
  );
}
