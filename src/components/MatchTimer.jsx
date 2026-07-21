import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer as TimerIcon, BellRing } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { usePersistentState } from "../lib/storage";
import { t as tr } from "../lib/i18n";

const PRESETS = [10, 15, 20, 30]; // minutes
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Match countdown: set the duration, start/pause, alarm at zero.
 *  Persists across refresh (stores the target end time). Device-local
 *  — whoever runs the clock keeps it on their phone. */
export default function MatchTimer() {
  const [t, setT] = usePersistentState("matchTimer", {
    durationSec: 600, remainingSec: 600, running: false, endsAt: null, finished: false,
  });
  const [, setTick] = useState(0);
  const audioRef = useRef(null);

  // Re-render every 250ms while running so the countdown updates.
  useEffect(() => {
    if (!t.running) return;
    const id = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [t.running]);

  const remaining = t.running ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remainingSec;

  // Fire the alarm exactly once when it reaches zero.
  useEffect(() => {
    if (t.running && remaining <= 0) {
      playAlarm();
      setT((s) => ({ ...s, running: false, remainingSec: 0, endsAt: null, finished: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, t.running]);

  const ensureAudio = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioRef.current) audioRef.current = new Ctx();
      if (audioRef.current.state === "suspended") audioRef.current.resume();
    } catch { /* no audio — timer still works visually */ }
  };

  const playAlarm = () => {
    const ctx = audioRef.current;
    if (!ctx) return;
    [0, 0.45, 0.9].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      const at = ctx.currentTime + delay;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      o.start(at); o.stop(at + 0.42);
    });
  };

  const start = () => {
    ensureAudio();
    const base = remaining > 0 ? remaining : t.durationSec;
    setT((s) => ({ ...s, running: true, finished: false, remainingSec: base, endsAt: Date.now() + base * 1000 }));
  };
  const pause = () => setT((s) => ({ ...s, running: false, remainingSec: remaining, endsAt: null }));
  const reset = () => setT((s) => ({ ...s, running: false, finished: false, remainingSec: s.durationSec, endsAt: null }));
  const setDuration = (min) => setT((s) => ({ ...s, durationSec: min * 60, remainingSec: min * 60, running: false, endsAt: null, finished: false }));

  const low = t.running && remaining <= 60;
  const numColor = t.finished ? C.red : low ? C.orange : C.accent;

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <TimerIcon size={15} color={C.text2} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{tr("Cronómetro do jogo")}</span>
        {t.finished && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: C.red, display: "flex", alignItems: "center", gap: 4 }}>
            <BellRing size={13} /> {tr("Fim do tempo!")}
          </span>
        )}
      </div>

      {/* big countdown */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ ...displayFont, fontSize: 56, lineHeight: 1, color: numColor, fontVariantNumeric: "tabular-nums", animation: low ? "tpulse 1s infinite" : "none" }}>
          {fmt(remaining)}
        </div>
        <style>{`@keyframes tpulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
      </div>

      {/* presets (hidden while running to avoid mistaps) */}
      {!t.running && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
          {PRESETS.map((min) => {
            const active = t.durationSec === min * 60;
            return (
              <button key={min} onClick={() => setDuration(min)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: active ? 800 : 500, cursor: "pointer" }}>
                {min} min
              </button>
            );
          })}
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px" }}>
            <input type="number" min="1" max="120" value={Math.round(t.durationSec / 60)}
              onChange={(e) => setDuration(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
              style={{ width: 38, background: "none", border: "none", color: C.text1, fontSize: 12, outline: "none", textAlign: "center" }} />
            <span style={{ fontSize: 11, color: C.text3 }}>min</span>
          </label>
        </div>
      )}

      {/* controls */}
      <div style={{ display: "flex", gap: 10 }}>
        {t.running ? (
          <button onClick={pause} style={{ flex: 1, background: C.orange, color: C.bg, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Pause size={16} /> {tr("Pausar")}
          </button>
        ) : (
          <button onClick={start} style={{ flex: 1, background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Play size={16} /> {remaining > 0 && remaining < t.durationSec ? tr("Retomar") : tr("Iniciar")}
          </button>
        )}
        <button onClick={reset} style={{ background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <RotateCcw size={15} /> {tr("Repor")}
        </button>
      </div>
    </div>
  );
}
