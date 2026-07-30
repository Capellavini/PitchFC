-- ─────────────────────────────────────────────────────────
-- Migration 30 — the weekly recurring-game reset (migration 7) wipes
-- confirmations for the new cycle but left the team draw/live-matchday
-- state untouched. Combined with migration 29 removing the old
-- "any status change clears the draw" behavior (too aggressive — it was
-- nuking the organizer's real work on every single confirm/decline),
-- a stale draw from last week could otherwise sit there looking valid
-- into the new week. The right place to clear it is exactly here: once
-- per week, when the cycle actually rolls over.
-- ─────────────────────────────────────────────────────────

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
