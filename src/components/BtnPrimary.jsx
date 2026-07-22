import { C } from "../theme";

export default function BtnPrimary({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: "11px 16px", fontWeight: 800, fontSize: 14, cursor: disabled ? "default" : "pointer", ...style }}>
      {children}
    </button>
  );
}
