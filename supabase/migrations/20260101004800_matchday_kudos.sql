-- ─────────────────────────────────────────────────────────
-- Migration 48 — Kudos on a matchday performance
--
-- Fase B ("Strava do futebol"): a lightweight reaction on someone's line
-- in a matchday (their goals/assists/clean sheets/MVP that day), shown on
-- the cross-group home feed in Perfil. Same shape as post_likes (a
-- toggle-able join row), just keyed by (matchday, recipient, giver)
-- instead of (post, liker) — one matchday can carry kudos for several
-- different players' performances that day, not just one.
--
-- READS stay open to authenticated users (same "cross-group reads are
-- fine" call as posts/friendships in migration 8) — a kudos count/avatar
-- list needs to be visible regardless of which group is currently active.
-- ─────────────────────────────────────────────────────────

create table if not exists public.matchday_kudos (
  id             uuid primary key default gen_random_uuid(),
  matchday_id    uuid not null references public.matchdays(id) on delete cascade,
  to_player_id   uuid not null references public.players(id) on delete cascade,
  from_player_id uuid not null references public.players(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (matchday_id, to_player_id, from_player_id)
);

alter table public.matchday_kudos enable row level security;

drop policy if exists "kudos select" on public.matchday_kudos;
drop policy if exists "kudos insert" on public.matchday_kudos;
drop policy if exists "kudos delete" on public.matchday_kudos;

create policy "kudos select" on public.matchday_kudos for select using (auth.uid() is not null);
create policy "kudos insert" on public.matchday_kudos for insert with check (from_player_id = public.my_player_id());
create policy "kudos delete" on public.matchday_kudos for delete using (from_player_id = public.my_player_id() or public.is_admin());
