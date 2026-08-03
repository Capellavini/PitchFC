-- ─────────────────────────────────────────────────────────
-- Migration 36 — Cross-group player identity: data foundation (Phase 1)
--
-- Today players.group_id is a single scalar FK — one player, one group —
-- and joining a new group overwrites it (joinGroupByToken in
-- useCloud.js), silently losing membership in the old one. This adds a
-- proper membership table WITHOUT changing any existing behavior: a
-- trigger keeps it in sync with players.group_id/is_organizer/
-- is_assistant automatically, so no client write-site needs editing.
-- The trigger only ever inserts/updates the row for the player's
-- CURRENT group — it never deletes a row for a group left behind — so
-- switching groups becomes additive (history preserved) the moment this
-- ships. Nothing reads this table yet; per-group stats, a switcher UI,
-- and migrating my_group_id()/friends to use it are deferred (Phase 2).
-- ─────────────────────────────────────────────────────────

create table if not exists public.player_group_memberships (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  role       text not null default 'member' check (role in ('organizer','assistant','member')),
  joined_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, group_id)
);

-- Backfill from today's single group_id per player.
insert into public.player_group_memberships (player_id, group_id, role, joined_at)
select id, group_id,
       case when is_organizer then 'organizer' when is_assistant then 'assistant' else 'member' end,
       coalesce(created_at, now())
from public.players
where group_id is not null
on conflict (player_id, group_id) do nothing;

-- Keep it in sync automatically going forward. Upsert-only — a group
-- switch never deletes the row for the group left behind.
create or replace function public.sync_player_group_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null then
    insert into public.player_group_memberships (player_id, group_id, role, joined_at)
    values (new.id, new.group_id,
            case when new.is_organizer then 'organizer' when new.is_assistant then 'assistant' else 'member' end,
            now())
    on conflict (player_id, group_id) do update
      set role = excluded.role, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_player_group_membership on public.players;
create trigger trg_sync_player_group_membership
  after insert or update of group_id, is_organizer, is_assistant on public.players
  for each row execute function public.sync_player_group_membership();

alter table public.player_group_memberships enable row level security;
drop policy if exists "pgm select" on public.player_group_memberships;
drop policy if exists "pgm all self or admin" on public.player_group_memberships;
create policy "pgm select" on public.player_group_memberships for select using (auth.uid() is not null);
create policy "pgm all self or admin" on public.player_group_memberships for all
  using (player_id = public.my_player_id() or public.can_manage_group(group_id) or public.is_admin())
  with check (player_id = public.my_player_id() or public.can_manage_group(group_id) or public.is_admin());

do $$ begin alter publication supabase_realtime add table player_group_memberships; exception when others then null; end $$;
