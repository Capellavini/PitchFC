// ── Weather (Open-Meteo, no API key) ────────────────────────
// Passive info only — an icon + temperature next to the game's
// date/venue in JogoTab. No reschedule suggestion, no push, nothing
// automated: just "devo levar casaco?" at a glance.

import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from "lucide-react";

// WMO weather codes → icon + short PT label.
const CODE_MAP = {
  0: { Icon: Sun, label: "Céu limpo" },
  1: { Icon: CloudSun, label: "Pouco nublado" },
  2: { Icon: CloudSun, label: "Parcialmente nublado" },
  3: { Icon: Cloud, label: "Nublado" },
  45: { Icon: CloudFog, label: "Nevoeiro" },
  48: { Icon: CloudFog, label: "Nevoeiro" },
  51: { Icon: CloudDrizzle, label: "Chuvisco" },
  53: { Icon: CloudDrizzle, label: "Chuvisco" },
  55: { Icon: CloudDrizzle, label: "Chuvisco" },
  56: { Icon: CloudDrizzle, label: "Chuvisco gelado" },
  57: { Icon: CloudDrizzle, label: "Chuvisco gelado" },
  61: { Icon: CloudRain, label: "Chuva fraca" },
  63: { Icon: CloudRain, label: "Chuva" },
  65: { Icon: CloudRain, label: "Chuva forte" },
  66: { Icon: CloudRain, label: "Chuva gelada" },
  67: { Icon: CloudRain, label: "Chuva gelada" },
  71: { Icon: CloudSnow, label: "Neve fraca" },
  73: { Icon: CloudSnow, label: "Neve" },
  75: { Icon: CloudSnow, label: "Neve forte" },
  77: { Icon: CloudSnow, label: "Neve" },
  80: { Icon: CloudRain, label: "Aguaceiros" },
  81: { Icon: CloudRain, label: "Aguaceiros" },
  82: { Icon: CloudRain, label: "Aguaceiros fortes" },
  85: { Icon: CloudSnow, label: "Aguaceiros de neve" },
  86: { Icon: CloudSnow, label: "Aguaceiros de neve" },
  95: { Icon: CloudLightning, label: "Trovoada" },
  96: { Icon: CloudLightning, label: "Trovoada com granizo" },
  99: { Icon: CloudLightning, label: "Trovoada com granizo" },
};

export const weatherIconFor = (code) => CODE_MAP[code] ?? { Icon: Cloud, label: "—" };

const geocodeCacheKey = (venue) => `pitch_geocode_${venue.trim().toLowerCase()}`;

// Open-Meteo's geocoder only matches names of populated places (cities,
// towns, villages) — it can't find a specific stadium/field name. Venue
// text is usually "Nome do campo, Cidade" (or sometimes just a made-up
// venue name with no city at all), so we try the part after the last
// comma first (the city), then the raw string as a last resort.
function cityCandidates(venue) {
  const parts = venue.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? [parts[parts.length - 1], venue] : [venue];
}

async function geocodeOne(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const hits = (await res.json()).results || [];
  return hits.find((h) => h.country_code === "PT") || hits[0] || null;
}

/** Resolves free text to { lat, lon }, cached in localStorage so it's a
 *  one-time lookup per string, not a request per render. `candidates`
 *  lets callers offer fallback queries to try in order (e.g. the part
 *  of a venue string after the last comma, then the raw string). */
async function geocodeCached(text, candidates = [text]) {
  if (!text) return null;
  const cacheKey = geocodeCacheKey(text);
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore storage errors */ }

  try {
    for (const candidate of candidates) {
      const hit = await geocodeOne(candidate);
      if (hit) {
        const coords = { lat: hit.latitude, lon: hit.longitude };
        try { localStorage.setItem(cacheKey, JSON.stringify(coords)); } catch { /* ignore */ }
        return coords;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Forecast for a specific date (yyyy-mm-dd) at the given coordinates.
 *  Open-Meteo's free forecast covers ~16 days ahead — plenty for a
 *  weekly recurring game; returns null outside that range or on failure. */
async function fetchDailyForecast(lat, lon, dateISO) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const idx = data.daily?.time?.indexOf(dateISO);
    if (idx == null || idx < 0) return null;
    return {
      code: data.daily.weathercode[idx],
      tMax: Math.round(data.daily.temperature_2m_max[idx]),
      tMin: Math.round(data.daily.temperature_2m_min[idx]),
    };
  } catch {
    return null;
  }
}

/** Combines geocoding + forecast for a game's venue + kickoff date.
 *  `city`, if the organizer set one in group settings, is used directly
 *  (reliable — it's an actual place name) instead of guessing from the
 *  free-text venue, which is often just a court/field name that the
 *  geocoder can't resolve at all (e.g. "CCD 5v5"). Returns null
 *  (silently) if nothing can be resolved, the date is out of forecast
 *  range, or the network call fails — the caller just doesn't render
 *  the widget rather than showing an error. */
export async function fetchGameWeather(venue, kickoffDate, city) {
  if (!kickoffDate) return null;
  const resolved = city
    ? await geocodeCached(city, [city])
    : (venue ? await geocodeCached(venue, cityCandidates(venue)) : null);
  if (!resolved) return null;
  const dateISO = kickoffDate.toISOString().slice(0, 10);
  return fetchDailyForecast(resolved.lat, resolved.lon, dateISO);
}
