-- ─────────────────────────────────────────────────────────
-- Migration 25 — instrumentation for the admin MVP dashboard: last-seen
-- timestamp per player (active-players metric) + a log of generated
-- post-match cards (cards-per-week metric). Neither existed before —
-- both metrics were literally impossible to compute without them.
-- ─────────────────────────────────────────────────────────

alter table public.players add column if not exists last_seen_at timestamptz;
-- Covered by the existing "players update" policy (user_id = auth.uid()),
-- no RLS change needed to let someone touch their own last_seen_at.

create table if not exists public.card_generations (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references public.players(id) on delete set null,
  group_id   uuid references public.groups(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.card_generations enable row level security;

drop policy if exists "card_generations insert own" on public.card_generations;
create policy "card_generations insert own" on public.card_generations for insert
  with check (player_id = public.my_player_id());

drop policy if exists "card_generations admin read" on public.card_generations;
create policy "card_generations admin read" on public.card_generations for select
  using (public.is_admin());
