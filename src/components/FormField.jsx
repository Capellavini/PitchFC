import { C, S, T } from "../theme";

/** Label + control + optional hint, stacked. Renders a <label> (tapping
 *  the caption focuses the input); pass `group` for multi-button controls
 *  (swatches, pills, steppers) to get a <div role="group"> instead. */
export default function FormField({ label, hint, children, style, group }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag role={group ? "group" : undefined} aria-label={group ? label : undefined} style={{ display: "block", minWidth: 0, marginBottom: S.md + 2, ...style }}>
      <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: T.min + 0.5, color: C.text2, marginTop: 5, lineHeight: 1.4 }}>{hint}</div>}
    </Tag>
  );
}
