-- ─────────────────────────────────────────────────────────
-- Migration — respect a manually-pushed-out recurring date
--
-- Bug: reset_recurring_confirmations() always rewrote scheduled_at to
-- "next occurrence of (weekday, game_time) from now", even when an
-- organizer had already pushed the game further out on purpose (skip a
-- week, holiday, etc.). The hourly cron would silently pull it back to
-- the nearest slot the moment a new weekly cycle opened.
--
-- Fix: only roll scheduled_at forward if it isn't already at or beyond
-- the naturally-computed next slot. A manual override further in the
-- future is preserved; the normal weekly rollover is unchanged.
-- ─────────────────────────────────────────────────────────

create or replace function public.reset_recurring_confirmations()
returns void language plpgsql security definer set search_path = public as $$
declare g record; om timestamptz; gm record; ngd timestamptz;
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

      -- Only roll scheduled_at forward if it's not already pushed further out
      -- than the natural next slot (an intentional organizer override).
      ngd := next_game_datetime(g.weekday, g.game_time);
      update games
        set cycle_opened_at = om, status = 'open',
            scheduled_at = case when scheduled_at < ngd then ngd else scheduled_at end
        where id = gm.id;
    end if;
  end loop;
end $$;
