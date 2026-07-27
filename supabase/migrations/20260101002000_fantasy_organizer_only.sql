-- ─────────────────────────────────────────────────────────
-- Migration 20 — only the group's organizer creates the Manager
--
-- can_manage_group() (organizer OR assistant OR admin) is shared with
-- matchdays/teams, where assistants are meant to have full control.
-- Pitch Manager is narrower: starting a league sets its budget/squad
-- size/duration for everyone in the group, so that one call is reserved
-- for the organizer (or an admin) — assistants keep read/play access,
-- just not league creation.
-- ─────────────────────────────────────────────────────────

create or replace function public.is_group_organizer(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.players
    where user_id = auth.uid() and group_id = gid and is_organizer
  );
$$;

drop policy if exists "fl insert" on public.fantasy_leagues;
create policy "fl insert" on public.fantasy_leagues for insert with check (public.is_group_organizer(group_id));
