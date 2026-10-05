import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, analyticsConfigured, syncAnalyticsConsent, trackEvent, trackPageView } from "./analytics.js";
import { routeMeta } from "./seo.js";
import {
  getConsent, hasAnalyticsConsent, setAnalyticsConsent, openPreferences, closePreferences,
  isPreferencesOpen, subscribe, getVersion,
} from "./consent.js";

// ── URL sanitising: tokens must never reach Google ───────────────────────
test("sanitizeUrl keeps origin + path, drops query and hash", () => {
  assert.equal(sanitizeUrl("https://pitch-fc.com/?confirm=SECRET123"), "https://pitch-fc.com/");
  assert.equal(sanitizeUrl("https://pitch-fc.com/?join=abc&x=1#access_token=zzz"), "https://pitch-fc.com/");
  assert.equal(sanitizeUrl("https://pitch-fc.com/privacidade#cookies"), "https://pitch-fc.com/privacidade");
});
test("sanitizeUrl never throws on empty/garbage input", () => {
  assert.equal(sanitizeUrl(""), "");
  assert.equal(sanitizeUrl("not a url"), "");
  assert.equal(sanitizeUrl(undefined), "");
});

// ── Without a GA property or consent, analytics is inert ─────────────────
test("analytics is a silent no-op with no measurement id (as in dev / tests)", () => {
  assert.equal(analyticsConfigured(), false);
  assert.equal(syncAnalyticsConsent(), false);
  assert.doesNotThrow(() => { trackEvent("sign_up", { method: "email" }); trackPageView(); });
});

// ── Per-route head metadata ───────────────────────────────────────────────
test("home is indexable and canonicalises to the site root", () => {
  const m = routeMeta("/", "");
  assert.equal(m.canonical, "https://pitch-fc.com/");
  assert.equal(m.noindex, false);
});
test("legal pages canonicalise to themselves, not the homepage", () => {
  assert.equal(routeMeta("/privacidade", "").canonical, "https://pitch-fc.com/privacidade");
  assert.equal(routeMeta("/termos/", "").canonical, "https://pitch-fc.com/termos"); // trailing slash normalised
  assert.equal(routeMeta("/termos", "").noindex, false);
});
test("shared-by-link and owner-only routes are noindex", () => {
  for (const p of ["/pro", "/pitch-deck", "/roadmap", "/admin"]) assert.equal(routeMeta(p, "").noindex, true, p);
});
test("one-time token links are noindex even on an otherwise indexable path", () => {
  for (const q of ["?join=abc", "?confirm=abc", "?rate=abc", "?admin=1"]) {
    assert.equal(routeMeta("/", q).noindex, true, q);
  }
  assert.equal(routeMeta("/", "?utm_source=instagram").noindex, false); // campaign links stay indexable
});
test("unknown paths (SPA fallback serves 200 for anything) are noindex and canonicalise home", () => {
  const m = routeMeta("/does-not-exist", "");
  assert.equal(m.noindex, true);
  assert.equal(m.canonical, "https://pitch-fc.com/");
});

// ── Consent ───────────────────────────────────────────────────────────────
test("consent starts undecided, and undecided means no analytics", () => {
  assert.equal(getConsent(), null);
  assert.equal(hasAnalyticsConsent(), false);
});
test("accepting and declining are both recorded, and notify subscribers", () => {
  let calls = 0;
  const off = subscribe(() => { calls += 1; });
  const v0 = getVersion();

  setAnalyticsConsent(true);
  assert.equal(hasAnalyticsConsent(), true);
  assert.equal(getConsent().analytics, true);

  setAnalyticsConsent(false); // withdrawing is as easy as granting
  assert.equal(hasAnalyticsConsent(), false);
  assert.equal(getConsent().analytics, false);

  assert.equal(calls, 2);
  assert.ok(getVersion() > v0);
  off();
});
test("preferences can be re-opened on purpose and closes once a choice is made", () => {
  assert.equal(isPreferencesOpen(), false);
  openPreferences();
  assert.equal(isPreferencesOpen(), true);
  setAnalyticsConsent(true);
  assert.equal(isPreferencesOpen(), false);
  openPreferences(); closePreferences();
  assert.equal(isPreferencesOpen(), false);
});
