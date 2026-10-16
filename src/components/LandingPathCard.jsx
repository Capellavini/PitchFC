import { ArrowRight } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * One "Escolhe o teu caminho" front (Organizador / Equipa / Liga). Strings
 * arrive t()-wrapped. `primary` gives the card the lime CTA + accent edge;
 * the other fronts use the accent ghost so the page keeps one lime path.
 */
export default function LandingPathCard({ kicker, title, badge, text, note, cta, onClick, primary }) {
  const Btn = primary ? BtnPrimary : BtnGhost;
  return (
    <div style={{ ...cardStyle, padding: S.xl, display: "flex", flexDirection: "column", minWidth: 0, borderColor: primary ? C.accentBorder : C.border }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.text2, marginBottom: S.md }}>{kicker}</div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        <h3 style={{ ...displayFont, fontSize: 24, margin: 0, color: C.text1 }}>{title}</h3>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 800, color: C.orange, background: C.orangeDim, borderRadius: 999, padding: "3px 9px" }}>{badge}</span>
        )}
      </div>
      <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6, margin: `0 0 ${S.lg}px`, flex: 1 }}>{text}</p>
      <div style={{ fontSize: 12, fontWeight: 700, color: primary ? C.accent : C.text2, marginBottom: S.md }}>{note}</div>
      <Btn block onClick={onClick} {...(primary ? {} : { tone: "accent" })}>{cta} <ArrowRight size={16} /></Btn>
    </div>
  );
}
