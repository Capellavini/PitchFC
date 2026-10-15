import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { MC } from "../lib/rivalsMatchCopy";

/** Top scorers + most assists of a team (≤ 3 each), from confirmed matches.
 *  Anonymous visitors of a public team page get none from the server — it
 *  then renders nothing. Props: scorers / assisters = [{ nick, n }]. */
export default function TeamTopPlayers({ scorers = [], assisters = [] }) {
  const lists = [[MC.topScorers, scorers], [MC.topAssisters, assisters]].filter(([, l]) => l.length);
  if (!lists.length) return null;
  return (
    <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: S.lg, marginBottom: S.lg }}>
      {lists.map(([title, list]) => (
        <div key={title} style={{ minWidth: 0 }}>
          <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: S.sm }}>{t(title)}</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {list.map((p, i) => (
              <li key={`${p.nick}${i}`} style={{ display: "flex", justifyContent: "space-between", gap: S.sm, padding: `${S.xs}px 0`, fontSize: T.body, color: C.text1 }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{i + 1}. {p.nick}</span>
                <span style={{ ...displayFont, fontSize: T.cardTitle, color: C.accent }}>{p.n}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
