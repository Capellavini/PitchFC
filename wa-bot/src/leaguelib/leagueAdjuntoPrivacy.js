// GENERATED from src/lib — do not edit; run npm run sync:core
// What never leaves the browser or the server in clear text on its way to the
// model: e-mails, phone numbers, long digit runs (licences, ID numbers) and
// "licença nº …" style references. Rosters and match sheets are full of them
// and the Adjunto only needs names, numbers (≤ 3 digits) and positions.
const PRIVATE = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\+\d[\d\s().-]{7,}\d/g,
  /licen[çc]a\s*(?:n[.º°o]*\s*)?[:#-]?\s*[A-Za-z0-9-]*\d[A-Za-z0-9-]*/gi,
  /\b\d[\d .-]{4,}\d\b(?!:)/g, // 6+ digits, optionally spaced: ids, tax numbers, mobiles
];
const MASK = "[removido]";

/** @returns {{text: string, removed: number}} */
export function redactPrivate(input) {
  let removed = 0;
  let text = String(input ?? "");
  for (const rx of PRIVATE) {
    text = text.replace(rx, (m) => {
      // dates and times are not private: 2026-11-07, 07/11/2026, 15:00
      if (/^\d{4}-\d{2}-\d{2}$/.test(m) || /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(m)) return m;
      removed += 1;
      return MASK;
    });
  }
  return { text, removed };
}
