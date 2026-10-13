-- ─────────────────────────────────────────────────────────
-- Migration — PITCH Rivals: WhatsApp bot lookup for captains
--
-- Decision 2026-10-13 (b) (docs/TEAMS-CHALLENGES-SPEC.md): after creating
-- a team the app offers "O Pitch AI ajuda-te a montar a equipa" → wa.me
-- with a prefilled message (src/lib/core/captainPhrase.js). The bot
-- (wa-bot/src/adjunto/captain.js) answers that DM — it never starts one —
-- with a short onboarding guide that includes the team's ?tjoin= link.
--
-- What this does
--   • rivals_find_captain_by_phone(p_digits) — the sender's active
--     captain/vice memberships in live teams, matched on players.phone
--     with the same adjunto_phones_match() the Treinador Adjunto uses.
--     Read-only.
--   • rivals_bot_team_invite(p_team_id, p_player_id) — the team's live
--     invite link, created (on behalf of that captain/vice) when there is
--     none or it is expired / used up. Same rules as create_team_invite
--     (one live link per team, 14 days), plus an audit row (via 'bot').
--   • adjunto_dm_replies.kind += 'rivals_captain_help',
--     'rivals_captain_not_found' (throttles for the two bot replies).
--
-- Both functions are SECURITY DEFINER and service_role ONLY (the bot);
-- nobody else can execute them. No new tables (so no table grants).
-- Never touches games / attendances / matchdays.
-- Sorts after 20260101007100 (challenges, built concurrently) on purpose;
-- it depends only on 007000 (teams/invites) and 006300/006400 (Adjunto).
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

-- ── 1. Throttle kinds for the new unlinked-sender replies ──
alter table public.adjunto_dm_replies drop constraint if exists adjunto_dm_replies_kind_check;
alter table public.adjunto_dm_replies add constraint adjunto_dm_replies_kind_check
  check (kind in ('code_invalid','phrase_not_found','rivals_captain_help','rivals_captain_not_found'));

-- ── 2. Who is this captain? ──────────────────────────────
-- One row per (player, team) where the player is an ACTIVE captain or vice
-- of a non-archived team. Newest team first. >1 distinct player_id for one
-- number = dirty data → the bot treats it as not found.
create or replace function public.rivals_find_captain_by_phone(p_digits text)
returns table (player_id uuid, nick text, team_id uuid, team_name text, team_slug text,
               role text, member_count int, team_created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.nick, p.name), t.id, t.name, t.slug, m.role,
         (select count(*)::int from public.team_members x where x.team_id = t.id and x.status = 'active'),
         t.created_at
    from public.players p
    join public.team_members m on m.player_id = p.id and m.status = 'active' and m.role in ('captain','vice')
    join public.teams t on t.id = m.team_id and t.archived_at is null
   where p.phone is not null
     and length(regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g')) >= 8
     and public.adjunto_phones_match('+' || regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g'), p.phone)
   order by t.created_at desc, t.id;
$$;

-- ── 3. The team's live invite link (create if missing) ───
-- → {token, expires_at, uses, max_uses, created}. Raises rivals:<code>.
create or replace function public.rivals_bot_team_invite(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_inv  public.team_invites%rowtype;
  v_had  boolean := false;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if not exists (select 1 from public.team_members
                  where team_id = p_team_id and player_id = p_player_id
                    and status = 'active' and role in ('captain','vice')) then
    raise exception 'rivals:not_team_leader';
  end if;

  select * into v_inv from public.team_invites where team_id = p_team_id and revoked_at is null for update;
  if found then
    v_had := true;
    if v_inv.expires_at > now() and (v_inv.max_uses is null or v_inv.uses < v_inv.max_uses) then
      return jsonb_build_object('token', v_inv.token, 'expires_at', v_inv.expires_at, 'uses', v_inv.uses,
                                'max_uses', v_inv.max_uses, 'created', false);
    end if;
    update public.team_invites set revoked_at = now() where id = v_inv.id;
  end if;

  insert into public.team_invites (team_id, created_by, created_at, expires_at)
  values (p_team_id, p_player_id, clock_timestamp(), now() + interval '14 days')
  returning * into v_inv;
  insert into public.rivals_audit_log (team_id, actor_player_id, action, payload)
  values (p_team_id, p_player_id, 'invite_created',
          jsonb_build_object('invite_id', v_inv.id, 'replaced_previous', v_had, 'ttl_days', 14, 'via', 'bot'));
  return jsonb_build_object('token', v_inv.token, 'expires_at', v_inv.expires_at, 'uses', v_inv.uses,
                            'max_uses', v_inv.max_uses, 'created', true);
end $$;

-- ── 4. EXECUTE grants: the bot (service_role) only ───────
revoke execute on function public.rivals_find_captain_by_phone(text) from public, anon, authenticated;
grant  execute on function public.rivals_find_captain_by_phone(text) to service_role;
revoke execute on function public.rivals_bot_team_invite(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.rivals_bot_team_invite(uuid, uuid) to service_role;
