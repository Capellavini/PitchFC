// Google Analytics 4, behind consent.
//
// Nothing here talks to Google until (a) VITE_GA_MEASUREMENT_ID is set AND
// (b) the visitor accepted analytics (lib/consent.js). Declining — or never
// answering — means gtag.js is never even requested.
//
// Privacy rules baked in (see the Política de Privacidade, §Cookies):
//  - URLs are sent as origin + path ONLY. Magic-confirm (?confirm=), invite
//    (?join=), rating (?rate=) links carry secret tokens, and Supabase auth
//    redirects land with tokens in the query/hash — none may reach Google.
//  - No Google signals, no ad personalisation, consent mode "denied" for
//    every ad storage type. We never send names, emails, phones or ids.

import { hasAnalyticsConsent } from "./consent.js";

const GA_ID = import.meta.env?.VITE_GA_MEASUREMENT_ID || "";

/** True when a GA4 property is configured — gates whether the consent banner exists at all. */
export const analyticsConfigured = () => Boolean(GA_ID);

/** "https://pitch-fc.com/x?join=SECRET#frag" -> "https://pitch-fc.com/x". Unparseable/empty -> "". */
export function sanitizeUrl(href) {
  try {
    const u = new URL(href);
    return u.origin + u.pathname;
  } catch {
    return "";
  }
}

let started = false;   // gtag.js requested (only ever after a "yes")
let enabled = false;   // currently allowed to send

function gtag() { window.dataLayer.push(arguments); }

function start() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;
  window.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: false, // we send it ourselves, with a sanitised URL
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: sanitizeUrl(window.location.href),
    page_referrer: sanitizeUrl(document.referrer),
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
  started = true;
}

function clearGaCookies() {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = ["", host, ...(parts.length > 1 ? ["." + parts.slice(-2).join(".")] : [])];
  document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => /^(_ga|_gid|_gat)/.test(n)).forEach((name) => {
    domains.forEach((d) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
    });
  });
}

/** Reconcile GA with the stored consent. Returns true when analytics just
 *  switched ON — the caller then sends the page view the consent gate delayed. */
export function syncAnalyticsConsent() {
  if (!GA_ID || typeof window === "undefined") return false;
  const want = hasAnalyticsConsent();
  if (want && !enabled) {
    if (!started) start();
    window[`ga-disable-${GA_ID}`] = false;
    window.gtag("consent", "update", { analytics_storage: "granted" });
    enabled = true;
    return true;
  }
  if (!want && enabled) {
    window[`ga-disable-${GA_ID}`] = true;
    window.gtag("consent", "update", { analytics_storage: "denied" });
    clearGaCookies();
    enabled = false;
  }
  return false;
}

export function trackPageView() {
  if (!enabled) return;
  window.gtag("event", "page_view", {
    page_location: sanitizeUrl(window.location.href),
    page_title: document.title,
    page_referrer: sanitizeUrl(document.referrer),
  });
}

/** Funnel/engagement events. `params` must never carry personal data. */
export function trackEvent(name, params = {}) {
  if (!enabled) return;
  window.gtag("event", name, { ...params, page_location: sanitizeUrl(window.location.href) });
}
