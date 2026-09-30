import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, S, R, T, TOUCH } from "../theme";
import { t, getLang } from "../lib/i18n";
import { COUNTRIES, countryByCode, flagOf, defaultCountryFor, splitE164, toE164, looksInternational, countryFromDigits, phoneHint } from "../lib/phone";

const HINTS = {
  pt_mobile: "Os telemóveis portugueses começam por 9.",
  too_short: "Este número parece curto demais — confirma.",
  too_long: "Este número parece longo demais — confirma.",
};

/** Country selector ("🇵🇹 +351") + national number. `value` is the stored
 *  phone (E.164, or a legacy national-only string); `onChange` always gets
 *  E.164 ("" when empty). A pasted "+55 …" / "0055 …" switches the country.
 *  The country picker is a native <select> laid transparently over the
 *  flag/dial label, so phones get their own picker UI.
 *  `mbwayHint` shows the "MB Way only works with PT numbers" note. */
export default function PhoneInput({ value, onChange, onEnter, placeholder, mbwayHint = false, autoFocus = false }) {
  const [state, setState] = useState(() => splitE164(value, defaultCountryFor(getLang())));
  const lastEmitted = useRef(value ?? "");

  // External value change (e.g. form reset on Cancel) → re-split.
  useEffect(() => {
    if ((value ?? "") !== lastEmitted.current) {
      lastEmitted.current = value ?? "";
      setState(splitE164(value, defaultCountryFor(getLang())));
    }
  }, [value]);

  const emit = (next) => {
    setState(next);
    const e164 = toE164(next.country, next.national);
    lastEmitted.current = e164;
    onChange(e164);
  };

  const onNational = (raw) => {
    if (looksInternational(raw)) {
      const d = raw.replace(/\D/g, "").replace(/^00/, "");
      const c = countryFromDigits(d);
      // Only split once the dial code is unambiguous and something follows it.
      if (c && d.length > c.dial.length + 2) return emit({ country: c.code, national: d.slice(c.dial.length) });
    }
    emit({ ...state, national: raw });
  };

  const country = countryByCode(state.country);
  const hintId = phoneHint(state.country, state.national);
  const box = { minHeight: TOUCH.min, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control };

  return (
    <div>
      <div style={{ display: "flex", gap: S.sm }}>
        <div style={{ ...box, position: "relative", display: "flex", alignItems: "center", gap: S.xs, padding: `0 ${S.sm + 2}px`, flexShrink: 0 }}>
          <span aria-hidden style={{ fontSize: T.body + 2, lineHeight: 1 }}>{flagOf(country.code)}</span>
          <span aria-hidden style={{ fontSize: T.body, fontWeight: 700, color: C.text1 }}>+{country.dial}</span>
          <ChevronDown aria-hidden size={14} color={C.text2} />
          <select
            aria-label={t("Indicativo do país")}
            value={country.code}
            onChange={(e) => emit({ ...state, country: e.target.value })}
            style={{ position: "absolute", inset: -1, width: "calc(100% + 2px)", height: "calc(100% + 2px)", opacity: 0, cursor: "pointer", fontSize: 16 }}
          >
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{`${flagOf(c.code)} ${c.code} +${c.dial}`}</option>)}
          </select>
        </div>
        <input
          type="tel" inputMode="tel" autoComplete="tel-national" autoFocus={autoFocus}
          value={state.national} placeholder={placeholder ?? (country.code === "BR" ? "11 91234 5678" : country.code === "PT" ? "912 345 678" : "")}
          onChange={(e) => onNational(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          style={{ ...box, flex: 1, minWidth: 0, width: "100%", padding: `0 ${S.md}px`, fontSize: T.body, color: C.text1, outline: "none" }}
        />
      </div>
      {hintId && <div style={{ fontSize: T.min, color: C.orange, marginTop: S.xs }}>{t(HINTS[hintId])}</div>}
      {mbwayHint && country.code !== "PT" && (
        <div style={{ fontSize: T.min, color: C.text2, marginTop: S.xs }}>{t("MB Way só funciona com números portugueses.")}</div>
      )}
    </div>
  );
}
