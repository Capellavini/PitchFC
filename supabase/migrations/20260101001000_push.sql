-- ─────────────────────────────────────────────────────────
-- Migration 11 — Web Push subscriptions
--
-- Stores each player's browser push subscriptions so the Edge Function
-- can notify them (e.g. when they're promoted off the waiting line).
-- A player manages only their own subscriptions.
-- ─────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players(id) on delete cascade,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push own select" on public.push_subscriptions;
drop policy if exists "push own insert" on public.push_subscriptions;
drop policy if exists "push own delete" on public.push_subscriptions;

create policy "push own select" on public.push_subscriptions
  for select using (player_id = public.my_player_id());
create policy "push own insert" on public.push_subscriptions
  for insert with check (player_id = public.my_player_id());
create policy "push own delete" on public.push_subscriptions
  for delete using (player_id = public.my_player_id());
