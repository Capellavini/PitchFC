-- ─────────────────────────────────────────────────────────
-- Migration 52 — never lose an un-ended matchday to the weekly reset.
--
-- Incident 2026-09-21 (Goodweather): the organizer forgot to press "end
-- matchday" on Sunday. The live score lives only in games.live_matchday, and
-- the weekly reset (migration 30) sets it to NULL together with the team draw
-- — no copy, no way back on the free plan (no backups).
--
-- Fix: before the reset wipes them, copy live_matchday + teams into
-- live_matchday_archive. Nothing else about the reset changes. The archive is
-- readable only by app admins (and the service role), never by players.
-- ─────────────────────────────────────────────────────────

create table if not exists public.live_matchday_archive (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references public.games(id) on delete set null,
  group_id      uuid references public.groups(id) on delete cascade,
  scheduled_at  timestamptz,                 -- the game the score belonged to
  archived_at   timestamptz not null default now(),
  reason        text not null default 'weekly_reset',
  live_matchday jsonb,
  teams         jsonb,
  confirmed_player_ids uuid[]                -- who was confirmed that night (needed to credit "played")
);

alter table public.live_matchday_archive enable row level security;
drop policy if exists "archive admin read" on public.live_matchday_archive;
create policy "archive admin read" on public.live_matchday_archive for select using (public.is_admin());

create or replace function public.reset_recurring_confirmations()
returns void language plpgsql security definer set search_path = public as $$
declare g record; om timestamptz; gm record;
begin
  for g in
    select * from groups
    where recurring is true and open_weekday is not null and open_time is not null
  loop
    om := last_open_moment(g.open_weekday, g.open_time);
    select * into gm from games
      where group_id = g.id and status in ('open','full','live')
      order by scheduled_at desc limit 1;
    if gm.id is null then continue; end if;

    if gm.cycle_opened_at is null or gm.cycle_opened_at < om then
      -- Keep the un-ended matchday (and who was confirmed) before wiping it.
      if gm.live_matchday is not null then
        insert into live_matchday_archive (game_id, group_id, scheduled_at, live_matchday, teams, confirmed_player_ids)
          values (gm.id, g.id, gm.scheduled_at, gm.live_matchday, gm.teams,
                  (select array_agg(player_id) from attendances where game_id = gm.id and status = 'confirmed'));
      end if;

      -- New week: everyone back to pending, payments cleared.
      update attendances
        set status = 'pending', paid = false, paid_at = null, responded_at = null
        where game_id = gm.id;
      update games
        set cycle_opened_at = om, status = 'open',
            scheduled_at = next_game_datetime(g.weekday, g.game_time),
            teams = null, teams_confirmed = false, teams_set_by = null, teams_confirmed_by = null,
            live_matchday = null
        where id = gm.id;
    end if;
  end loop;
end $$;
