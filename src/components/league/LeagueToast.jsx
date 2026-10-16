import { useEffect } from "react";
import { C, R, S, T } from "../../theme";

/** Transient status line (aria-live) for local demo writes: success in
 *  green, LeagueError messages in red. */
export default function LeagueToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onDone, 3600);
    return () => clearTimeout(id);
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps -- onDone identity changes every render
  const err = toast?.tone === "error";
  return (
    <div aria-live="polite" role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 84, zIndex: 70, width: "calc(100% - 32px)", maxWidth: 440, pointerEvents: "none" }}>
      {toast && (
        <div style={{ background: C.card, border: `1px solid ${err ? C.red : C.greenBorder}`, borderLeft: `4px solid ${err ? C.red : C.green}`, borderRadius: R.control, padding: `${S.md}px ${S.lg}px`, fontSize: T.body, color: C.text1, lineHeight: 1.4, boxShadow: "0 6px 24px rgba(0,0,0,0.35)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
