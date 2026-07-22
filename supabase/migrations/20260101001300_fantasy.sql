-- ─────────────────────────────────────────────────────────
-- Migration 13 — Fantasy League (admin-only beta)
--
-- Cartola-FC-style fantasy game built on the group's own real matches:
-- any participant can escalate any teammate (non-exclusive, unlike a
-- draft), the squad is editable until the organizer ends the matchday,
-- and points are computed from data that already exists in
-- matchdays.summary.lines (goals/assists/cleanSheets per player, filled
-- in by commitMatchday) plus matchdays.mvp_id (filled in later by
-- closeMvp — handled as a separate point bump, see useCloud.js).
--
-- Hidden from everyone but the admin for now via a bottom-nav gate in
-- the client (same mechanism already used for the Clube tab) — this
-- migration itself has no visibility restriction, it's just not linked
-- from the UI yet.
-- ─────────────────────────────────────────────────────────

create table if not exists public.fantasy_leagues (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid references public.groups(id) on delete cascade,
  name             text not null default 'Liga Fantasy',
  budget           numeric not null default 120,
  squad_size       int not null default 5,
  starts_at        timestamptz not null default now(),
  duration_months  int not null default 1 check (duration_months >= 1),
  scoring_weights  jsonb not null default '{
    "participou": 2, "golo": 8, "assistencia": 5, "cleanSheet": 5,
    "mvp": 10, "mvp2": 6, "mvp3": 3,
    "capitaoMultiplier": 2, "priceBase": 20, "priceScale": 1.5
  }'::jsonb,
  created_by       uuid references public.players(id),
  created_at       timestamptz default now()
);

-- One editable row per participant per league = their current/next-round pick.
create table if not exists public.fantasy_squads (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid references public.fantasy_leagues(id) on delete cascade,
  participant_id  uuid references public.players(id) on delete cascade,
  player_ids      uuid[] not null default '{}',
  captain_id      uuid references public.players(id),
  updated_at      timestamptz default now(),
  unique (league_id, participant_id)
);

-- Locked snapshot + computed points, one per participant per real matchday.
create table if not exists public.fantasy_scores (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid references public.fantasy_leagues(id) on delete cascade,
  matchday_id     uuid references public.matchdays(id) on delete cascade,
  participant_id  uuid references public.players(id) on delete cascade,
  player_ids      uuid[] not null,
  captain_id      uuid,
  points          numeric not null default 0,
  created_at      timestamptz default now(),
  unique (matchday_id, participant_id)
);

-- Resolve a league's group_id, for RLS checks on fantasy_scores (which
-- only carries league_id, not group_id directly).
create or replace function public.fantasy_league_group_id(lid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.fantasy_leagues where id = lid;
$$;

alter table public.fantasy_leagues enable row level security;
alter table public.fantasy_squads  enable row level security;
alter table public.fantasy_scores  enable row level security;

-- ── fantasy_leagues: readable by anyone logged in, managed by the
-- group's organizer/assistant/admin (mirrors matchdays in phase 2) ──
drop policy if exists "fl select" on public.fantasy_leagues;
drop policy if exists "fl insert" on public.fantasy_leagues;
drop policy if exists "fl update" on public.fantasy_leagues;
drop policy if exists "fl delete" on public.fantasy_leagues;
create policy "fl select" on public.fantasy_leagues for select using (auth.uid() is not null);
create policy "fl insert" on public.fantasy_leagues for insert with check (public.can_manage_group(group_id));
create policy "fl update" on public.fantasy_leagues for update using (public.can_manage_group(group_id));
create policy "fl delete" on public.fantasy_leagues for delete using (public.can_manage_group(group_id));

-- ── fantasy_squads: readable by anyone logged in, each participant
-- manages only their own squad ──
drop policy if exists "fs select" on public.fantasy_squads;
drop policy if exists "fs insert" on public.fantasy_squads;
drop policy if exists "fs update" on public.fantasy_squads;
drop policy if exists "fs delete" on public.fantasy_squads;
create policy "fs select" on public.fantasy_squads for select using (auth.uid() is not null);
create policy "fs insert" on public.fantasy_squads for insert with check (participant_id = public.my_player_id());
create policy "fs update" on public.fantasy_squads for update using (participant_id = public.my_player_id());
create policy "fs delete" on public.fantasy_squads for delete using (participant_id = public.my_player_id() or public.is_admin());

-- ── fantasy_scores: readable by anyone logged in, written only by the
-- code paths that already require organizer/assistant/admin in the UI
-- (commitMatchday / closeMvp) ──
drop policy if exists "fsc select" on public.fantasy_scores;
drop policy if exists "fsc insert" on public.fantasy_scores;
drop policy if exists "fsc update" on public.fantasy_scores;
drop policy if exists "fsc delete" on public.fantasy_scores;
create policy "fsc select" on public.fantasy_scores for select using (auth.uid() is not null);
create policy "fsc insert" on public.fantasy_scores for insert
  with check (public.can_manage_group(public.fantasy_league_group_id(league_id)));
create policy "fsc update" on public.fantasy_scores for update
  using (public.can_manage_group(public.fantasy_league_group_id(league_id)));
create policy "fsc delete" on public.fantasy_scores for delete
  using (public.can_manage_group(public.fantasy_league_group_id(league_id)));

do $$ begin alter publication supabase_realtime add table fantasy_leagues; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table fantasy_squads;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table fantasy_scores; exception when others then null; end $$;
