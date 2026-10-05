// Treinador Adjunto — "numbers only from tools" guard (plan §7.5). Pure.
// Every numeric token in the model's final text must be grounded in the
// facts of this turn (snapshot + tool results + window + the organizer's
// own message). 1–3 are always allowed (ordinals / "os 2"), as are
// numbers the organizer wrote themselves.

// 7/8 · 3-1 · 21h · 21:00 · €4,50 · 1,6× · 75% · 10/10
const TOKEN = /\d+(?:[.,:/-]\d+)*(?:\s?%)?/g;

/** Canonical atom: "04" → "4", "4,50" → "4.5", "4.0" → "4". */
export function atom(s) {
  const t = String(s).replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return t;
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : t;
}

/** Numeric tokens of a text, each with its atoms. */
export function numericTokens(text) {
  return (String(text ?? "").match(TOKEN) || []).map((tok) => {
    const clean = tok.replace(/\s?%$/, "");
    // "4,50" / "1.6" is one decimal number, not two atoms.
    const parts = /^\d+[.,]\d{1,2}$/.test(clean) ? [clean] : clean.split(/[:/-]|(?<=\d)[.,](?=\d{3,})/);
    return { tok, atoms: parts.filter(Boolean).map(atom) };
  });
}

/** Set of atoms present in the facts (also splits decimals both ways, so
 *  "4.5" in a tool result grounds "4,50" in the text). */
export function factAtoms(factsText) {
  const set = new Set();
  for (const { atoms } of numericTokens(factsText)) atoms.forEach((a) => set.add(a));
  // cents → euros: 450 grounds 4.5
  for (const a of [...set]) if (/^\d{3,}$/.test(a)) set.add(atom(String(Number(a) / 100)));
  return set;
}

/** { ok, violations: [token…] }. */
export function numbersGrounded(text, factsText, { userText = "", allowSmall = 3 } = {}) {
  const facts = factAtoms(`${factsText}\n${userText}`);
  const violations = [];
  for (const { tok, atoms } of numericTokens(text)) {
    const ok = atoms.every((a) => facts.has(a) || (/^\d+$/.test(a) && Number(a) <= allowSmall));
    if (!ok) violations.push(tok.trim());
  }
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}
