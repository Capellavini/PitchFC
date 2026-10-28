import { C, S, T } from "../../theme";

/** A labelled form field for the league set-up screens. The input goes in
 *  `children`; `hint` is the small print under it. */
export default function LeagueField({ label, hint, children, style }) {
  return (
    <label style={{ display: "block", fontSize: T.meta, fontWeight: 700, color: C.text2, ...style }}>
      {label}
      <div style={{ marginTop: S.xs }}>{children}</div>
      {hint && <div style={{ fontSize: T.meta, fontWeight: 400, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  );
}
