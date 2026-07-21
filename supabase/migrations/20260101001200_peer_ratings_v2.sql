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

do $$ begin
  alter table public.peer_ratings add constraint peer_ratings_target_rater_unique unique (player_id, rater_id);
exception when duplicate_object then null; end $$;

-- Reads stay open to authenticated users (needed to compute averages and
-- show "who rated me" across the group); writes scoped to the rater, and
-- a player can never rate themselves.
drop policy if exists "auth insert" on public.peer_ratings;
drop policy if exists "auth update" on public.peer_ratings;
drop policy if exists "auth delete" on public.peer_ratings;
create policy "rating insert" on public.peer_ratings for insert
  with check (rater_id = public.my_player_id() and rater_id <> player_id);
create policy "rating update" on public.peer_ratings for update
  using (rater_id = public.my_player_id());
create policy "rating delete" on public.peer_ratings for delete
  using (rater_id = public.my_player_id() or public.is_admin());

do $$ begin alter publication supabase_realtime add table peer_ratings; exception when others then null; end $$;
