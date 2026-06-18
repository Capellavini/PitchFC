-- ─────────────────────────────────────────────────────────
-- Migration 10 — magic-link confirmation (no login)
--
-- A player confirms/declines their next game from a unique link
-- (?confirm=<magic_token>) without an account. Anonymous access is
-- blocked by RLS, so this goes through SECURITY DEFINER RPCs that are
-- authorized by the player's secret magic_token (already on players).
--
-- magic_game_info(token)        → read the player + current game state
-- magic_set_status(token, st)   → set their attendance, returns the state
-- ─────────────────────────────────────────────────────────

create or replace function public.magic_game_info(token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  p public.players%rowtype;
  g public.games%rowtype;
  att text;
  confirmed_count int;
begin
  select * into p from public.players where magic_token = token limit 1;
  if not found then return null; end if;

  select * into g from public.games
    where group_id = p.group_id and status in ('open','full','live')
    order by scheduled_at desc limit 1;

  if g.id is null then
    return jsonb_build_object(
      'player', jsonb_build_object('nick', p.nick, 'name', p.name),
      'game', null);
  end if;

  select status into att from public.attendances where game_id = g.id and player_id = p.id;
  select count(*) into confirmed_count from public.attendances where game_id = g.id and status = 'confirmed';

  return jsonb_build_object(
    'player', jsonb_build_object('nick', p.nick, 'name', p.name),
    'game', jsonb_build_object('id', g.id, 'scheduled_at', g.scheduled_at, 'venue', g.venue, 'spots', g.spots),
    'group', (select jsonb_build_object('name', name) from public.groups where id = p.group_id),
    'status', coalesce(att, 'pending'),
    'confirmed', confirmed_count
  );
end $$;

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

  insert into public.attendances (game_id, player_id, status, responded_at)
    values (g.id, p.id, new_status, now())
  on conflict (game_id, player_id) do update
    set status = excluded.status,
        responded_at = now(),
        paid = case when excluded.status <> 'confirmed' then false else public.attendances.paid end;

  return public.magic_game_info(token);
end $$;

-- Anonymous (no-login) callers may execute these; the secret token is the auth.
grant execute on function public.magic_game_info(text) to anon, authenticated;
grant execute on function public.magic_set_status(text, text) to anon, authenticated;
