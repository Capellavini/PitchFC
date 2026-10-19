-- SECURITY FIX (2026-10-19): update_team and remove_team_member let ANY
-- signed-in non-member through. For a non-member team_role() is NULL, and
--   not (is_admin() or NULL in ('captain','vice'))  →  not (false or NULL)
--   → NULL, which IF treats as false, so the guard never raised. Found by
-- supabase/tests/rivals_teams_check.sql ("outsider cannot edit the team")
-- on the production run. Same bodies as 20260101007000, with the role
-- coalesced to '' so a non-member is always rejected. No schema change;
-- existing grants on these functions are kept by CREATE OR REPLACE.

create or replace function public.update_team(p_team_id uuid, p_fields jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  f      jsonb := coalesce(p_fields, '{}'::jsonb);
  v_team public.teams%rowtype;
  v_role text;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  v_role := public.team_role(p_team_id);
  if not (public.is_admin() or coalesce(v_role, '') in ('captain','vice')) then
    raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;
  if (f ? 'name' or f ? 'listed') and not (public.is_admin() or coalesce(v_role, '') = 'captain') then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  perform public.rivals_validate_team_fields(f, false);

  begin
    update public.teams set
      name             = case when f ? 'name'             then btrim(f->>'name') else name end,
      city             = case when f ? 'city'             then nullif(btrim(f->>'city'), '') else city end,
      region           = case when f ? 'region'           then nullif(btrim(f->>'region'), '') else region end,
      country          = case when f ? 'country'          then coalesce(f->>'country', country) else country end,
      listed           = case when f ? 'listed'           then coalesce((f->>'listed')::boolean, listed) else listed end,
      color            = case when f ? 'color'            then coalesce(f->>'color', color) else color end,
      secondary_color  = case when f ? 'secondary_color'  then f->>'secondary_color' else secondary_color end,
      home_venue       = case when f ? 'home_venue'       then nullif(btrim(f->>'home_venue'), '') else home_venue end,
      preferred_format = case when f ? 'preferred_format' then f->>'preferred_format' else preferred_format end,
      logo_url         = case when f ? 'logo_url'         then nullif(f->>'logo_url', '') else logo_url end,
      timezone         = case when f ? 'timezone'         then coalesce(f->>'timezone', timezone) else timezone end,
      currency         = case when f ? 'currency'         then coalesce(f->>'currency', currency) else currency end,
      updated_at       = now()
    where id = p_team_id;
  exception when unique_violation then
    raise exception 'rivals:duplicate_name';
  end;

  perform public.rivals_audit(p_team_id, 'team_updated',
    jsonb_build_object('fields', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from jsonb_object_keys(f) k)));
  return jsonb_build_object('team_id', v_team.id, 'slug', v_team.slug);
end $$;

create or replace function public.remove_team_member(p_team_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_mem  public.team_members%rowtype;
  v_me   text;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_team.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  v_me := public.team_role(p_team_id);
  if not (public.is_admin() or coalesce(v_me, '') in ('captain','vice')) then
    raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;
  if p_player_id = public.my_player_id() then raise exception 'rivals:use_leave'; end if;
  select * into v_mem from public.team_members where team_id = p_team_id and player_id = p_player_id and status = 'active';
  if not found then raise exception 'rivals:not_a_member'; end if;
  if v_mem.role = 'captain' then raise exception 'rivals:cannot_remove_captain' using errcode = '42501'; end if;
  if v_mem.role = 'vice' and not (public.is_admin() or coalesce(v_me, '') = 'captain') then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  update public.team_members set status = 'removed', left_at = clock_timestamp() where id = v_mem.id;
  perform public.rivals_audit(p_team_id, 'member_removed', jsonb_build_object('player_id', p_player_id, 'role', v_mem.role));
  return jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id);
end $$;
