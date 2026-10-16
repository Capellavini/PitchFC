import { C, S, T, cardStyle, displayFont } from "../../theme";

/** Small highlight tile (top scorer, official MVP…) — tappable when it
 *  leads somewhere. */
export default function LeagueHighlight({ Icon, title, value, sub, onClick }) {
  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Icon size={14} color={C.gold} aria-hidden /> {title}
      </div>
      <div style={{ ...displayFont, fontSize: 18, marginTop: S.sm, color: C.text1, overflowWrap: "anywhere" }}>{value}</div>
      {sub && <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{sub}</div>}
    </>
  );
  if (!onClick) return <div style={cardStyle}>{body}</div>;
  return <button type="button" onClick={onClick} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", color: C.text1, width: "100%", minHeight: 44 }}>{body}</button>;
}

