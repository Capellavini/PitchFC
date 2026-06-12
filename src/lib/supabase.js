import { createClient } from "@supabase/supabase-js";

// Keys live in .env.local (never committed — see env.example).
// Without them the app keeps working on localStorage only.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);
export const supabase = supabaseEnabled ? createClient(url, key) : null;

// The seed maps the prototype's numeric player ids onto deterministic
// uuids (…-000000000001 = player 1). Bridges both id schemes during
// the localStorage → Supabase migration.
export const seedUuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const seedGroupId = seedUuid(100);
