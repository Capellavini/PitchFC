// Which pricing market (EU / BR) does this visitor belong to?
//
// Decided by the country the hosting edge sees for the request (api/geo.js →
// the `x-vercel-ip-country` header) — a COMMERCIAL market setting only, not a
// tax-residency determination. Brazil → BR; everything else (Portugal, the
// rest of Europe, anywhere else) → EU. If detection is unavailable the page
// falls back to the UI language (see marketFromLang in plans.js).

const CACHE_KEY = "pitch.v2.geoMarket";

/** ISO country code → pricing market. Unknown/missing → null (caller falls back). */
export const marketFromCountry = (country) => {
  const cc = typeof country === "string" ? country.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  return cc === "BR" ? "BR" : "EU";
};

const safeStorage = () => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };

/** Cached answer for this tab session (so a reload doesn't flash the wrong price). */
export function cachedMarket(storage = safeStorage()) {
  try {
    const v = storage?.getItem(CACHE_KEY);
    return v === "EU" || v === "BR" ? v : null;
  } catch { return null; }
}

/**
 * Ask /api/geo. Resolves to "EU" | "BR", or null when detection isn't
 * available (offline, local dev without the edge function, timeout…).
 * Never throws.
 */
export async function detectMarket({ fetchImpl = globalThis.fetch, timeoutMs = 2000, storage = safeStorage(), url = "/api/geo" } = {}) {
  const cached = cachedMarket(storage);
  if (cached) return cached;
  if (typeof fetchImpl !== "function") return null;
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, { cache: "no-store", signal: ctrl?.signal });
    if (!res.ok) return null;
    const market = marketFromCountry((await res.json())?.country);
    if (market) { try { storage?.setItem(CACHE_KEY, market); } catch { /* not cached */ } }
    return market;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
