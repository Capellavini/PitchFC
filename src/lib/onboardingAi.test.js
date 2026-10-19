import test from "node:test";
import assert from "node:assert/strict";
import {
  parseField, parseLocal, looksLikeSentence, answeredSteps, normalizeProposal, toGroupForm, canCreate,
  perPlayerPrice, roundHalfUp, normTime, openWeekdayFor, nextOccurrence, inviteText, defaultGroupName,
  validateRequestBody, sanitizeFieldRaw, FIELD_SCHEMAS, estCostMicros, SPOTS_MAX, SPOTS_MIN,
} from "./onboardingAi.js";

const EXAMPLE = "Jogamos às quintas às 21h no Campo X, somos uns 14, 5 contra 5, pagamos 60 € o campo.";

test("the owner's example sentence parses fully, locally", () => {
  assert.ok(looksLikeSentence(EXAMPLE));
  const p = normalizeProposal(parseLocal(EXAMPLE));
  assert.equal(p.venue, "Campo X");
  assert.equal(p.weekday, 4);
  assert.equal(p.time, "21:00");
  assert.equal(p.format, "5v5");
  assert.equal(p.spots, 10);
  assert.equal(p.rosterSize, 14);
  assert.equal(p.totalCost, 60);
  assert.equal(p.pricePerPlayer, 6);
  assert.equal(p.currency, "EUR");
  assert.equal(p.groupName, "Futebol de Quinta");
  assert.ok(p.groupNameSuggested);
  assert.deepEqual(p.missingFields, []);
  assert.deepEqual([...answeredSteps(parseLocal(EXAMPLE))].sort(), ["format", "price", "venue", "when"]);
});

test("sentence variants: PT-BR / EN / per-player price", () => {
  const br = normalizeProposal(parseLocal("Jogamos às terças às 20h na Arena Society Morumbi, fut7, R$ 420 o campo"), { lang: "pt-br" });
  assert.equal(br.currency, "BRL"); assert.equal(br.spots, 14); assert.equal(br.pricePerPlayer, 30); assert.equal(br.venue, "Arena Society Morumbi");
  const en = normalizeProposal(parseLocal("We play every Tuesday at 8pm at Goals Lisboa, 5-a-side, pitch costs €50"), { lang: "en" });
  assert.equal(en.venue, "Goals Lisboa"); assert.equal(en.time, "20:00"); assert.equal(en.totalCost, 50); assert.equal(en.groupName, "Tuesday Football");
  const each = normalizeProposal(parseLocal("Sábados 10h30 no Pavilhão da Lapa, 7x7, 8€ cada"));
  assert.equal(each.totalCost, 112); assert.equal(each.pricePerPlayer, 8);
  assert.equal(looksLikeSentence("Campo X"), false);
});

test("guided answers parse locally (0 AI calls for typical answers)", () => {
  const cases = [
    ["venue", "Campo X", { venue_name: "Campo X" }],
    ["venue", "no Pavilhão da Lapa", { venue_name: "Pavilhão da Lapa" }],
    ["when", "quinta 21h", { weekday: 4, time: "21:00" }],
    ["when", "Saturday 9am", { weekday: 6, time: "09:00" }],
    ["when", "sábados às 10:30", { weekday: 6, time: "10:30" }],
    ["format", "7", { format: "7v7", spots: 14 }],
    ["format", "5 contra 5", { format: "5v5", spots: 10 }],
    ["format", "14 jogadores", { format: "7v7", spots: 14 }],
    ["price", "60", { total_cost_eur: 60 }],
    ["price", "uns 60 paus o campo", { total_cost_eur: 60 }],
    ["price", "8€ cada", { price_per_player_eur: 8, currency: "EUR" }],
    ["price", "não pagamos", { total_cost_eur: 0, free: true }],
    ["name", "Fut do Burger", { group_name: "Fut do Burger" }],
  ];
  for (const [field, text, expected] of cases) {
    const r = parseField(field, text);
    assert.ok(r.confident, `${field}: "${text}" should be confident`);
    for (const [k, v] of Object.entries(expected)) assert.deepEqual(r.raw[k], v, `${field}: "${text}" → ${k}`);
  }
});

