import { C, S, T, displayFont } from "../theme";

/** One compact score line: "● Azul  3 – 2  Verde ●". `big` for a
 *  single-game night (the score becomes the hero of the card).
 *  Props: m { homeName, awayName, homeGoals, awayGoals }, colorOf(name)
 *  → team colour (see teamColorOf in lib/homeFeed), big. */
export default function ScoreLine({ m, colorOf = () => null, big }) {
  const size = big ? T.title : T.h;
  const dot = (n) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorOf(n) ?? C.text2, flexShrink: 0 }} />;
  const label = (n) => <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>;
  const side = (n, right) => (
    <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: right ? "flex-end" : "flex-start", gap: S.sm, fontSize: big ? T.body : T.meta, fontWeight: 800, color: C.text1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {right ? <>{label(n)}{dot(n)}</> : <>{dot(n)}{label(n)}</>}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${big ? S.sm : S.xs}px 0` }}>
      {side(m.homeName, true)}
      <span style={{ ...displayFont, fontSize: size, lineHeight: 1, color: C.text1, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {m.homeGoals}<span style={{ color: C.text2, margin: `0 ${S.xs}px` }}>–</span>{m.awayGoals}
      </span>
      {side(m.awayName, false)}
    </div>
  );
}
