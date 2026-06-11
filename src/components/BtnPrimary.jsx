import { C } from "../theme";

export default function BtnPrimary({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: "11px 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", ...style }}>
      {children}
    </button>
  );
}
