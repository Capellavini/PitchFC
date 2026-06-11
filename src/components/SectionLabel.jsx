import { C } from "../theme";

export default function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: 10, color: C.text2, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}
