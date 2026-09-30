// node --test src/lib/phone.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toE164, splitE164, phoneHint, normalizePhone, formatPhone, flagOf, defaultCountryFor, COUNTRIES } from "./phone.js";

test("country list: PT and BR first, dial codes unique", () => {
  assert.deepEqual(COUNTRIES.slice(0, 2).map((c) => c.code), ["PT", "BR"]);
  assert.equal(new Set(COUNTRIES.map((c) => c.dial)).size, COUNTRIES.length);
  assert.equal(flagOf("PT"), "🇵🇹");
  assert.equal(defaultCountryFor("pt-br"), "BR");
  assert.equal(defaultCountryFor("pt"), "PT");
  assert.equal(defaultCountryFor("en"), "PT");
});

test("toE164: strips formatting, trunk 0 only where the country uses one", () => {
  assert.equal(toE164("PT", "912 345 678"), "+351912345678");
  assert.equal(toE164("BR", "(11) 98765-4321"), "+5511987654321");
  assert.equal(toE164("GB", "07911 123456"), "+447911123456");
  assert.equal(toE164("FR", "06 12 34 56 78"), "+33612345678");
  assert.equal(toE164("DE", "0151 23456789"), "+4915123456789");
  assert.equal(toE164("IT", "06 1234 5678"), "+390612345678"); // Italy keeps its 0
  assert.equal(toE164("PT", ""), "");
  assert.equal(toE164("PT", "  "), "");
});

test("toE164: international text in the national box wins; repeated dial code forgiven", () => {
  assert.equal(toE164("PT", "+55 11 98765 4321"), "+5511987654321");
  assert.equal(toE164("PT", "0034 612 345 678"), "+34612345678");
  assert.equal(toE164("PT", "351912345678"), "+351912345678");
});

test("splitE164: international values", () => {
  assert.deepEqual(splitE164("+351912345678"), { country: "PT", national: "912345678" });
  assert.deepEqual(splitE164("+5511987654321"), { country: "BR", national: "11987654321" });
  assert.deepEqual(splitE164("00353 87 123 4567"), { country: "IE", national: "871234567" });
  assert.deepEqual(splitE164("+244912345678"), { country: "AO", national: "912345678" });
  assert.deepEqual(splitE164("+12125551234"), { country: "US", national: "2125551234" });
});

test("splitE164: legacy values", () => {
  assert.deepEqual(splitE164("912 345 678", "BR"), { country: "PT", national: "912345678" });
  assert.deepEqual(splitE164("351912345678", "BR"), { country: "PT", national: "912345678" });
  assert.deepEqual(splitE164("5511987654321"), { country: "BR", national: "11987654321" });
  assert.deepEqual(splitE164("11987654321"), { country: "BR", national: "11987654321" });
  assert.deepEqual(splitE164("223 456 789", "PT"), { country: "PT", national: "223 456 789" }); // kept as-is
  assert.deepEqual(splitE164("", "BR"), { country: "BR", national: "" });
  assert.deepEqual(splitE164(null), { country: "PT", national: "" });
});

test("round trip", () => {
  for (const v of ["+351912345678", "+5511987654321", "+447911123456", "+390612345678", "+2389912345"]) {
    const { country, national } = splitE164(v);
    assert.equal(toE164(country, national), v, v);
  }
});

test("phoneHint: light validation", () => {
  assert.equal(phoneHint("PT", "912345678"), null);
  assert.equal(phoneHint("PT", "223456789"), "pt_mobile");
  assert.equal(phoneHint("PT", "91234"), "too_short");
  assert.equal(phoneHint("PT", "9123456789"), "too_long");
  assert.equal(phoneHint("BR", "1198765432"), null);
  assert.equal(phoneHint("BR", "11987654321"), null);
  assert.equal(phoneHint("BR", "119876543"), "too_short");
  assert.equal(phoneHint("GB", "07911123456"), null);
  assert.equal(phoneHint("PT", ""), null);
});

test("normalizePhone: only unambiguous values become E.164", () => {
  assert.equal(normalizePhone("912 345 678"), "+351912345678");
  assert.equal(normalizePhone("+351 912 345 678"), "+351912345678");
  assert.equal(normalizePhone("0055 11 98765 4321"), "+5511987654321");
  assert.equal(normalizePhone("223456789"), "223456789"); // no guess
  assert.equal(normalizePhone(""), "");
});

test("formatPhone", () => {
  assert.equal(formatPhone("+351912345678"), "+351 912345678");
  assert.equal(formatPhone("+5511987654321"), "+55 11987654321");
  assert.equal(formatPhone("912345678"), "912345678");
  assert.equal(formatPhone(null), "");
});
