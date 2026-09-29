import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, BellRing, Minus, Plus, Mic, SlidersHorizontal } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { usePersistentState } from "../lib/storage";
import { voiceSupported, listenOnce, isStartTimerCommand } from "../lib/voice";
import { t as tr } from "../lib/i18n";
import BtnGhost from "./BtnGhost";

const PRESETS = [10, 15, 20, 30]; // minutes
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const roundBtn = () => ({
  width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: "transparent", color: C.text2,
  border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
});

/** Match countdown: set the duration, start/pause, alarm at zero.
 *  Persists across refresh (stores the target end time) under
 *  "pitch.v2.matchTimer" — src/lib/matchTimer.js reads the same key to
 *  stamp a goal's minute. Device-local: whoever runs the clock keeps it
 *  on their phone.
 *
 *  Layout: one compact line that sits right under the live score (the
 *  mockup's "Live · 1st Half · 12:34") — running time + a 44px
 *  Iniciar/Pausar/Retomar icon button + a settings button. The duration
 *  presets, ±1 min nudges, reset and voice start live behind the settings
 *  button ("Configurar cronómetro"), collapsed by default so they can't be
 *  mistapped mid-game. */
export default function MatchTimer() {
  const [t, setT] = usePersistentState("matchTimer", {
    durationSec: 600, remainingSec: 600, running: false, endsAt: null, finished: false,
  });
  const [, setTick] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
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
    setConfigOpen(false);
  };
  const pause = () => setT((s) => ({ ...s, running: false, remainingSec: remaining, endsAt: null }));
  const reset = () => setT((s) => ({ ...s, running: false, finished: false, remainingSec: s.durationSec, endsAt: null }));
  const setDuration = (min) => setT((s) => ({ ...s, durationSec: min * 60, remainingSec: min * 60, running: false, endsAt: null, finished: false }));

  // Nudge the clock without stopping it — for when someone forgot to
  // start it on time and needs to add/remove a minute to compensate.
  const adjustMinutes = (deltaMin) => {
    const deltaSec = deltaMin * 60;
    setT((s) => {
      if (s.running) return { ...s, endsAt: s.endsAt + deltaSec * 1000, finished: false };
      const remainingSec = Math.max(0, s.remainingSec + deltaSec);
      return { ...s, remainingSec, durationSec: Math.max(60, s.durationSec + deltaSec), finished: false };
    });
  };

  const low = t.running && remaining <= 60;
  const numColor = t.finished ? C.red : low ? C.orange : C.text1;
  const pristine = !t.running && !t.finished && remaining === t.durationSec;
  const paused = !t.running && !t.finished && remaining > 0 && remaining < t.durationSec;

  // "Soltar tempo" — press-and-hold start, same interaction as the voice
  // goal in live scoring: releasing is what ends the capture, instead of
  // trusting the browser to guess when you stopped talking. Only wired to
  // start (never pause/reset): those are rare/deliberate taps.
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMiss, setVoiceMiss] = useState(null); // null | 'miss' | 'not-allowed' | 'service-not-allowed' | { code }
  const voiceStopRef = useRef(null);
  const beginVoiceStart = () => {
    setVoiceMiss(null);
    setVoiceListening(true);
    voiceStopRef.current = listenOnce({
      onResult: (transcript) => {
        setVoiceListening(false);
        if (isStartTimerCommand(transcript)) start();
        else { setVoiceMiss("miss"); setTimeout(() => setVoiceMiss(null), 2500); }
      },
      onError: (error) => {
        setVoiceListening(false);
        if (error === "not-allowed") setVoiceMiss("not-allowed");
        else if (error === "service-not-allowed") { setVoiceMiss("service-not-allowed"); setTimeout(() => setVoiceMiss(null), 5000); }
        else { setVoiceMiss({ code: error }); setTimeout(() => setVoiceMiss(null), 4000); }
      },
    });
  };
  const endVoiceStart = () => { voiceStopRef.current?.(); voiceStopRef.current = null; };

  const status = t.finished ? <><BellRing size={13} /> {tr("Fim do tempo!")}</>
    : t.running ? tr("A decorrer")
    : paused ? tr("Em pausa")
    : tr("Cronómetro do jogo");
  const toggleLabel = t.running ? tr("Pausar") : paused ? tr("Retomar") : tr("Iniciar");

  return (
    <div style={{ ...cardStyle, padding: `${S.sm}px ${S.sm}px ${S.sm}px ${S.lg}px`, marginBottom: S.lg }}>
      <style>{`@keyframes tpulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        <div style={{ ...displayFont, fontSize: 32, lineHeight: 1, color: numColor, fontVariantNumeric: "tabular-nums", animation: low ? "tpulse 1s infinite" : "none", flexShrink: 0 }}>
          {fmt(remaining)}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: T.meta, fontWeight: 700, color: t.finished ? C.red : C.text2, display: "flex", alignItems: "center", gap: S.xs, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {status}
        </div>
        <button type="button" onClick={t.running ? pause : start} aria-label={toggleLabel} title={toggleLabel}
          style={{ ...roundBtn(), background: t.running ? "transparent" : C.accent, color: t.running ? C.orange : C.bg, border: `1px solid ${t.running ? C.orange : C.accent}` }}>
          {t.running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" onClick={() => setConfigOpen((v) => !v)} aria-expanded={configOpen}
          aria-label={tr("Configurar cronómetro")} title={tr("Configurar cronómetro")}
          style={{ ...roundBtn(), border: "none", color: configOpen ? C.text1 : C.text2 }}>
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {configOpen && (
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: S.sm, padding: `${S.md}px ${S.sm}px ${S.xs}px 0` }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.sm }}>{tr("Configurar cronómetro")}</div>

          {/* presets — only before the clock has been touched (avoids mistaps mid-game) */}
          {pristine && (
            <div style={{ display: "flex", gap: S.sm, marginBottom: S.md, flexWrap: "wrap" }}>
              {PRESETS.map((min) => {
                const active = t.durationSec === min * 60;
                return (
                  <button key={min} type="button" onClick={() => setDuration(min)}
                    style={{ minHeight: 44, background: active ? C.accentDim : "transparent", color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: R.pill, padding: `0 ${S.md}px`, fontSize: T.meta, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
                    {min} min
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
            <button type="button" onClick={() => adjustMinutes(-1)} aria-label={tr("Tirar 1 minuto")} title={tr("Tirar 1 minuto")} style={roundBtn()}>
              <Minus size={16} />
            </button>
            <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>1 min</span>
            <button type="button" onClick={() => adjustMinutes(1)} aria-label={tr("Adicionar 1 minuto")} title={tr("Adicionar 1 minuto")} style={roundBtn()}>
              <Plus size={16} />
            </button>
            <span style={{ flex: 1 }} />
            {!t.running && voiceSupported() && (
              <button type="button"
                onPointerDown={(e) => { e.preventDefault(); beginVoiceStart(); }}
                onPointerUp={endVoiceStart}
                onPointerLeave={endVoiceStart}
                onPointerCancel={endVoiceStart}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={tr("Mantém premido e diz \"soltar tempo\"")}
                title={tr("Mantém premido e diz \"soltar tempo\"")}
                style={{ ...roundBtn(), background: voiceListening ? C.accentDim : "transparent", color: voiceListening ? C.accent : C.text2, border: `1px solid ${voiceListening ? C.accentBorder : C.border}`, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
                <Mic size={16} style={voiceListening ? { animation: "tpulse 1s infinite" } : undefined} />
              </button>
            )}
            <BtnGhost onClick={reset} compact aria-label={tr("Repor")} title={tr("Repor")}>
              <RotateCcw size={16} /> {tr("Repor")}
            </BtnGhost>
          </div>
        </div>
      )}

      {voiceMiss === "not-allowed" && (
        <div style={{ fontSize: T.meta, color: C.orange, textAlign: "center", marginTop: S.sm }}>{tr("Permissão de microfone negada — ativa-a nas definições do browser.")}</div>
      )}
      {voiceMiss === "service-not-allowed" && (
        <div style={{ fontSize: T.meta, color: C.orange, textAlign: "center", marginTop: S.sm }}>{tr("Este browser não permite reconhecimento de voz (comum no Safari/iPhone) — experimenta no Chrome, num Android ou computador.")}</div>
      )}
      {voiceMiss === "miss" && (
        <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.sm }}>{tr("Não percebi — mantém premido enquanto dizes \"iniciar\" ou \"soltar tempo\".")}</div>
      )}
      {voiceMiss?.code && (
        <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.sm }}>{tr("Erro do microfone:")} [{voiceMiss.code}]</div>
      )}
    </div>
  );
}
