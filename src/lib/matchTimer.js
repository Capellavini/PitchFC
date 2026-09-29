// MatchTimer (src/components/MatchTimer.jsx) is device-local state, kept
// under the same "pitch.v2." prefix as everything else in src/lib/storage.js
// (usePersistentState("matchTimer")). Live scoring reads it straight from
// localStorage — a one-off snapshot at the moment a goal is logged — rather
// than piping it through props, since nothing there needs to re-render
// while the clock ticks. Only returns a minute if the timer is actually
// running right now; otherwise the goal logs with no minute instead of a
// fabricated one.
export const TIMER_STORAGE_KEY = "pitch.v2.matchTimer";

export function currentTimerMinute() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const timer = JSON.parse(raw);
    if (!timer?.running || !timer.endsAt || !timer.durationSec) return null;
    const remaining = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
    const elapsed = timer.durationSec - remaining;
    return elapsed >= 0 ? Math.floor(elapsed / 60) + 1 : null;
  } catch {
    return null;
  }
}
