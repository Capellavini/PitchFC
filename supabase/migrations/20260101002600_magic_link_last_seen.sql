-- ─────────────────────────────────────────────────────────
-- Migration 27 — fix "active players" undercounting reported by Vini
-- (2026-07-30): players.last_seen_at (migration 25) was only ever
-- touched from useCloud.js's authenticated load path. But most players
-- confirm via the magic link (?confirm=<token>, WhatsApp reminders) —
-- a fully anonymous, no-login flow through the SECURITY DEFINER RPCs
-- below (migration 10). Opening that link never went through the
-- authenticated path, so it was silently never counted as "opened the
-- app" even though it very much is.
--
-- Fix: touch last_seen_at inside magic_game_info() itself, which runs
-- every time the link is opened (magic_set_status already calls it at
-- the end, so confirming/declining is covered too — one fix point).
-- ─────────────────────────────────────────────────────────

-- No longer STABLE: it now writes (last_seen_at touch), so it must be
-- VOLATILE (the default) — a stable-but-mutating function is a lie the
-- planner could act on.
create or replace function public.magic_game_info(token text)
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
