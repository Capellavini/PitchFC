import { C } from "../theme";

export default function BtnGhost({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", ...style }}>
      {children}
    </button>
  );
}
