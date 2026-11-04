-- PITCH Ligas — closed seasons are part of what the public (and the members) can read.
--
-- "Fechar época" freezes champions, final tables, scorers and results into state.data.seasons[] (see
-- src/lib/leagueSeason.js). The public projection is a whitelist, so the archive has to be added to it:
-- it carries names, numbers, positions, results and tables only (no contacts, no event logs).
-- Both functions are re-created exactly as before plus the 'seasons' key; no tables, so no new grants.
-- Writing seasons stays the owner's: league_captain_save_squad only ever patches data.players and
-- data.playerRequests, and league_workspace_save is the owner's own call.

create or replace function public.league_workspace_public(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype; s jsonb; players jsonb;
begin
  select * into w from public.league_workspaces where slug = lower(btrim(coalesce(p_slug, ''))) and published;
  if not found then return null; end if;
  s := w.state;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p -> 'id', 'teamId', p -> 'teamId', 'name', p -> 'name', 'nick', p -> 'nick',
           'position', p -> 'position', 'number', p -> 'number', 'captain', coalesce(p -> 'captain', 'false'::jsonb))), '[]'::jsonb)
    into players
    from jsonb_array_elements(case when jsonb_typeof(s #> '{data,players}') = 'array' then s #> '{data,players}' else '[]'::jsonb end) p;
  return jsonb_build_object(
    'slug', w.slug, 'name', w.name, 'updated_at', w.updated_at,
    'state', jsonb_build_object(
      'version', s -> 'version',
      'data', jsonb_build_object(
        'league', coalesce(s #> '{data,league}', '{}'::jsonb),
        'competitions', coalesce(s #> '{data,competitions}', '[]'::jsonb),
        'teams', coalesce(s #> '{data,teams}', '[]'::jsonb),
        'players', players,
        -- closed seasons: results, tables, scorers and the champions the Gestor confirmed (no contacts, no event logs)
        'seasons', coalesce(s #> '{data,seasons}', '[]'::jsonb)),
      'modules', coalesce(s -> 'modules', '{}'::jsonb),
      'matches', coalesce(s -> 'matches', '[]'::jsonb),
      'logs', coalesce(s -> 'logs', '{}'::jsonb),
      'announcements', coalesce(s -> 'announcements', '[]'::jsonb),
      'fanVotes', '{}'::jsonb, 'fantasy', '{}'::jsonb,
      'viewer', jsonb_build_object('role', 'fan', 'entered', true),
      'prefs', jsonb_build_object('supportTeamId', null, 'followTeamIds', '[]'::jsonb, 'followPlayerIds', '[]'::jsonb,
                                  'notifyResults', true, 'notifyCalendar', true)));
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
           where exists (select 1 from jsonb_array_elements(v_me) x where x ->> 'role' = 'captain' and x ->> 'teamId' = q ->> 'teamId')), '[]'::jsonb)),
      'modules', coalesce(s -> 'modules', '{}'::jsonb),
      'matches', coalesce(s -> 'matches', '[]'::jsonb),
      'logs', coalesce(s -> 'logs', '{}'::jsonb),
      'announcements', coalesce(s -> 'announcements', '[]'::jsonb),
      'fanVotes', '{}'::jsonb, 'fantasy', '{}'::jsonb,
      'viewer', jsonb_build_object('role', v_role, 'entered', true),
      'prefs', jsonb_build_object('supportTeamId', null, 'followTeamIds', '[]'::jsonb, 'followPlayerIds', '[]'::jsonb,
                                  'notifyResults', true, 'notifyCalendar', true)));
end $$;
