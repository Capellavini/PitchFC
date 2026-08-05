/** Reads a bilingual `{ pt, en }` value for the given language. Falls back to
 *  pt (or returns the value itself) so a field saved before bilingual support
 *  existed, or missing an EN translation, never renders blank. */
export function t(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.pt ?? value.en ?? "";
}

export const emptyBi = () => ({ pt: "", en: "" });
