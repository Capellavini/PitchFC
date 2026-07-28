-- ─────────────────────────────────────────────────────────
-- Migration 22 — group city (for weather geocoding)
--
-- Open-Meteo's free geocoder only resolves city/town names, not
-- specific venue names ("CCD 5v5", "Campo 1"...). Decoupling "city"
-- (for weather lookup) from "venue" (the display text organizers
-- already free-type) makes the forecast reliable regardless of how
-- the venue is named.
-- ─────────────────────────────────────────────────────────

alter table public.groups add column if not exists city text;
