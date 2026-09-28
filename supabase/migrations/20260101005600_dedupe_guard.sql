-- ─────────────────────────────────────────────────────────
-- Migration 56 — one players row per auth account (dedupe guard)
--
-- On 2026-09-26 the "Onze x Onze" onboarding created several `players`
-- rows for the same auth user (up to 9 in ~3s): repeated taps on the quick
-- onboarding button while joinGroupWithProfile was still running, each
-- doing a blind INSERT. Every read in the app resolves "me" by user_id and
-- assumes exactly one row, and player_group_memberships is already
-- unique (player_id, group_id) — so the missing invariant is simply
-- "user_id is unique on players". The client now does select-then-insert
-- behind an in-flight guard (src/hooks/useCloud.js → ensureOwnPlayer);
-- this makes the duplicate impossible at the DB level too — a racing
-- second insert fails with 23505 and the client reads back the winner.
--
-- A plain UNIQUE constraint (not a partial index) on purpose: Postgres
-- treats NULLs as distinct, so guest/manual players (user_id null) are
-- unaffected, and a real constraint is also usable as a PostgREST
-- on_conflict target if we ever want upsert.
--
-- PREREQUISITE: existing duplicates must be merged first with
-- supabase/cleanup/2026-09-28-dedupe-players.sql — otherwise this
-- migration aborts with a clear message (and changes nothing) instead of
-- failing on the raw index build.
--
-- No new table → no Data API grants needed.
-- ─────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from public.players
    where user_id is not null
    group by user_id having count(*) > 1
  ) then
    raise exception 'players has duplicate rows per user_id — run supabase/cleanup/2026-09-28-dedupe-players.sql in the SQL editor first, then re-apply this migration';
  end if;
end $$;

alter table public.players drop constraint if exists players_user_id_key;
alter table public.players add constraint players_user_id_key unique (user_id);

-- my_player_id()/my_group_id() used `limit 1` without an order, which is
-- what made duplicates silently "work" before. With the constraint above
-- there is at most one row, so they're now deterministic by construction —
-- no change needed.
