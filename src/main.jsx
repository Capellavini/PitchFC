import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PitchApp from "./PitchApp.jsx";
import CookieConsent from "./components/CookieConsent.jsx";
import { getThemeMode, applyThemeMode } from "./lib/themeMode.js";
import { applyRouteMeta } from "./lib/seo.js";
import { syncAnalyticsConsent, trackPageView } from "./lib/analytics.js";
import { subscribe as onConsentChange } from "./lib/consent.js";

// Applied before the first render (not just in a PitchApp effect) so a
// saved "light" preference never flashes dark component colors first.
applyThemeMode(getThemeMode());

// Search-engine metadata for this route (title, description, canonical, noindex).
applyRouteMeta();

// Analytics only ever starts after a stored "yes"; a "yes" given later (via
// the banner) starts it then, and sends the page view the gate delayed.
if (syncAnalyticsConsent()) trackPageView();
onConsentChange(() => { if (syncAnalyticsConsent()) trackPageView(); });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PitchApp />
    <CookieConsent />
  </React.StrictMode>
);
