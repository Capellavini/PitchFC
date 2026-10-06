import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/messages.js";

const game = { scheduled_at: "2026-10-10T19:00:00Z", venue: null };
const link = "https://pitch-fc.com/x";

test("confirmed is never shown above spots — the waiting line isn't a confirmation", () => {
  for (const lang of ["pt", "ptbr", "en", "pt+en"]) {
    for (const kind of ["milestone", "matchday", "reminder", "promoted", "spot_opened"]) {
      const text = render(kind, { game, confirmed: 16, spots: 15, link }, lang);
      assert.doesNotMatch(text, /16\/15/, `${kind}/${lang}: ${text}`);
      assert.doesNotMatch(text, /\b16 (confirm|in\b)/, `${kind}/${lang}: ${text}`);
    }
  }
});

test("milestone with a waiting line reads 15/15 + the queue", () => {
  const text = render("milestone", { game, confirmed: 16, spots: 15, link }, "pt");
  assert.match(text, /15\/15/);
  assert.match(text, /1 na lista de espera/);
});

test("exactly full still says closed, with no queue", () => {
  assert.match(render("milestone", { game, confirmed: 15, spots: 15, link }, "pt"), /Jogo fechado!\* 15\/15/);
  assert.match(render("matchday", { game, confirmed: 17, spots: 15, link }, "pt"), /15\/15 confirmados — jogo fechado/);
});
