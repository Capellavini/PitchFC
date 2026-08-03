-- ─────────────────────────────────────────────────────────
-- Migration 34 — enforce the confirmation window server-side.
--
-- Reported by Vini (Goodweather): Elias managed to confirm before the
-- scheduled opening time. Root cause: confirmationWindow() in
-- helpers.js is computed entirely on the PLAYER'S OWN DEVICE (new
-- Date()) — just a UI convenience to hide the button. setMyStatus()
-- writes straight to attendances with no backend check at all, so a
-- phone with a different timezone/clock sees the button early and the
-- write goes through regardless.
--
-- Fix: reuse games.cycle_opened_at, the marker migration 7's hourly
-- pg_cron job (reset_recurring_confirmations) already sets the moment
-- a recurring game's window actually opens. A self-confirm is only
-- allowed once that's set for the game's current cycle; non-recurring
-- groups have no window at all (always open), matching the client's
-- own confirmationWindow() semantics. Organizer/assistant/admin writes
-- on someone else's attendance are untouched — they can still manage
-- the roster anytime.
--
-- Same guard added to magic_set_status (the no-login WhatsApp-link
-- flow), which is SECURITY DEFINER and otherwise bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────

create or replace function public.confirmation_open(p_game_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (not g.recurring) or (gm.cycle_opened_at is not null)
     from public.games gm
     join public.groups g on g.id = gm.group_id
     where gm.id = p_game_id),
    true
  );
$$;

drop policy if exists "att insert" on public.attendances;
drop policy if exists "att update" on public.attendances;
create policy "att insert" on public.attendances for insert
  with check (
    (player_id = public.my_player_id() and public.confirmation_open(game_id))
    or public.can_manage_group(public.game_group_id(game_id))
  );
create policy "att update" on public.attendances for update
  using (
    (player_id = public.my_player_id() and public.confirmation_open(game_id))
    or public.can_manage_group(public.game_group_id(game_id))
  );

create or replace function public.magic_set_status(token text, new_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  p public.players%rowtype;
  g public.games%rowtype;
begin
  if new_status not in ('confirmed','declined','pending') then
    raise exception 'invalid status';
  end if;

  select * into p from public.players where magic_token = token limit 1;
  if not found then return null; end if;

  select * into g from public.games
    where group_id = p.group_id and status in ('open','full','live')
    order by scheduled_at desc limit 1;
  if g.id is null then return null; end if;

  if not public.confirmation_open(g.id) then
    raise exception 'As confirmações ainda não abriram.';
  end if;

  insert into public.attendances (game_id, player_id, status, responded_at)
    values (g.id, p.id, new_status, now())
  on conflict (game_id, player_id) do update
    set status = excluded.status,
        responded_at = now(),
        paid = case when excluded.status <> 'confirmed' then false else public.attendances.paid end;

  return public.magic_game_info(token);
end $$;
