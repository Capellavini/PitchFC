-- ─────────────────────────────────────────────────────────
-- Migration 19 — Pitch Manager: reserve slot + player trading
--
-- reserve_id: which of the 6 picks is the bench player (doesn't score —
-- enforced in src/lib/fantasy.js computeRoundPoints/mvpBonus).
-- budget_adjustment: running cash gained/spent via completed trades,
-- separate from the live market-price calculation for currently-owned
-- players (see fmtM / trade logic in useCloud.js).
--
-- fantasy_trade_offers: peer-to-peer player trading. A participant
-- offers to acquire a real player owned by someone else, either for
-- cash (drops one of their own to make room, pays the seller) or as a
-- straight player-for-player swap. The current owner must accept.
-- ─────────────────────────────────────────────────────────

alter table public.fantasy_squads add column if not exists reserve_id uuid references public.players(id);
alter table public.fantasy_squads add column if not exists budget_adjustment numeric not null default 0;

-- Snapshotted alongside player_ids/captain_id when a round locks (see
-- commitMatchday), so a later reserve change doesn't retroactively
-- change an already-scored round.
alter table public.fantasy_scores add column if not exists reserve_id uuid references public.players(id);

create table if not exists public.fantasy_trade_offers (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid references public.fantasy_leagues(id) on delete cascade,
  from_participant_id uuid references public.players(id) on delete cascade,
  to_participant_id   uuid references public.players(id) on delete cascade,
  target_player_id    uuid references public.players(id),
  give_player_id      uuid references public.players(id),
  offer_type          text not null check (offer_type in ('cash', 'swap')),
  offer_cash          numeric,
  status              text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at          timestamptz default now(),
  resolved_at         timestamptz
);

alter table public.fantasy_trade_offers enable row level security;

-- Readable by anyone logged in (same pattern as the other fantasy_*
-- tables); writes scoped to the two participants involved.
drop policy if exists "fto select" on public.fantasy_trade_offers;
drop policy if exists "fto insert" on public.fantasy_trade_offers;
drop policy if exists "fto update" on public.fantasy_trade_offers;
create policy "fto select" on public.fantasy_trade_offers for select using (auth.uid() is not null);
create policy "fto insert" on public.fantasy_trade_offers for insert
  with check (from_participant_id = public.my_player_id());
create policy "fto update" on public.fantasy_trade_offers for update
  using (from_participant_id = public.my_player_id() or to_participant_id = public.my_player_id());

do $$ begin alter publication supabase_realtime add table fantasy_trade_offers; exception when others then null; end $$;