test("vague answers are NOT confident (these are the only AI calls)", () => {
  assert.equal(parseField("when", "às quintas depois do trabalho").confident, false);
  assert.equal(parseField("when", "às quintas depois do trabalho").raw.weekday, 4); // partial kept
  assert.equal(parseField("price", "sessenta").confident, false);
  assert.equal(parseField("venue", "perto do trabalho, num sintético").confident, false);
  assert.equal(parseField("format", "não sei bem").confident, false);
  assert.equal(parseField("venue", "").confident, false);
});

test("normalisation clamps and defaults", () => {
  assert.equal(normalizeProposal({ spots: 99 }).spots, SPOTS_MAX);
  assert.equal(normalizeProposal({ spots: 1 }).spots, SPOTS_MIN);
  assert.equal(normalizeProposal({ spots: 11 }).spots, 12); // even teams
  assert.equal(normalizeProposal({ format: "11v11" }).spots, 22);
  assert.equal(normalizeProposal({ format: "7v7", spots: 10 }).format, "5v5"); // spots wins, format follows
  assert.equal(normalizeProposal({ weekday: 9 }).weekday, null);
  assert.equal(normalizeProposal({ weekday: "3" }).weekday, 3);
  assert.equal(normalizeProposal({ time: "25:00" }).time, null);
  assert.deepEqual(normalizeProposal({}).confirmationsOpen, { daysBefore: 2, time: "10:00" });
  assert.deepEqual(normalizeProposal({ confirmations_open: { days_before: 9, time: "x" } }).confirmationsOpen, { daysBefore: 2, time: "10:00" });
  assert.equal(normalizeProposal({ total_cost_eur: -5 }).totalCost, 0);
  assert.equal(normalizeProposal({ venue_name: "<script>Campo</script>" }).venue.includes("<"), false);
  assert.equal(normalizeProposal({}, { lang: "pt-br" }).currency, "BRL");
  assert.equal(normalizeProposal({ currency: "EUR" }, { lang: "pt-br" }).currency, "EUR");
  assert.deepEqual(normalizeProposal({}).missingFields, ["venue", "weekday", "time", "price"]);
  assert.deepEqual(normalizeProposal({ total_cost_eur: 0 }).missingFields.includes("price"), false); // "não pagamos" is an answer
});

test("price split rounds UP to 0.50", () => {
  assert.equal(roundHalfUp(5.71), 6);
  assert.equal(roundHalfUp(5.2), 5.5);
  assert.equal(roundHalfUp(6), 6);
  assert.equal(perPlayerPrice(60, 10), 6);
  assert.equal(perPlayerPrice(80, 14), 6);
  assert.equal(perPlayerPrice(45, 10), 4.5);
  assert.equal(perPlayerPrice(0, 10), 0);
  assert.equal(perPlayerPrice(60, 0), 0);
});

test("time / weekday helpers", () => {
  assert.equal(normTime("21h"), "21:00");
  assert.equal(normTime("9"), "09:00");
  assert.equal(normTime("21:3"), "21:30");
  assert.equal(normTime("21h30"), "21:30");
  assert.equal(normTime("abc"), null);
  assert.equal(openWeekdayFor(4, 2), 2); // Thursday game → Tuesday
  assert.equal(openWeekdayFor(0, 2), 5); // Sunday game → Friday
  assert.equal(openWeekdayFor(1, 3), 5);
});

test("next occurrence is Europe/Lisbon wall-clock, DST-safe", () => {
  // Mon 19 Oct 2026 11:00 Lisbon (WEST, UTC+1) → Thu 22 Oct 21:00 Lisbon = 20:00Z
  assert.equal(nextOccurrence(4, "21:00", new Date("2026-10-19T10:00:00Z")).toISOString(), "2026-10-22T20:00:00.000Z");
  // Across the DST change (25 Oct 2026): Thu 29 Oct 21:00 Lisbon (WET, UTC+0) = 21:00Z
  assert.equal(nextOccurrence(4, "21:00", new Date("2026-10-23T10:00:00Z")).toISOString(), "2026-10-29T21:00:00.000Z");
  // Same day, already passed → next week
  assert.equal(nextOccurrence(1, "09:00", new Date("2026-10-19T10:00:00Z")).toISOString(), "2026-10-26T09:00:00.000Z");
  // Same day, still ahead → today
  assert.equal(nextOccurrence(1, "21:00", new Date("2026-10-19T10:00:00Z")).toISOString(), "2026-10-19T20:00:00.000Z");
});

