// ── Voice commands (push-to-talk) ───────────────────────────
// Web Speech API only — no server, no cost. Deliberately NOT "always
// listening": every call captures a single short utterance, started by
// an explicit tap, because (a) continuous recognition drains battery and
// needs a standing mic permission nobody wants on a football pitch, and
// (b) support is inconsistent enough (iOS Safari especially) that a
// silent no-op button is better than one that half-works in the
// background. Callers must feature-detect with `voiceSupported()` first
// and simply not render the mic button when it's false.

const SpeechRecognitionImpl = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export const voiceSupported = () => Boolean(SpeechRecognitionImpl);

/** Captures speech for as long as the caller holds it open, ended by
 *  calling the returned `stop()` (push-to-talk release) — never by the
 *  browser's own silence detection. `continuous: true` was the first
 *  attempt at this and iOS Safari doesn't cope with it well (the session
 *  ends within a fraction of a second, way before any real hold). This
 *  instead chains a run of short `continuous: false` sessions back to
 *  back — the one mode every engine actually supports properly — restart-
 *  ing a fresh one every time the current one ends on its own, for as
 *  long as `stop()` hasn't been called yet. Whatever text the last
 *  session captured (interim or final) is kept as a running transcript,
 *  so a mid-sentence auto-restart doesn't lose what was already heard.
 *  `onResult(transcript)` fires once on stop() if anything was heard,
 *  `onError(code)` on a genuine failure (bad mic permission, unsupported)
 *  or if stop() produced nothing at all, `onEnd()` always last. */
export function listenOnce({ lang = "pt-PT", onResult, onError, onEnd }) {
  if (!SpeechRecognitionImpl) { onError?.("unsupported"); onEnd?.(); return () => {}; }
  let stopped = false;
  let lastTranscript = "";
  let currentRec = null;

  const runSession = () => {
    if (stopped) return;
    const rec = new SpeechRecognitionImpl();
    currentRec = rec;
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      lastTranscript = res?.[0]?.transcript || lastTranscript;
    };
    rec.onerror = (e) => {
      // "no-speech"/"aborted" between chained sessions is expected while
      // still held (silence, or our own restart) — only a real failure
      // should stop the chain early.
      if (e.error !== "no-speech" && e.error !== "aborted") { stopped = true; onError?.(e.error); onEnd?.(); }
    };
    rec.onend = () => {
      if (stopped) {
        if (lastTranscript) onResult?.(lastTranscript);
        else onError?.("no-speech");
        onEnd?.();
      } else {
        runSession(); // still held — pick straight back up
      }
    };
    try { rec.start(); } catch { stopped = true; onError?.("start-failed"); onEnd?.(); }
  };
  runSession();
  return () => { stopped = true; try { currentRec?.stop(); } catch { /* already stopped */ } };
}

const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalize = (s) => stripAccents(s).toLowerCase().trim();

const OWN_GOAL_WORDS = ["proprio", "propria", "contra"];

/** Reads a transcript like "golo do rodrigo assistencia do fatih" against
 *  two team rosters (arrays of {id, nick}) and returns the best guess:
 *  { teamId, scorerId, assistId, ownGoal } or null if no name matched at
 *  all. Which roster a recognized nick belongs to decides the scoring
 *  team automatically — no need to say the team out loud. Own-goal
 *  wording flips that: the scorer's team concedes, the OTHER team scores.
 *  Two names found → first mention is the scorer, second the assist
 *  (matches how people naturally say it: "golo do X, assistência do Y"). */
export function parseGoalCommand(transcript, homeTeamId, homeRoster, awayTeamId, awayRoster) {
  const text = normalize(transcript);
  if (!text) return null;

  const candidates = [
    ...homeRoster.map((p) => ({ ...p, teamId: homeTeamId })),
    ...awayRoster.map((p) => ({ ...p, teamId: awayTeamId })),
  ].filter((p) => p.nick);

  // Every candidate whose (normalized) nick appears in the transcript,
  // ordered by where it appears — first mention = scorer, next = assist.
  const found = candidates
    .map((p) => ({ ...p, idx: text.indexOf(normalize(p.nick)) }))
    .filter((p) => p.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  if (!found.length) return null;

  const isOwnGoal = OWN_GOAL_WORDS.some((w) => text.includes(w));
  const scorer = found[0];
  // Distinct second name (a nick that's a substring of another, e.g.
  // "Ana"/"Anabela", could self-match twice — keep only a different id).
  const assist = found.find((p) => p.id !== scorer.id) || null;

  if (isOwnGoal) {
    const benefitingTeamId = scorer.teamId === homeTeamId ? awayTeamId : homeTeamId;
    return { teamId: benefitingTeamId, scorerId: scorer.id, assistId: null, ownGoal: true };
  }
  return { teamId: scorer.teamId, scorerId: scorer.id, assistId: assist ? assist.id : null, ownGoal: false };
}

/** "iniciar" / "começar" / "arrancar" / "soltar tempo" / "start" — the
 *  timer's push-to-talk only needs a yes/no read, not name matching. */
export function isStartTimerCommand(transcript) {
  const text = normalize(transcript);
  return ["iniciar", "comecar", "arrancar", "soltar tempo", "solta tempo", "start", "play"].some((w) => text.includes(w));
}
