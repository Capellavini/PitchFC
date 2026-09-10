-- ─────────────────────────────────────────────────────────
-- Migration 49 — Teams: an entity separate from Groups
--
-- "Strava do futebol" big bet: a Team is not the same thing as a Group.
-- A Group is a friend circle organizing its own weekly game (what the
-- whole app has been until now). A Team is a squad with its own identity
-- (name, logo, OVR, roster, and — once Team Challenges ships — record/
-- trophies/ranking) that can play OTHER teams. A group can spin up a
-- team (its roster seeds the team's initial roster), but from that point
-- on the team is independent: it can gain/lose players without touching
-- the group, and a player can belong to a team without being in the
-- founding group at all.
--
-- Scope of this migration: the entity itself (teams + membership) only.
-- Team Challenges (matches between two teams, results, rankings) is a
-- deliberately separate follow-up migration once this foundation is
-- live and used.
-- ─────────────────────────────────────────────────────────

create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  logo_url          text,
  city              text,
  color             text default '#C8FF00',
  captain_id        uuid references public.players(id) on delete set null,
  founded_by_group_id uuid references public.groups(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  role        text not null default 'player' check (role in ('captain', 'player')),
  joined_at   timestamptz not null default now(),
  unique (team_id, player_id)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Can the current user manage (captain of) a given team? Admin always can.
create or replace function public.can_manage_team(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.teams where id = t and captain_id = public.my_player_id()
  );
$$;

drop policy if exists "teams select" on public.teams;
drop policy if exists "teams insert" on public.teams;
drop policy if exists "teams update" on public.teams;
drop policy if exists "teams delete" on public.teams;
-- Reads stay open to any authenticated user (same call as groups/players/
-- posts) — a team profile needs to be viewable regardless of which group
-- or team the viewer is currently in, same reasoning as migration 8.
create policy "teams select" on public.teams for select using (auth.uid() is not null);
create policy "teams insert" on public.teams for insert with check (auth.uid() is not null);
create policy "teams update" on public.teams for update using (public.can_manage_team(id));
create policy "teams delete" on public.teams for delete using (public.can_manage_team(id));

drop policy if exists "team_members select" on public.team_members;
drop policy if exists "team_members insert" on public.team_members;
drop policy if exists "team_members update" on public.team_members;
drop policy if exists "team_members delete" on public.team_members;
create policy "team_members select" on public.team_members for select using (auth.uid() is not null);
-- A team's captain manages its roster; the very first member (the
-- captain themself, added at team-creation time) is also allowed to
-- insert themselves even before any team_members row exists yet.
create policy "team_members insert" on public.team_members for insert
  with check (public.can_manage_team(team_id) or player_id = public.my_player_id());
create policy "team_members update" on public.team_members for update using (public.can_manage_team(team_id));
create policy "team_members delete" on public.team_members for delete
  using (public.can_manage_team(team_id) or player_id = public.my_player_id());
