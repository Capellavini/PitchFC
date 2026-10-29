import test from "node:test";
import assert from "node:assert/strict";
import { dominantColor, onColor, safeLogo, validColor, onDarkText } from "./leagueBrand.js";

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

test("validColor only lets a real #RRGGBB through", () => {
  assert.equal(validColor("#1b3a8c"), "#1B3A8C");
  for (const bad of ["", null, undefined, "red", "#fff", "#12345G", "1B3A8C", "#1B3A8C00", "url(x)"]) assert.equal(validColor(bad), null, String(bad));
});

test("onDarkText lightens a dark league colour until it reads on the dark background, and keeps a light one", () => {
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const navy = onDarkText("#1B3A8C");
  assert.ok(lum(navy) >= 0.5 && /^#[0-9A-F]{6}$/.test(navy), navy);
  assert.equal(onDarkText("#C8FF00"), "#C8FF00");
  assert.equal(onDarkText(null), "#C8FF00");
  assert.equal(onDarkText("nope", "#FFFFFF"), "#FFFFFF");
  assert.ok(lum(onDarkText("#000000")) >= 0.5, "even black becomes legible");
});
