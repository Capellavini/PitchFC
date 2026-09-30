-- Phones → E.164 ("+351912345678"), backfill of the UNAMBIGUOUS cases only.
--
-- From 2026-09-30 the app (src/components/PhoneInput.jsx, src/lib/phone.js)
-- always stores players.phone as E.164. Older rows were free text; many are
-- national-only ("912 345 678"), which breaks wa.me links and makes the
-- wa-bot fall back to last-9-digit matching (ambiguous for Brazilian numbers).
--
-- Rewritten here (after stripping spaces, dashes, dots and parentheses):
--   1. exactly 9 digits starting with 9   → '+351' || digits   (PT mobile)
--   2. '00' + 8–15 digits                 → '+'    || digits   (00 = intl prefix)
--   3. '351' + 9 digits (12, no '+')      → '+'    || digits
--   4. '55'  + 10–11 digits (12–13, no +) → '+'    || digits   (BR)
-- Everything else — values already starting with '+', landlines, 11-digit
-- BR national numbers without 55, junk — is left exactly as it is.
-- auth.users.raw_user_meta_data->>'phone' is deliberately NOT touched.
--
-- Idempotent: every rewritten value starts with '+', which none of the
-- patterns below match, so a second run changes nothing.
--
-- Read-only preview (run in the SQL editor BEFORE applying; changes nothing):
--
--   with c as (
--     select id, name, phone as before,
--            regexp_replace(phone, '[[:space:]().-]', '', 'g') as d
--     from public.players
--     where phone is not null
--   )
--   select id, name, before,
--          case
--            when d ~ '^9[0-9]{8}$'          then '+351' || d
--            when d ~ '^00[1-9][0-9]{7,14}$' then '+' || substr(d, 3)
--            when d ~ '^351[0-9]{9}$'        then '+' || d
--            when d ~ '^55[0-9]{10,11}$'     then '+' || d
--          end as after
--   from c
--   order by (case when d ~ '^(9[0-9]{8}|00[1-9][0-9]{7,14}|351[0-9]{9}|55[0-9]{10,11})$' then 0 else 1 end), name;
--   -- rows with after = null stay untouched.

with c as (
  select id, regexp_replace(phone, '[[:space:]().-]', '', 'g') as d
  from public.players
  where phone is not null
    and phone !~ '^\s*\+'
)
update public.players p
set phone = case
    when c.d ~ '^9[0-9]{8}$'          then '+351' || c.d
    when c.d ~ '^00[1-9][0-9]{7,14}$' then '+' || substr(c.d, 3)
    when c.d ~ '^351[0-9]{9}$'        then '+' || c.d
    when c.d ~ '^55[0-9]{10,11}$'     then '+' || c.d
  end
from c
where p.id = c.id
  and c.d ~ '^(9[0-9]{8}|00[1-9][0-9]{7,14}|351[0-9]{9}|55[0-9]{10,11})$';
