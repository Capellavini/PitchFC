import test from "node:test";
import assert from "node:assert/strict";
import { dominantColor, onColor, safeLogo } from "./leagueBrand.js";

const px = (rgbaList) => Uint8ClampedArray.from(rgbaList.flat());
const many = (c, n) => Array.from({ length: n }, () => c);

test("the colour comes from the logo, not from its white background", () => {
  const data = px([...many([255, 255, 255, 255], 800), ...many([0, 82, 204, 255], 200)]);
  const c = dominantColor(data);
  assert.match(c, /^#[0-9A-F]{6}$/);
  assert.equal(c, "#0052CC");
});

test("a vivid minority beats a dull majority", () => {
  const data = px([...many([120, 110, 100, 255], 500), ...many([220, 30, 40, 255], 300)]);
  assert.equal(dominantColor(data), "#DC1E28");
});

test("black, white, grey and transparent pixels give no colour", () => {
  assert.equal(dominantColor(px([...many([0, 0, 0, 255], 50), ...many([255, 255, 255, 255], 50), ...many([128, 128, 128, 255], 50), ...many([200, 0, 0, 0], 50)])), null);
  assert.equal(dominantColor(new Uint8ClampedArray(0)), null);
});

test("onColor picks readable text", () => {
  assert.equal(onColor("#C8FF00"), "#000000");
  assert.equal(onColor("#1B3A8C"), "#FFFFFF");
  assert.equal(onColor("nope"), "#000000");
});

test("safeLogo only lets small PNG data URLs through", () => {
  assert.equal(safeLogo("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safeLogo("data:image/svg+xml;base64,AAAA"), null);
  assert.equal(safeLogo("javascript:alert(1)"), null);
  assert.equal(safeLogo("https://x.test/a.png"), null);
  assert.equal(safeLogo(null), null);
});
