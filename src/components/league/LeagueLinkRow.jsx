import { ChevronRight } from "lucide-react";
import { C, S, T, TOUCH, cardStyle } from "../../theme";

/** A tappable list row (league, competition, followed entity) → href. */
export default function LeagueLinkRow({ href, title, meta, right }) {
  return (
    <a href={href} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, padding: `0 ${S.md}px`, minHeight: TOUCH.button + 8,
      marginBottom: S.sm, color: C.text1, textDecoration: "none" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{title}</span>
        {meta ? <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{meta}</span> : null}
      </span>
      {right}
      <ChevronRight size={18} color={C.text2} />
    </a>
  );
}
