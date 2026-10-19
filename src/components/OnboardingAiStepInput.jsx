import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { OA, tf } from "../lib/onboardingAiCopy";
import { FORMATS, normTime, parseField, normalizeProposal, perPlayerPrice, weekdayName, fmtMoney, defaultGroupName, MAX_INPUT_CHARS } from "../lib/onboardingAi";
import BtnPrimary from "./BtnPrimary";
import OnboardingAiPill from "./OnboardingAiPill";

const FORMAT_LABEL = (k) => k.replace("v", "×");

/**
 * The controls for ONE guided step. Structured picks (chips, time, number)
 * go straight to onPick(rawPatch, label) — no parsing, no AI. Free text
 * goes to onText(text): the chat parses it locally and only asks the AI
 * endpoint when that fails.
 */
export default function OnboardingAiStepInput({ step, raw, lang, busy, onText, onPick }) {
  const [text, setText] = useState("");
  const [wd, setWd] = useState(Number.isInteger(raw.weekday) ? raw.weekday : null);
  const [tm, setTm] = useState(normTime(raw.time) || "");
  const [otherOpen, setOtherOpen] = useState(false);
  const [spots, setSpots] = useState(raw.spots || 10);
  const [name, setName] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    setText("");
    setOtherOpen(false);
    if (Number.isInteger(raw.weekday)) setWd(raw.weekday);
    if (normTime(raw.time)) setTm(normTime(raw.time));
    if (step === "name") setName(raw.group_name || defaultGroupName({ weekday: raw.weekday, venue: raw.venue_name, lang }));
    // Focus the step's main field without scrolling the page under iOS' keyboard.
    setTimeout(() => ref.current?.focus?.({ preventScroll: true }), 50);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // A partial free-text answer ("às quintas depois do trabalho") pre-selects what it did get.
  useEffect(() => {
    if (Number.isInteger(raw.weekday)) setWd(raw.weekday);
    if (normTime(raw.time)) setTm(normTime(raw.time));
  }, [raw.weekday, raw.time]);

  const send = () => { const v = text.trim(); if (v && !busy) onText(v); };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const textRow = (placeholder, { multiline = false, inputMode } = {}) => (
    <div style={{ display: "flex", gap: S.sm, alignItems: "flex-end" }}>
      {multiline ? (
        <textarea ref={ref} value={text} rows={3} maxLength={MAX_INPUT_CHARS} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          style={{ ...inputStyle(), resize: "none", lineHeight: 1.4, flex: 1, minWidth: 0 }} />
      ) : (
        <input ref={ref} value={text} maxLength={MAX_INPUT_CHARS} placeholder={placeholder} inputMode={inputMode} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
      )}
      <button type="button" onClick={send} disabled={!text.trim() || busy} aria-label={t(OA.send)}
        style={{ width: TOUCH.min, height: TOUCH.min, flexShrink: 0, borderRadius: R.control, border: "none", cursor: text.trim() && !busy ? "pointer" : "not-allowed",
          background: text.trim() ? C.accent : C.surface, color: text.trim() ? C.bg : C.text3, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Send size={18} />
      </button>
    </div>
  );

  if (step === "venue") return textRow(t(OA.phVenue), { multiline: true });

  if (step === "when") {
    const ready = Number.isInteger(wd) && normTime(tm);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm }}>
          {[1, 2, 3, 4, 5, 6, 0].map((i) => (
            <OnboardingAiPill key={i} active={wd === i} onClick={() => setWd(i)} style={{ padding: 0 }}>
              {weekdayName(i, lang).slice(0, 3)}
            </OnboardingAiPill>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: S.md, fontSize: T.meta, color: C.text2 }}>
          <span style={{ flexShrink: 0 }}>{t(OA.kickoff)}</span>
          <input type="time" value={tm} onChange={(e) => setTm(e.target.value)} style={{ ...inputStyle(), width: 140, colorScheme: "dark" }} />
        </label>
        <BtnPrimary block disabled={!ready || busy}
          onClick={() => onPick({ weekday: wd, time: normTime(tm) }, `${weekdayName(wd, lang)} ${t(OA.at)} ${normTime(tm)}`)}>
          {t(OA.next)}
        </BtnPrimary>
        {textRow(t(OA.phWhen))}
      </div>
    );
  }

  if (step === "format") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: S.sm }}>
          {Object.keys(FORMATS).map((k) => (
            <OnboardingAiPill key={k} active={raw.format === k} onClick={() => onPick({ format: k, spots: FORMATS[k] }, FORMAT_LABEL(k))}>
              {FORMAT_LABEL(k)}
            </OnboardingAiPill>
          ))}
          <OnboardingAiPill active={otherOpen} onClick={() => setOtherOpen(true)}>{t(OA.other)}</OnboardingAiPill>
        </div>
        {otherOpen && (
          <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
            <label style={{ flex: 1, minWidth: 0, fontSize: T.meta, color: C.text2 }}>
              {t(OA.totalPlayers)}
              <input type="number" min={4} max={30} value={spots} onChange={(e) => setSpots(Number(e.target.value))} style={{ ...inputStyle(), marginTop: S.xs }} />
            </label>
            <BtnPrimary disabled={!(spots >= 4 && spots <= 30)} style={{ marginTop: 18 }}
              onClick={() => onPick({ format: "other", spots }, String(spots))}>
              {t(OA.next)}
            </BtnPrimary>
          </div>
        )}
      </div>
    );
  }

  if (step === "price") {
    const live = parseField("price", text);
    const p = normalizeProposal({ ...raw, ...live.raw, currency: live.raw.currency || raw.currency }, { lang });
    const perPlayer = perPlayerPrice(p.totalCost, p.spots);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
        {textRow(t(OA.phPrice), { inputMode: "decimal" })}
        <div style={{ fontSize: T.meta, color: perPlayer ? C.green : C.text3, minHeight: 16 }} aria-live="polite">
          {perPlayer ? tf(OA.perPlayerLive, { price: fmtMoney(perPlayer, p.currency, lang), spots: p.spots }) : " "}
        </div>
        <div><OnboardingAiPill onClick={() => onPick({ total_cost_eur: 0 }, t(OA.free))}>{t(OA.free)}</OnboardingAiPill></div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <input ref={ref} value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onPick({ group_name: name.trim() }, name.trim()); }}
          style={inputStyle()} />
        <div style={{ fontSize: T.meta, color: C.text2 }}>{t(OA.nameHint)}</div>
        <BtnPrimary block disabled={!name.trim()} onClick={() => onPick({ group_name: name.trim() }, name.trim())}>{t(OA.next)}</BtnPrimary>
      </div>
    );
  }
  return null;
}
