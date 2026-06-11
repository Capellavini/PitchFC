import { C } from "../theme";
import { ini } from "../lib/helpers";

export default function Avatar({ name, color, size = 36, fontSize = 12, isMe }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: isMe ? C.accentDim : `${color}18`,
      border: `1.5px solid ${isMe ? C.accent : color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: isMe ? C.accent : color, flexShrink: 0,
    }}>
      {ini(name)}
    </div>
  );
}
