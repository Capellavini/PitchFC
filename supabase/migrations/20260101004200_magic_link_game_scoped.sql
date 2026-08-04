-- ─────────────────────────────────────────────────────────
-- Migration 42 — Magic link resolves the SPECIFIC game, not "whatever's
-- currently open for my active group"
--
-- Found while investigating cross-group RLS correctness: magic_token
-- confirmation had no game/group identifier in the link at all — it
-- trusted players.group_id (the player's CURRENTLY ACTIVE group) at
-- click-time. A player in two groups who switches their active group
-- between receiving a WhatsApp reminder and tapping the link would
-- confirm/decline the WRONG group's game.
--
-- Fix: the link now also carries the game id. When given, resolve
-- against that exact game, authorized via player_group_memberships
-- (still a member, not banned) rather than the scalar group_id — this
-- also protects against a stale/forwarded link for a group the player
-- has since left. No p_game_id (any link already sent before this
-- ships) keeps the old "latest open game for my active group" fallback.
-- ─────────────────────────────────────────────────────────

create or replace function public.magic_game_info(token text, p_game_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  p public.players%rowtype;
  g public.games%rowtype;
  att text;
  confirmed_count int;
begin
  select * into p from public.players where magic_token = token limit 1;
  if not found then return null; end if;

  update public.players set last_seen_at = now() where id = p.id;

  if p_game_id is not null then
    select * into g from public.games where id = p_game_id;
    if g.id is not null and not exists (
      select 1 from public.player_group_memberships
      where player_id = p.id and group_id = g.group_id and not banned
    ) then
      g := null;
    end if;
  else
    select * into g from public.games
      where group_id = p.group_id and status in ('open','full','live')
      order by scheduled_at desc limit 1;
  end if;

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
    'group', (select jsonb_build_object('name', name) from public.groups where id = g.group_id),
    'status', coalesce(att, 'pending'),
    'confirmed', confirmed_count
  );
end $$;

create or replace function public.magic_set_status(token text, new_status text, p_game_id uuid default null)
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

  if p_game_id is not null then
    select * into g from public.games where id = p_game_id;
    if g.id is not null and not exists (
      select 1 from public.player_group_memberships
      where player_id = p.id and group_id = g.group_id and not banned
    ) then
      g := null;
    end if;
  else
    select * into g from public.games
      where group_id = p.group_id and status in ('open','full','live')
      order by scheduled_at desc limit 1;
  end if;
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

  return public.magic_game_info(token, p_game_id);
end $$;

grant execute on function public.magic_game_info(text, uuid) to anon, authenticated;
grant execute on function public.magic_set_status(text, text, uuid) to anon, authenticated;
