import { createClient } from "@supabase/supabase-js";

// Keys live in .env.local (never committed — see env.example).
// Without them the app keeps working on localStorage only.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);
export const supabase = supabaseEnabled
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// The original seed maps the prototype's numeric player ids onto
// deterministic uuids (…-000000000001 = player 1). Still used by the
// example FC Amigos group; real groups now use random uuids.
export const seedUuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const seedGroupId = seedUuid(100);

// App owner(s): can create/remove club events. Comma-separated in
// VITE_ADMIN_EMAILS, falling back to the founder's address.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "capella.vinicius@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAdminEmail = (email) =>
  Boolean(email) && ADMIN_EMAILS.includes(email.toLowerCase());
