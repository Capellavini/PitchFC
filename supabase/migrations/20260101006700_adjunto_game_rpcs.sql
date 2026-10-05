-- ─────────────────────────────────────────────────────────
-- Migration — Treinador Adjunto: game time/venue RPC (bot only)
--
-- Plan: docs/ADJUNTO-PLAN.md §3 "adjunto_reschedule_game" / §7.3
-- change_game_time + change_venue. The bot's write tools are two-phase:
-- the organizer says "sim" in the DM, then the bot calls this. It writes
-- EXACTLY the columns the app's useCloud.updateGroupRow writes, so the app
-- picks the change up through its normal groups/games realtime:
--   * this week only  → games.scheduled_at (+ games.venue)
--   * recurring       → also groups.weekday / groups.game_time (+ groups.venue),
--                       weekday/time in Europe/Lisbon wall-clock (time.js)
--
-- Compare-and-set on games.scheduled_at (p_expected_scheduled_at) so an
-- edit made in the app between proposal and "sim" is never overwritten.
-- Returns jsonb instead of raising, so the bot can branch:
--   {ok:true, scheduled_at}
--   {ok:false, reason:'invalid'|'game_not_found'|'actor_not_manager'|'game_locked'|'game_changed'|'in_past'}
--
-- INERT: nothing calls it until the bot runs with ADJUNTO_ENABLED=true and a
-- group has adjunto_enabled. No table is created (so no new Data API grants
-- needed); EXECUTE is service_role only.
-- ─────────────────────────────────────────────────────────

create or replace function public.adjunto_reschedule_game(
  p_game_id uuid,
  p_scheduled_at timestamptz,
  p_this_week_only boolean,
  p_venue text,
  p_expected_scheduled_at timestamptz,
  p_actor uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g       public.games%rowtype;
  v_local timestamp;
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
begin
  if p_game_id is null or p_scheduled_at is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_scheduled_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'in_past');
  end if;

  select * into g from public.games where id = p_game_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'game_not_found');
  end if;

  if p_actor is null or not exists (
    select 1 from public.player_group_memberships m
    where m.player_id = p_actor and m.group_id = g.group_id
      and m.role in ('organizer','assistant') and not m.banned
  ) then
    return jsonb_build_object('ok', false, 'reason', 'actor_not_manager');
  end if;

  if coalesce(g.status, '') not in ('open','full') or g.live_matchday is not null then
    return jsonb_build_object('ok', false, 'reason', 'game_locked');
  end if;

  if p_expected_scheduled_at is not null and g.scheduled_at is distinct from p_expected_scheduled_at then
    return jsonb_build_object('ok', false, 'reason', 'game_changed');
  end if;

  update public.games
    set scheduled_at = p_scheduled_at,
        venue        = coalesce(v_venue, venue)
    where id = p_game_id;

  if not coalesce(p_this_week_only, true) then
    v_local := p_scheduled_at at time zone 'Europe/Lisbon';
    update public.groups
      set weekday   = extract(dow from v_local)::int,
          game_time = to_char(v_local, 'HH24:MI'),
          venue     = coalesce(v_venue, venue)
      where id = g.group_id;
  end if;

  return jsonb_build_object('ok', true, 'scheduled_at', p_scheduled_at);
end $$;

revoke execute on function public.adjunto_reschedule_game(uuid, timestamptz, boolean, text, timestamptz, uuid) from public, anon, authenticated;
grant  execute on function public.adjunto_reschedule_game(uuid, timestamptz, boolean, text, timestamptz, uuid) to service_role;
