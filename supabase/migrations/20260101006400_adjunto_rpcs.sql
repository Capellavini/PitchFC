-- ─────────────────────────────────────────────────────────
-- Migration — Treinador Adjunto (2/3): RPCs
--
-- Plan: docs/ADJUNTO-PLAN.md §3 "006400_adjunto_rpcs.sql" + decision 11.
-- All functions are SECURITY DEFINER with search_path = public, and every
-- one has its EXECUTE grants set explicitly (Supabase's default privileges
-- grant EXECUTE on new public functions to anon/authenticated, so each is
-- revoked where it doesn't belong).
--
-- Who can call what:
--   authenticated (the app):  adjunto_create_link_code, adjunto_status,
--                             adjunto_unlink, is_group_manager
--   service_role (the bot):   adjunto_apply_teams, adjunto_teams_md5,
--                             adjunto_find_organizer_by_phone,
--                             adjunto_phones_match
--   nobody via the API:       adjunto_gen_code (internal helper)
--
-- Authorization is MULTI-GROUP: organizer/assistant comes from
-- player_group_memberships.role (not the legacy single-group
-- can_manage_group(), which reads players.group_id), banned memberships
-- excluded, or is_admin(). players.user_id is unique since migration 56
-- (players_user_id_key), so my_player_id() is unambiguous.
--
-- INERT: nothing existing calls these. The only write to an existing table
-- is adjunto_apply_teams → games.teams/teams_set_by/teams_confirmed/
-- teams_confirmed_by, the same columns the app writes in
-- useCloud.updateGameTeams/confirmGameTeams, and it is service_role-only.
-- ─────────────────────────────────────────────────────────

-- ── Helper: does the caller manage this group? ───────────
create or replace function public.is_group_manager(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.player_group_memberships m
    where m.group_id = gid
      and m.player_id = public.my_player_id()
      and m.role in ('organizer','assistant')
      and not m.banned
  );
$$;
revoke execute on function public.is_group_manager(uuid) from public, anon;
grant  execute on function public.is_group_manager(uuid) to authenticated, service_role;

-- ── Helper: random activation code 'ADJ-XXXXXX' ──────────
-- 32-symbol alphabet (no 0/O/1/I) → byte % 32 is unbiased. Randomness from
-- gen_random_uuid() (core, CSPRNG) — bytes 0..5 of a v4 UUID are fully
-- random — so no dependency on pgcrypto's schema.
create or replace function public.adjunto_gen_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  s text := 'ADJ-';
begin
  for i in 0..5 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return s;
end $$;
revoke execute on function public.adjunto_gen_code() from public, anon, authenticated;

-- ── App: create an activation code ───────────────────────
-- Caller must manage the group, the group must have adjunto_enabled.
-- Max 5 codes per player per hour; creating a new one expires the caller's
-- older unused codes. Errors (message = machine code for the app):
--   not_authenticated | not_group_manager | adjunto_not_enabled | rate_limited
create or replace function public.adjunto_create_link_code(p_group_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  v_code   text;
  v_recent int;
begin
  if v_pid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_group_id is null or not public.is_group_manager(p_group_id) then
    raise exception 'not_group_manager' using errcode = '42501';
  end if;
  if not exists (select 1 from public.groups where id = p_group_id and adjunto_enabled) then
    raise exception 'adjunto_not_enabled' using errcode = 'P0001';
  end if;

  -- Serialise per player so two fast taps can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('adjunto_code:' || v_pid::text, 0));

  select count(*) into v_recent
    from public.adjunto_link_codes
    where player_id = v_pid and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  update public.adjunto_link_codes
    set expires_at = now()
    where player_id = v_pid and used_at is null and expires_at > now();

  loop
    v_code := public.adjunto_gen_code();
    insert into public.adjunto_link_codes (code, player_id, group_id)
      values (v_code, v_pid, p_group_id)
      on conflict (code) do nothing;
    exit when found;
  end loop;

  return v_code;
end $$;
revoke execute on function public.adjunto_create_link_code(uuid) from public, anon;
grant  execute on function public.adjunto_create_link_code(uuid) to authenticated;

-- ── App: link status for the AdjuntoCard ─────────────────
-- {enabled, linked, linked_at, wa_pn_masked, active_here, format_set} for
-- the CALLING player. The link is per player; active_here says whether
-- this group is the one the DM is currently focused on.
create or replace function public.adjunto_status(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid     uuid := public.my_player_id();
  v_link    public.adjunto_links%rowtype;
  v_enabled boolean;
  v_fmt     jsonb;
begin
  if v_pid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_group_id is null or not public.is_group_manager(p_group_id) then
    raise exception 'not_group_manager' using errcode = '42501';
  end if;

  select g.adjunto_enabled, g.game_format into v_enabled, v_fmt
    from public.groups g where g.id = p_group_id;
  select * into v_link from public.adjunto_links l where l.player_id = v_pid;

  return jsonb_build_object(
    'enabled',      coalesce(v_enabled, false),
    'linked',       v_link.id is not null and v_link.enabled,
    'linked_at',    v_link.linked_at,
    'wa_pn_masked', case when v_link.wa_pn is null then null
                         else '••• ' || right(v_link.wa_pn, 3) end,
    'active_here',  coalesce(v_link.active_group_id = p_group_id, false),
    'format_set',   v_fmt is not null
  );
end $$;
revoke execute on function public.adjunto_status(uuid) from public, anon;
grant  execute on function public.adjunto_status(uuid) to authenticated;

-- ── App: "Desligar" ──────────────────────────────────────
-- Deletes the caller's link; threads, messages and proposals cascade
-- (privacy: unlinking forgets the conversation). adjunto_usage is keyed by
-- player and survives, so relinking can't reset the daily budget.
create or replace function public.adjunto_unlink()
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_pid uuid := public.my_player_id();
begin
  if v_pid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.adjunto_links where player_id = v_pid;
end $$;
revoke execute on function public.adjunto_unlink() from public, anon;
grant  execute on function public.adjunto_unlink() to authenticated;

-- ── Bot: md5 of a game's current teams (for the CAS) ─────
-- The bot can't reproduce Postgres' jsonb::text rendering in JS, so it
-- reads the hash from here and passes it back to adjunto_apply_teams.
create or replace function public.adjunto_teams_md5(p_game_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce(g.teams::text, 'null')) from public.games g where g.id = p_game_id;
$$;
revoke execute on function public.adjunto_teams_md5(uuid) from public, anon, authenticated;
grant  execute on function public.adjunto_teams_md5(uuid) to service_role;

-- ── Bot: compare-and-set write of games.teams ────────────
-- (Named adjunto_write_teams in the plan.) Writes the same columns as the
-- app: draft → teams_confirmed=false (like updateGameTeams with
-- resetConfirmed); approve → teams_confirmed=true, teams_confirmed_by=actor
-- (like confirmGameTeams). teams_set_by = actor, except when approving the
-- unchanged draft someone else made (keeps "sorteado por" truthful).
-- Never touches live_matchday. Returns jsonb instead of raising, so the
-- bot can branch on it:
--   {ok:true,  md5:<new>}
--   {ok:false, reason:'teams_changed', md5:<current>}   ← someone edited in the app
--   {ok:false, reason:'game_locked' | 'game_not_found' | 'actor_not_manager' | 'invalid_teams'}
create or replace function public.adjunto_apply_teams(
  p_game_id uuid, p_teams jsonb, p_expected_md5 text, p_actor uuid, p_confirm boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  g     public.games%rowtype;
  v_md5 text;
begin
  if p_teams is null or jsonb_typeof(p_teams) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_teams');
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

  v_md5 := md5(coalesce(g.teams::text, 'null'));
  if v_md5 is distinct from p_expected_md5 then
    return jsonb_build_object('ok', false, 'reason', 'teams_changed', 'md5', v_md5);
  end if;

  update public.games
    set teams              = p_teams,
        teams_set_by       = case when g.teams is not distinct from p_teams and g.teams_set_by is not null
                                  then g.teams_set_by else p_actor end,
        teams_confirmed    = coalesce(p_confirm, false),
        teams_confirmed_by = case when coalesce(p_confirm, false) then p_actor end
    where id = p_game_id;

  return jsonb_build_object('ok', true, 'md5', md5(p_teams::text));
end $$;
revoke execute on function public.adjunto_apply_teams(uuid, jsonb, text, uuid, boolean) from public, anon, authenticated;
grant  execute on function public.adjunto_apply_teams(uuid, jsonb, text, uuid, boolean) to service_role;

-- ── Phone matching: SQL mirror of wa-bot/src/roster.js phonesMatch ──
--   digits(s)         = non-digits stripped, then a leading '00' dropped
--   hasCountryCode(s) = starts with '+'/'00', or ≥ 12 digits
--   < 8 digits on either side → never matches (junk)
--   both international → exact digit equality
--   otherwise (legacy national-only) → compare the tail as long as the
--   shorter side (trunk '0' dropped when it's > 9 digits)
-- Keep in sync with roster.js (and its tests) if either changes.
create or replace function public.adjunto_phones_match(a text, b text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  x text; y text; a_cc boolean; b_cc boolean;
  s text; l text; nat text; n int;
begin
  x := regexp_replace(regexp_replace(coalesce(a, ''), '[^0-9]', '', 'g'), '^00', '');
  y := regexp_replace(regexp_replace(coalesce(b, ''), '[^0-9]', '', 'g'), '^00', '');
  if length(x) < 8 or length(y) < 8 then return false; end if;
  a_cc := coalesce(a, '') ~ '^\s*(\+|00)' or length(x) >= 12;
  b_cc := coalesce(b, '') ~ '^\s*(\+|00)' or length(y) >= 12;
  if a_cc and b_cc then return x = y; end if;
  if length(x) <= length(y) then s := x; l := y; else s := y; l := x; end if;
  nat := case when length(s) > 9 then regexp_replace(s, '^0', '') else s end;
  n := least(length(nat), length(l));
  return right(nat, n) = right(l, n);
end $$;
revoke execute on function public.adjunto_phones_match(text, text) from public, anon, authenticated;
grant  execute on function public.adjunto_phones_match(text, text) to service_role;

-- ── Bot: decision 11 — activation by phrase ──────────────
-- "Quero o Treinador Adjunto" sent to the bot's number: who is this sender?
-- p_digits = the sender's E.164 digits as WhatsApp authenticates them
-- (a leading '+' is optional). Returns one row per (player, group) where
-- that player is organizer/assistant of an adjunto_enabled group, not
-- banned, and players.phone matches: exact E.164 digits, or (legacy
-- national-only stored phone) the phonesMatch tail rule. The bot decides:
-- 1 player → activate (1 group → link; N groups → "Qual?"); 0 rows → the
-- one "não encontrei" reply; >1 distinct player_id (dirty data) → treat as
-- not found and log. Read-only.
create or replace function public.adjunto_find_organizer_by_phone(p_digits text)
returns table (player_id uuid, group_id uuid, group_name text, role text, nick text)
language sql stable security definer set search_path = public as $$
  select p.id, g.id, g.name, m.role, p.nick
  from public.players p
  join public.player_group_memberships m on m.player_id = p.id
  join public.groups g on g.id = m.group_id
  where m.role in ('organizer','assistant')
    and not m.banned
    and g.adjunto_enabled
    and p.phone is not null
    and public.adjunto_phones_match('+' || regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g'), p.phone)
  order by g.name, p.id;
$$;
revoke execute on function public.adjunto_find_organizer_by_phone(text) from public, anon, authenticated;
grant  execute on function public.adjunto_find_organizer_by_phone(text) to service_role;
