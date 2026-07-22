-- ─────────────────────────────────────────────────────────
-- Migration 12 — direct in-app peer ratings
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- Replaces the WhatsApp-link + paste-code flow with real ratings: any
-- group member can rate any teammate straight from their profile. Adds
-- rater identity + one rating per (target, rater) — re-rating updates
-- instead of duplicating — and blocks rating yourself.
-- ─────────────────────────────────────────────────────────

alter table public.peer_ratings add column if not exists rater_id uuid references public.players(id) on delete cascade;

-- Existence check instead of catching an exception: adding a UNIQUE
-- constraint creates a backing index, and Postgres raises that specific
-- collision as `duplicate_table` (42P07), not `duplicate_object` — easy
-- to miss, so just check pg_constraint directly and skip if it's already there.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'peer_ratings_target_rater_unique'
  ) then
    alter table public.peer_ratings add constraint peer_ratings_target_rater_unique unique (player_id, rater_id);
  end if;
end $$;

-- Reads stay open to authenticated users (needed to compute averages and
-- show "who rated me" across the group); writes scoped to the rater, and
-- a player can never rate themselves. Idempotent: dropping both the old
-- phase-1 baseline policy names and this migration's own names means a
-- re-run (e.g. CI retrying after a manual apply) doesn't error out.
drop policy if exists "auth insert" on public.peer_ratings;
drop policy if exists "auth update" on public.peer_ratings;
drop policy if exists "auth delete" on public.peer_ratings;
drop policy if exists "rating insert" on public.peer_ratings;
drop policy if exists "rating update" on public.peer_ratings;
drop policy if exists "rating delete" on public.peer_ratings;
create policy "rating insert" on public.peer_ratings for insert
  with check (rater_id = public.my_player_id() and rater_id <> player_id);
create policy "rating update" on public.peer_ratings for update
  using (rater_id = public.my_player_id());
create policy "rating delete" on public.peer_ratings for delete
  using (rater_id = public.my_player_id() or public.is_admin());

do $$ begin alter publication supabase_realtime add table peer_ratings; exception when others then null; end $$;
