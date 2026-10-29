import { C, S, T, displayFont } from "../../../theme";

/** A block of the league page: a title with the league colour as its tick, then the content.
 *  `id` is the anchor the page menu jumps to. */
export default function LandingSection({ id, title, hint, brand, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} style={{ marginBottom: S.xxl, scrollMarginTop: S.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: hint ? S.xs : S.md }}>
        <span aria-hidden style={{ width: 4, height: 22, borderRadius: 2, background: brand, flexShrink: 0 }} />
        <h2 id={`${id}-t`} style={{ ...displayFont, margin: 0, fontSize: T.h, lineHeight: 1.15, color: C.text1 }}>{title}</h2>
      </div>
      {hint && <div style={{ fontSize: T.meta, color: C.text2, margin: `0 0 ${S.md}px ${S.md}px`, lineHeight: 1.4 }}>{hint}</div>}
      {children}
    </section>
  );
}