test("toGroupForm feeds the existing create path", () => {
  const p = normalizeProposal(parseLocal(EXAMPLE));
  assert.ok(canCreate(p));
  assert.deepEqual(toGroupForm(p), {
    groupName: "Futebol de Quinta", venue: "Campo X", city: "", weekday: 4, time: "21:00",
    monthlyPrice: 60, maxPlayers: 10, recurring: true, openWeekday: 2, openTime: "10:00", skipSchedule: false,
  });
  assert.equal(canCreate(normalizeProposal({ venue_name: "X" })), false); // no weekday/time
});

test("invite text in the three languages carries the link", () => {
  const base = { groupName: "Fut do Burger", venue: "Campo X", weekday: 4, time: "21:00", link: "https://pitch-fc.com/?join=abc", pricePerPlayer: 6 };
  const pt = inviteText({ ...base, lang: "pt" });
  assert.match(pt, /Todas as quintas às 21:00/); assert.match(pt, /6 € por jogador/); assert.match(pt, /\?join=abc/); assert.match(pt, /Entra aqui/);
  const br = inviteText({ ...base, currency: "BRL", pricePerPlayer: 30, lang: "pt-br" });
  assert.match(br, /R\$ 30 por pessoa/); assert.match(br, /Entre por aqui/);
  const en = inviteText({ ...base, weekday: 6, lang: "en" });
  assert.match(en, /Every Saturday at 21:00/); assert.match(en, /€6 each/);
  assert.match(inviteText({ ...base, weekday: 6 }), /Todos os sábados/);
  assert.doesNotMatch(inviteText({ ...base, pricePerPlayer: 0 }), /por jogador/);
});

test("default group names", () => {
  assert.equal(defaultGroupName({ weekday: 6 }), "Futebol de Sábado");
  assert.equal(defaultGroupName({ weekday: 2, lang: "en" }), "Tuesday Football");
  assert.equal(defaultGroupName({ venue: "Campo X" }), "Malta do Campo X");
  assert.equal(defaultGroupName({}), "Futebol Semanal");
});

test("request validation", () => {
  assert.deepEqual(validateRequestBody({ field: "when", text: "  quintas depois do trabalho ", lang: "xx" }), { field: "when", text: "quintas depois do trabalho", lang: "pt" });
  assert.throws(() => validateRequestBody({ field: "nope", text: "x" }), /bad_field/);
  assert.throws(() => validateRequestBody({ field: "when", text: " " }), /empty/);
  assert.throws(() => validateRequestBody({ field: "when", text: "x".repeat(601) }), /too_long/);
  assert.throws(() => validateRequestBody(null), /bad_body/);
});

test("field schemas are strict-compatible and the sanitiser keeps only that field", () => {
  const walk = (s) => {
    if (s.type === "object") {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    for (const k of ["minimum", "maximum", "minLength", "maxLength"]) assert.equal(k in s, false);
  };
  Object.values(FIELD_SCHEMAS).forEach(walk);
  assert.deepEqual(sanitizeFieldRaw("when", { weekday: 4, time: "21h", recurring: true, venue_name: "sneaky" }), { weekday: 4, time: "21:00", recurring: true });
  assert.deepEqual(sanitizeFieldRaw("price", { total_cost_eur: 60, currency: "USD" }), { total_cost_eur: 60 });
  assert.deepEqual(sanitizeFieldRaw("format", { format: "9v9", spots: 99 }), {});
  assert.deepEqual(sanitizeFieldRaw("venue", { venue_name: "  Campo <b>X</b> ", venue_address: null }), { venue_name: "Campo b X /b" });
});

test("cost estimate (Haiku 4.5: $1 / $5 per MTok)", () => {
  assert.equal(estCostMicros("claude-haiku-4-5", { input_tokens: 600, output_tokens: 80 }), 1000);
  assert.equal(estCostMicros("unknown-model", { input_tokens: 1000, output_tokens: 0 }), 1000);
});
