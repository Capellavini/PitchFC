import { C, S, displayFont } from "../theme";

/**
 * Landing page content column (max 1080px, 20px side gutter) with an
 * optional centred heading block: lime eyebrow, display-font title and a
 * muted subtitle. All strings arrive already t()-wrapped.
 */
export default function LandingSection({ id, eyebrow, title, sub, align = "center", children, style }) {
  const hasHead = eyebrow || title || sub;
  return (
    <section id={id} style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 20px", ...style }}>
      {hasHead && (
        <div style={{ textAlign: align, marginBottom: S.xl + 4, maxWidth: align === "center" ? 640 : undefined, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0 }}>
          {eyebrow && <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.accent, marginBottom: S.sm }}>{eyebrow}</div>}
          {title && <h2 style={{ ...displayFont, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.1, color: C.text1, margin: 0 }}>{title}</h2>}
          {sub && <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.6, margin: `${S.md}px 0 0` }}>{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
