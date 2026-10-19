import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { C, R, S, T, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { OA, tf } from "../lib/onboardingAiCopy";
import { STEPS, parseField, parseLocal, looksLikeSentence, answeredSteps, normalizeProposal } from "../lib/onboardingAi";
import OnboardingAiStepInput from "./OnboardingAiStepInput";
import OnboardingAiCard from "./OnboardingAiCard";
import KeepyUppyLoader from "./KeepyUppyLoader";

const QUESTION = { venue: OA.qVenue, when: OA.qWhen, format: OA.qFormat, price: OA.qPrice, name: OA.qName };
// Hard ceiling per onboarding, on top of the server's daily limit.
const MAX_AI_CALLS = 6;

/**
 * Guided organizer onboarding (owner decision 2026-10-19): one question
 * per screen, chat-style. Each answer is parsed LOCALLY first; `askAi`
 * (cloud only — null in demo mode) is called only for a free-text answer
 * the local parser can't read, for that single field. A full sentence in
 * step 1 pre-fills everything and jumps to the confirmation card.
 *
 * Props: lang · askAi(field, text, lang) → {raw}|{fallback} (or null) ·
 * onCreate(proposal) → {error?} · onUseForm(raw) · onBack().
 */
export default function OnboardingAiChat({ lang, askAi, onCreate, onUseForm, onBack }) {
  const [raw, setRaw] = useState({});
  const [step, setStep] = useState("venue"); // one of STEPS, or "card"
  const [log, setLog] = useState([]);        // [{ step, q, a }]
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const aiCalls = useRef(0);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }); }, [step, log.length, hint, busy]);

  const toCard = (r) => { setProposal(normalizeProposal(r, { lang })); setStep("card"); };
  const nextFrom = (r, from) => {
    const done = answeredSteps(r);
    const next = STEPS.slice(STEPS.indexOf(from) + 1).find((s) => !done.has(s));
    if (next) setStep(next); else toCard(r);
  };
  const answer = (from, patch, label) => {
    const r = { ...raw, ...patch };
    setRaw(r);
    setLog((l) => [...l.filter((x) => x.step !== from), { step: from, q: QUESTION[from], a: label }]);
    setHint(false);
    nextFrom(r, from);
  };
  const ask = async (field, text) => {
    if (!askAi || aiCalls.current >= MAX_AI_CALLS) return null;
    aiCalls.current += 1;
    setBusy(true);
    try { const res = await askAi(field, text, lang); return res?.raw || null; } finally { setBusy(false); }
  };

  const onText = async (text) => {
    // Step 1 pasted a whole description → pre-fill and jump to the card.
    if (step === "venue" && looksLikeSentence(text)) {
      let r = { ...raw, ...parseLocal(text) };
      let done = answeredSteps(r);
      if (!(done.has("venue") && done.has("when"))) {
        const ai = await ask("sentence", text);
        if (ai) { r = { ...r, ...ai }; done = answeredSteps(r); }
      }
      setLog((l) => [...l.filter((x) => x.step !== "venue"), { step: "venue", q: QUESTION.venue, a: text }]);
      setRaw(r);
      setHint(false);
      if (done.has("venue") && done.has("when")) { toCard(r); return; }
      const next = STEPS.find((s) => !done.has(s));
      setStep(next || "card");
      if (next === "venue") setHint(true);
      return;
    }
    const local = parseField(step, text);
    if (local.confident) { answer(step, local.raw, text); return; }
    const ai = await ask(step, text);
    const merged = { ...local.raw, ...(ai || {}) };
    if (answeredSteps({ ...raw, ...merged }).has(step)) { answer(step, merged, text); return; }
    // The venue IS whatever they call it — accept the best guess, editable on the card.
    if (step === "venue" && local.raw.venue_name) { answer(step, local.raw, text); return; }
    setRaw((r) => ({ ...r, ...merged })); // keep partials (e.g. the weekday) to pre-select the chips
    setHint(true);
  };

  const goBack = () => {
    if (step === "card") { setStep("name"); return; }
    const i = STEPS.indexOf(step);
    if (i <= 0) onBack(); else { setStep(STEPS[i - 1]); setHint(false); }
  };

  const create = async () => {
    if (creating) return;
    setCreating(true); setError(null);
    try {
      const res = await onCreate(proposal);
      if (res?.error) setError(res.error);
    } catch (e) { setError(e?.message || "error"); }
    setCreating(false);
  };

  const bubble = (who, text, key) => (
    <div key={key} style={{ display: "flex", justifyContent: who === "me" ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%", padding: `${S.sm + 2}px ${S.md}px`, borderRadius: R.card, fontSize: T.body, lineHeight: 1.4,
        overflowWrap: "anywhere", whiteSpace: "pre-wrap",
        ...(who === "me"
          ? { background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.text1, borderBottomRightRadius: 4 }
          : { background: C.card, border: `1px solid ${C.border}`, color: C.text1, borderBottomLeftRadius: 4, fontWeight: 600 }),
      }}>{text}</div>
    </div>
  );

  const stepNo = STEPS.indexOf(step) + 1;
  const visibleLog = log
    .filter((x) => STEPS.indexOf(x.step) < STEPS.indexOf(step))
    .sort((a, b) => STEPS.indexOf(a.step) - STEPS.indexOf(b.step));

  return (
    <div style={{ padding: `0 ${S.lg}px ${S.xxl}px`, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.lg}px 0 ${S.xs}px` }}>
        <button type="button" onClick={goBack} aria-label={t(OA.back)}
          style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", width: 44, height: 44, marginLeft: -12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ ...displayFont, fontSize: T.h, flex: 1, minWidth: 0 }}>{t(OA.title)}</div>
        {step !== "card" && <div style={{ fontSize: T.meta, color: C.text2, flexShrink: 0 }}>{tf(OA.stepOf, { n: stepNo, total: STEPS.length })}</div>}
      </div>

      {step === "card" ? (
        <OnboardingAiCard proposal={proposal} lang={lang} onChange={setProposal} onCreate={create} creating={creating} error={error} />
      ) : (
        <>
          {log.length === 0 && <div style={{ fontSize: T.body, color: C.text2, margin: `0 0 ${S.lg}px` }}>{t(OA.intro)}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginBottom: S.md }}>
            {visibleLog.map((x, i) => [bubble("bot", t(x.q), `q${i}`), bubble("me", x.a, `a${i}`)])}
            {bubble("bot", t(QUESTION[step]), "current")}
            {hint && <div style={{ fontSize: T.meta, color: C.orange, paddingLeft: S.xs }} role="status">{t(OA.notUnderstood)}</div>}
          </div>
          {busy ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, padding: `${S.md}px 0` }} role="status">
              <KeepyUppyLoader size={72} />
              <div style={{ fontSize: T.meta, color: C.text2 }}>{t(OA.thinking)}</div>
            </div>
          ) : (
            <OnboardingAiStepInput step={step} raw={raw} lang={lang} busy={busy} onText={onText} onPick={(patch, label) => answer(step, patch, label)} />
          )}
        </>
      )}

      <div style={{ textAlign: "center", marginTop: S.xl }} ref={bottomRef}>
        <button type="button" onClick={() => onUseForm(raw)}
          style={{ background: "none", border: "none", color: C.text2, fontSize: T.meta, textDecoration: "underline", cursor: "pointer", minHeight: 44, padding: `0 ${S.md}px`, fontFamily: "inherit" }}>
          {t(OA.useForm)}
        </button>
      </div>
    </div>
  );
}
