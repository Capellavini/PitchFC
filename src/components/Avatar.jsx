import { C } from "../theme";
import { ini } from "../lib/helpers";

export default function Avatar({ name, color, size = 36, fontSize = 12, isMe, photo }) {
  const border = `1.5px solid ${isMe ? C.accent : color}`;
  if (photo) {
    return (
      <img src={photo} alt={name} style={{
        width: size, height: size, borderRadius: size * 0.3,
        objectFit: "cover", border, flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: isMe ? C.accentDim : `${color}18`,
      border,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: isMe ? C.accent : color, flexShrink: 0,
    }}>
      {ini(name)}
    </div>
  );
}
