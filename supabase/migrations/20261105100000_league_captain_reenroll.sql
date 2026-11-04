-- PITCH Ligas — a captain asks for last season's athletes back; the Gestor decides.
--
-- "Nova época" leaves every squad empty and parks the athletes' profiles in state.data.athletePool
-- ({id, name, number, position, pastTeamId, …}). The Gestor can re-register them, and now a captain can PROPOSE it:
--   * league_captain_save_squad accepts rows {reuse: '<pool id>'}: each becomes a pending request in
--     state.data.playerRequests (same list, same approval as a new athlete) with reuseId set. The pool entry must be
--     one of THIS team's former athletes. Nothing enters the squad until the Gestor approves.
--   * league_member_state returns the captain's own team's pool (id, name, number, position), so the app can list them.
-- Everything else is exactly as in 20261104120000 / 20261104130000. No tables, so no new grants.

create or replace function public.league_captain_save_squad(p_workspace uuid, p_team_id text, p_players jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_owner uuid; e record; v_old jsonb; v_id text; v_name text; v_nick text; v_num integer; v_pos text;
  v_new jsonb := '[]'::jsonb; v_others jsonb; v_seen_ids text[] := '{}'; v_seen_nums integer[] := '{}';
  v_history text; r record;
  v_req jsonb := '[]'::jsonb; v_reqs jsonb; v_added integer := 0;
  v_reuse text; v_pool jsonb;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select owner_user_id into v_owner from public.league_workspaces where id = p_workspace;
  if not found then raise exception 'league:forbidden' using errcode = '42501'; end if;
  -- same lock key as league_workspace_write, so the owner's save and this patch never interleave
  perform pg_advisory_xact_lock(hashtextextended('league_workspace:' || v_owner::text, 0));
  select * into w from public.league_workspaces where id = p_workspace for update;
  if not exists (select 1 from public.league_workspace_members m
                  where m.workspace_id = w.id and m.user_id = auth.uid() and m.status = 'active'
                    and m.role = 'captain' and m.team_id = p_team_id) then
    raise exception 'league:forbidden' using errcode = '42501';
  end if;
  if public.league_ws_team(w.state, p_team_id) is null then raise exception 'league:team_not_found' using errcode = 'P0002'; end if;
  if p_players is null or coalesce(jsonb_typeof(p_players), '') <> 'array' then raise exception 'league:invalid_squad' using errcode = '22023'; end if;
  if jsonb_array_length(p_players) > 60 then raise exception 'league:squad_too_large' using errcode = '22023'; end if;

  for e in select value from jsonb_array_elements(p_players) loop
    if coalesce(jsonb_typeof(e.value), '') <> 'object' then raise exception 'league:invalid_squad' using errcode = '22023'; end if;

    -- a former athlete of this team asked back: a request that points at the pool entry (the Gestor approves it)
    v_reuse := nullif(btrim(coalesce(e.value ->> 'reuse', '')), '');
    if v_reuse is not null then
      select q into v_pool
        from jsonb_array_elements(case when jsonb_typeof(w.state #> '{data,athletePool}') = 'array' then w.state #> '{data,athletePool}' else '[]'::jsonb end) q
       where q ->> 'id' = v_reuse and q ->> 'pastTeamId' = p_team_id
       limit 1;
      if v_pool is null then raise exception 'league:player_not_found' using errcode = 'P0002'; end if;
      v_req := v_req || jsonb_build_array(jsonb_build_object(
        'id', 'rq-' || substr(md5(random()::text || clock_timestamp()::text || v_reuse), 1, 10),
        'teamId', p_team_id, 'name', v_pool ->> 'name', 'number', v_pool -> 'number', 'position', v_pool -> 'position',
        'reuseId', v_reuse, 'status', 'pending',
        'requestedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
      continue;
    end if;

    v_name := left(btrim(coalesce(e.value ->> 'name', '')), 80);
    if length(v_name) < 1 then raise exception 'league:name_required' using errcode = '22023'; end if;
    v_nick := left(btrim(coalesce(e.value ->> 'nick', '')), 30);
    v_pos := left(btrim(coalesce(e.value ->> 'position', '')), 20);
    if nullif(btrim(coalesce(e.value ->> 'number', '')), '') is null then v_num := null;
    elsif btrim(e.value ->> 'number') ~ '^[0-9]{1,2}$' then v_num := btrim(e.value ->> 'number')::integer;
    else raise exception 'league:invalid_number' using errcode = '22023'; end if;
    if v_num is not null then
      if v_num = any (v_seen_nums) then raise exception 'league:duplicate_number' using errcode = '22023'; end if;
      v_seen_nums := v_seen_nums || v_num;
    end if;
    v_id := nullif(btrim(coalesce(e.value ->> 'id', '')), '');
    v_old := null;
    if v_id is not null then
      v_old := public.league_ws_player(w.state, v_id);
      -- an id from another team (or one that does not exist) is not accepted: new players get a fresh id
      if v_old is not null and v_old ->> 'teamId' is distinct from p_team_id then raise exception 'league:invalid_player' using errcode = '22023'; end if;
      if v_old is null then v_id := null; end if;
    end if;
    if v_id is null then
      -- a NEW athlete never enters the league by itself: it becomes a request the Gestor approves or refuses
      v_req := v_req || jsonb_build_array(jsonb_build_object(
        'id', 'rq-' || substr(md5(random()::text || clock_timestamp()::text || v_name), 1, 10),
        'teamId', p_team_id, 'name', v_name, 'number', v_num, 'position', nullif(v_pos, ''), 'status', 'pending',
        'requestedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
      continue;
    end if;
    if v_id = any (v_seen_ids) then raise exception 'league:duplicate_player' using errcode = '22023'; end if;
    v_seen_ids := v_seen_ids || v_id;
    v_new := v_new || jsonb_build_array(coalesce(v_old, '{}'::jsonb) || jsonb_build_object(
      'id', v_id, 'teamId', p_team_id, 'name', v_name, 'nick', nullif(v_nick, ''), 'number', v_num,
      'position', nullif(v_pos, ''), 'captain', coalesce(e.value -> 'captain' = 'true'::jsonb, false)));
  end loop;

  -- the requests: no duplicates of a pending one (same name, or the same pool entry), a ceiling per team
  v_reqs := case when jsonb_typeof(w.state #> '{data,playerRequests}') = 'array' then w.state #> '{data,playerRequests}' else '[]'::jsonb end;
  for e in select value from jsonb_array_elements(v_req) loop
    if exists (select 1 from jsonb_array_elements(v_reqs) q
                where q ->> 'teamId' = p_team_id and q ->> 'status' = 'pending'
                  and (lower(q ->> 'name') = lower(e.value ->> 'name')
                       or ((e.value ->> 'reuseId') is not null and q ->> 'reuseId' = e.value ->> 'reuseId'))) then continue; end if;
    if (select count(*) from jsonb_array_elements(v_reqs) q where q ->> 'teamId' = p_team_id and q ->> 'status' = 'pending') >= 40 then
      raise exception 'league:too_many_requests' using errcode = '22023';
    end if;
    v_reqs := v_reqs || jsonb_build_array(e.value);
    v_added := v_added + 1;
  end loop;

  -- removals: only players with no trace in matches or logs
  v_history := coalesce((w.state -> 'logs')::text, '') || coalesce((w.state -> 'matches')::text, '');
  for r in select p ->> 'id' as id
             from jsonb_array_elements(case when jsonb_typeof(w.state #> '{data,players}') = 'array' then w.state #> '{data,players}' else '[]'::jsonb end) p
            where p ->> 'teamId' = p_team_id loop
    if not (r.id = any (v_seen_ids)) and position('"' || r.id || '"' in v_history) > 0 then
      raise exception 'league:player_has_history' using errcode = 'P0001';
    end if;
  end loop;

  select coalesce(jsonb_agg(p), '[]'::jsonb) into v_others
    from jsonb_array_elements(case when jsonb_typeof(w.state #> '{data,players}') = 'array' then w.state #> '{data,players}' else '[]'::jsonb end) p
   where p ->> 'teamId' is distinct from p_team_id;
  update public.league_workspaces
     set state = jsonb_set(jsonb_set(w.state, '{data,players}', v_others || v_new), '{data,playerRequests}', v_reqs),
         version = w.version + 1, updated_at = now()
   where id = w.id returning * into w;
  return jsonb_build_object('version', w.version, 'players', v_new, 'requested', v_added);
end $$;

create or replace function public.league_member_state(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype; s jsonb; players jsonb; v_me jsonb; v_role text;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where id = p_workspace;
  if not found then raise exception 'league:forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'teamId', m.team_id, 'playerId', m.player_id) order by m.created_at), '[]'::jsonb)
    into v_me
    from public.league_workspace_members m
   where m.workspace_id = w.id and m.user_id = auth.uid() and m.status = 'active';
  if jsonb_array_length(v_me) = 0 then raise exception 'league:forbidden' using errcode = '42501'; end if;
  v_role := case when exists (select 1 from jsonb_array_elements(v_me) x where x ->> 'role' = 'captain') then 'captain' else 'athlete' end;
  s := w.state;
  select coalesce(jsonb_agg(
           case when exists (select 1 from jsonb_array_elements(v_me) x
                              where (x ->> 'role' = 'captain' and x ->> 'teamId' = p ->> 'teamId')
                                 or (x ->> 'role' = 'athlete' and x ->> 'playerId' = p ->> 'id'))
                then p
                else jsonb_build_object('id', p -> 'id', 'teamId', p -> 'teamId', 'name', p -> 'name', 'nick', p -> 'nick',
                                        'position', p -> 'position', 'number', p -> 'number', 'captain', coalesce(p -> 'captain', 'false'::jsonb))
           end), '[]'::jsonb)
    into players
    from jsonb_array_elements(case when jsonb_typeof(s #> '{data,players}') = 'array' then s #> '{data,players}' else '[]'::jsonb end) p;
  return jsonb_build_object(
    'workspace_id', w.id, 'slug', w.slug, 'name', w.name, 'version', w.version, 'updated_at', w.updated_at,
    'me', v_me,
    'state', jsonb_build_object(
      'version', s -> 'version',
      'data', jsonb_build_object(
        'league', coalesce(s #> '{data,league}', '{}'::jsonb),
        'competitions', coalesce(s #> '{data,competitions}', '[]'::jsonb),
        'teams', coalesce(s #> '{data,teams}', '[]'::jsonb),
        'players', players,
        'seasons', coalesce(s #> '{data,seasons}', '[]'::jsonb),
        -- a captain sees the requests of their own team (pending and decided), nobody else's
        'playerRequests', coalesce((
          select jsonb_agg(q order by q ->> 'requestedAt')
            from jsonb_array_elements(case when jsonb_typeof(s #> '{data,playerRequests}') = 'array' then s #> '{data,playerRequests}' else '[]'::jsonb end) q
           where exists (select 1 from jsonb_array_elements(v_me) x where x ->> 'role' = 'captain' and x ->> 'teamId' = q ->> 'teamId')), '[]'::jsonb),
        -- former athletes of the captain's own team who are not registered this season (so they can be asked back)
        'athletePool', coalesce((
          select jsonb_agg(jsonb_build_object('id', q -> 'id', 'name', q -> 'name', 'number', q -> 'number', 'position', q -> 'position', 'pastTeamId', q -> 'pastTeamId') order by q ->> 'name')
            from jsonb_array_elements(case when jsonb_typeof(s #> '{data,athletePool}') = 'array' then s #> '{data,athletePool}' else '[]'::jsonb end) q
           where exists (select 1 from jsonb_array_elements(v_me) x where x ->> 'role' = 'captain' and x ->> 'teamId' = q ->> 'pastTeamId')), '[]'::jsonb)),
      'modules', coalesce(s -> 'modules', '{}'::jsonb),
      'matches', coalesce(s -> 'matches', '[]'::jsonb),
      'logs', coalesce(s -> 'logs', '{}'::jsonb),
      'announcements', coalesce(s -> 'announcements', '[]'::jsonb),
      'fanVotes', '{}'::jsonb, 'fantasy', '{}'::jsonb,
      'viewer', jsonb_build_object('role', v_role, 'entered', true),
      'prefs', jsonb_build_object('supportTeamId', null, 'followTeamIds', '[]'::jsonb, 'followPlayerIds', '[]'::jsonb,
                                  'notifyResults', true, 'notifyCalendar', true)));
end $$;
