// Phone numbers: country dial code + national number, stored as E.164
// ("+351912345678"). Deliberately a tiny static table — no libphonenumber.
// Pure functions (no React / i18n), so they're unit-tested with node --test.

/** code = ISO 3166 alpha-2, dial = country calling code, min/max = national
 *  digit range AFTER removing any trunk 0, trunk0 = the leading 0 people type
 *  domestically must be dropped in international format (NOT Italy: the 0 of
 *  an Italian landline is part of the number). PT and BR first. */
export const COUNTRIES = [
  { code: "PT", dial: "351", min: 9, max: 9 },
  { code: "BR", dial: "55", min: 10, max: 11 },
  { code: "ES", dial: "34", min: 9, max: 9 },
  { code: "FR", dial: "33", min: 9, max: 9, trunk0: true },
  { code: "GB", dial: "44", min: 9, max: 10, trunk0: true },
  { code: "IE", dial: "353", min: 7, max: 9, trunk0: true },
  { code: "IT", dial: "39", min: 6, max: 11 },
  { code: "DE", dial: "49", min: 6, max: 13, trunk0: true },
  { code: "CH", dial: "41", min: 9, max: 9, trunk0: true },
  { code: "LU", dial: "352", min: 4, max: 11 },
  { code: "BE", dial: "32", min: 8, max: 9, trunk0: true },
  { code: "NL", dial: "31", min: 9, max: 9, trunk0: true },
  { code: "US", dial: "1", min: 10, max: 10 },
  { code: "AO", dial: "244", min: 9, max: 9 },
  { code: "CV", dial: "238", min: 7, max: 7 },
  { code: "MZ", dial: "258", min: 8, max: 9 },
  { code: "GW", dial: "245", min: 7, max: 9 },
  { code: "ST", dial: "239", min: 7, max: 7 },
  { code: "TL", dial: "670", min: 7, max: 8 },
];

const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));
export const countryByCode = (code) => BY_CODE[code] ?? BY_CODE.PT;

/** "PT" → "🇵🇹" (regional-indicator pair). */
export const flagOf = (code) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** Default country from the app language: pt-BR → BR, anything else → PT. */
export const defaultCountryFor = (lang) => (lang === "pt-br" ? "BR" : "PT");

const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");

/** Typed/pasted in international form ("+55 …" or "0055 …")? */
export const looksInternational = (s) => /^\s*(\+|00)/.test(String(s ?? ""));

/** Longest dial-code prefix of a digit string (no + / 00). */
export function countryFromDigits(d) {
  let best = null;
  for (const c of COUNTRIES) if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  return best;
}

/** Normalise a national number for a country: digits only, and drop the
 *  trunk 0 where the country uses one. Also forgives "351912…" typed into
 *  the national box of PT (dial code repeated without the +). */
export function nationalDigits(countryCode, national) {
  const c = countryByCode(countryCode);
  let d = onlyDigits(national);
  if (c.trunk0) d = d.replace(/^0+/, "");
  if (d.length > c.max && d.startsWith(c.dial) && d.length - c.dial.length >= c.min) d = d.slice(c.dial.length);
  return d;
}

/** (country, national) → "+<dial><national>", or "" when there are no digits.
 *  A national value that itself starts with + / 00 wins over the selector. */
export function toE164(countryCode, national) {
  if (looksInternational(national)) {
    const d = onlyDigits(national).replace(/^00/, "");
    return d ? `+${d}` : "";
  }
  const d = nationalDigits(countryCode, national);
  return d ? `+${countryByCode(countryCode).dial}${d}` : "";
}

/** Stored value → { country, national } for editing.
 *  - "+351912345678" / "00351…" → split by longest dial-code prefix
 *  - legacy national-only "912345678" (9 digits, starts with 9) → PT
 *  - legacy "351912345678" (12, no +) → PT; "55" + 10–11 digits → BR
 *  - legacy "11987654321" (BR mobile without 55: DDD + 9 + 8 digits) → BR
 *  - anything else → kept verbatim in the national box, default country. */
export function splitE164(value, defaultCountry = "PT") {
  const raw = String(value ?? "").trim();
  if (!raw) return { country: defaultCountry, national: "" };
  const d = onlyDigits(raw);
  if (looksInternational(raw)) {
    const full = d.replace(/^00/, "");
    const c = countryFromDigits(full);
    if (c) return { country: c.code, national: full.slice(c.dial.length) };
    return { country: defaultCountry, national: raw };
  }
  if (/^9\d{8}$/.test(d)) return { country: "PT", national: d };
  if (/^3519\d{8}$/.test(d)) return { country: "PT", national: d.slice(3) };
  if (/^55\d{10,11}$/.test(d)) return { country: "BR", national: d.slice(2) };
  if (/^[1-9][1-9]9\d{8}$/.test(d)) return { country: "BR", national: d };
  return { country: defaultCountry, national: raw };
}

/** Light, non-blocking validation → a hint id or null.
 *  "pt_mobile" | "too_short" | "too_long" (callers map ids to copy). */
export function phoneHint(countryCode, national) {
  if (!onlyDigits(national) || looksInternational(national)) return null;
  const c = countryByCode(countryCode);
  const d = nationalDigits(countryCode, national);
  if (c.code === "PT" && d.length === 9 && !d.startsWith("9")) return "pt_mobile";
  if (d.length < c.min) return "too_short";
  if (d.length > c.max) return "too_long";
  return null;
}

/** Stored-value normaliser for save paths: E.164 when the country is
 *  unambiguous (already international, or a legacy shape splitE164
 *  recognises), otherwise the value untouched — never guesses a country. */
export function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const a = splitE164(raw, "PT"), b = splitE164(raw, "BR");
  if (a.country !== b.country) return raw; // fell back to the default → ambiguous
  return toE164(a.country, a.national) || raw;
}

/** Display: "+351 912345678" (dial code split off); anything else as-is. */
export function formatPhone(value) {
  const raw = String(value ?? "").trim();
  if (!looksInternational(raw)) return raw;
  const c = countryFromDigits(onlyDigits(raw).replace(/^00/, ""));
  return c ? `+${c.dial} ${onlyDigits(raw).replace(/^00/, "").slice(c.dial.length)}` : raw;
}
