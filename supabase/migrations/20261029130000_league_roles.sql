-- ─────────────────────────────────────────────────────────
-- PITCH Ligas — papéis sobre o documento da liga (fase R1).
--
-- Até aqui só o dono de uma liga a conseguia abrir. Esta migração acrescenta
-- pertença e convites, para que um capitão ou um atleta entre na liga do seu
-- clube e veja (e, no caso do capitão, edite) só a sua parte. Tudo passa por
-- funções: as tabelas têm RLS ligada, sem políticas e sem acesso direto.
--
--   league_workspace_members   quem pertence a que liga, com que papel e em que equipa
--   league_workspace_invites   convites por link (token longo, expira, revogável)
--
--   league_invite_create / list / revoke     dono
--   league_invite_preview / accept           qualquer pessoa / pessoa com conta
--   league_members_list / remove             dono
--   league_my_memberships                    as ligas em que sou capitão ou atleta
--   league_member_state                      a liga vista por um membro (sem Fantasy, sem votos)
--   league_captain_save_squad                o capitão grava o plantel da sua equipa
--   league_workspace_version                 versão da minha liga (a app do dono confirma-a)
--
-- Papéis disponíveis nesta fase: captain, athlete. 'manager' fica reservado
-- (co-gestor, fase R6). Erros: 'league:<code>'.
-- ─────────────────────────────────────────────────────────

create table if not exists public.league_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('manager', 'captain', 'athlete')),
  team_id text,
  player_id text,
  status text not null default 'active' check (status in ('active', 'removed')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint league_members_scope check (
    (role = 'manager' and team_id is null and player_id is null)
    or (role = 'captain' and team_id is not null and player_id is null)
    or (role = 'athlete' and team_id is not null))
);
create unique index if not exists league_members_scope_key
  on public.league_workspace_members (workspace_id, user_id, role, coalesce(team_id, ''))
  where status = 'active';
create unique index if not exists league_members_player_key
  on public.league_workspace_members (workspace_id, player_id)
  where status = 'active' and role = 'athlete' and player_id is not null;
create index if not exists league_members_user_idx
  on public.league_workspace_members (user_id) where status = 'active';

create table if not exists public.league_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  role text not null check (role in ('manager', 'captain', 'athlete')),
  team_id text,
  player_id text,
  max_uses integer not null default 1 check (max_uses between 1 and 200),
  uses integer not null default 0 check (uses >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz
);
create index if not exists league_invites_ws_idx on public.league_workspace_invites (workspace_id, created_at desc);

alter table public.league_workspace_members enable row level security;
alter table public.league_workspace_invites enable row level security;
revoke all on table public.league_workspace_members, public.league_workspace_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.league_workspace_members, public.league_workspace_invites to service_role;

-- ── helpers ───────────────────────────────────────────────
create or replace function public.league_ws_team(p_state jsonb, p_team text)
returns jsonb language sql immutable set search_path = '' as $$
  select e.value
    from jsonb_array_elements(case when jsonb_typeof(p_state #> '{data,teams}') = 'array' then p_state #> '{data,teams}' else '[]'::jsonb end) as e(value)
   where e.value ->> 'id' = p_team
   limit 1
$$;
create or replace function public.league_ws_player(p_state jsonb, p_player text)
returns jsonb language sql immutable set search_path = '' as $$
  select e.value
    from jsonb_array_elements(case when jsonb_typeof(p_state #> '{data,players}') = 'array' then p_state #> '{data,players}' else '[]'::jsonb end) as e(value)
   where e.value ->> 'id' = p_player
   limit 1
$$;
revoke all on function public.league_ws_team(jsonb, text), public.league_ws_player(jsonb, text) from public, anon, authenticated;

-- ── 1. Invites (owner) ────────────────────────────────────
create or replace function public.league_invite_create(
  p_role text, p_team_id text, p_player_id text default null, p_max_uses integer default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_player jsonb; v_max integer; i public.league_workspace_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  if coalesce(p_role, '') not in ('captain', 'athlete') then raise exception 'league:invalid_role' using errcode = '22023'; end if;
  if public.league_ws_team(w.state, p_team_id) is null then raise exception 'league:team_not_found' using errcode = 'P0002'; end if;
  if p_player_id is not null then
    if p_role <> 'athlete' then raise exception 'league:invalid_role' using errcode = '22023'; end if;
    v_player := public.league_ws_player(w.state, p_player_id);
    if v_player is null or v_player ->> 'teamId' is distinct from p_team_id then
      raise exception 'league:player_not_found' using errcode = 'P0002';
    end if;
  end if;
  if (select count(*) from public.league_workspace_invites
       where workspace_id = w.id and revoked_at is null and expires_at > now()) >= 300 then
    raise exception 'league:too_many_invites' using errcode = '53400';
  end if;
  v_max := case when p_role = 'captain' or p_player_id is not null then 1
                else least(greatest(coalesce(p_max_uses, 60), 1), 200) end;
  insert into public.league_workspace_invites (workspace_id, role, team_id, player_id, max_uses, created_by)
    values (w.id, p_role, p_team_id, p_player_id, v_max, auth.uid()) returning * into i;
  return jsonb_build_object('id', i.id, 'token', i.token, 'role', i.role, 'team_id', i.team_id,
                            'player_id', i.player_id, 'max_uses', i.max_uses, 'expires_at', i.expires_at);
end $$;

create or replace function public.league_invites_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', i.id, 'token', i.token, 'role', i.role, 'team_id', i.team_id, 'player_id', i.player_id,
             'team_name', public.league_ws_team(w.state, i.team_id) ->> 'name',
             'player_name', public.league_ws_player(w.state, i.player_id) ->> 'name',
             'max_uses', i.max_uses, 'uses', i.uses, 'expires_at', i.expires_at, 'created_at', i.created_at,
             'status', case when i.revoked_at is not null then 'revoked'
                            when i.uses >= i.max_uses then 'used'
                            when i.expires_at <= now() then 'expired' else 'open' end)
           order by i.created_at desc)
      from public.league_workspace_invites i where i.workspace_id = w.id), '[]'::jsonb);
end $$;

create or replace function public.league_invite_revoke(p_invite uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  update public.league_workspace_invites set revoked_at = coalesce(revoked_at, now())
   where id = p_invite and workspace_id = w.id;
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('revoked', true);
end $$;

-- ── 2. Preview and accept ─────────────────────────────────
-- Preview works without an account: it only says which league, role and team the link is for.
create or replace function public.league_invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i public.league_workspace_invites%rowtype; w public.league_workspaces%rowtype; v_already boolean := false;
begin
  select * into i from public.league_workspace_invites where token = btrim(coalesce(p_token, ''));
  if not found then return null; end if;
  select * into w from public.league_workspaces where id = i.workspace_id;
  if auth.uid() is not null then
    v_already := exists (select 1 from public.league_workspace_members m
                          where m.workspace_id = i.workspace_id and m.user_id = auth.uid() and m.status = 'active'
                            and m.role = i.role and coalesce(m.team_id, '') = coalesce(i.team_id, ''));
  end if;
  if not v_already and (i.revoked_at is not null or i.expires_at <= now() or i.uses >= i.max_uses) then return null; end if;
  return jsonb_build_object(
    'league_name', w.name, 'role', i.role, 'team_id', i.team_id,
    'team_name', public.league_ws_team(w.state, i.team_id) ->> 'name',
    'player_name', public.league_ws_player(w.state, i.player_id) ->> 'name',
    'already', v_already);
end $$;

create or replace function public.league_invite_accept(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  i public.league_workspace_invites%rowtype; w public.league_workspaces%rowtype; m public.league_workspace_members%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into i from public.league_workspace_invites where token = btrim(coalesce(p_token, '')) for update;
  if not found then raise exception 'league:invalid_invite' using errcode = 'P0002'; end if;
  select * into w from public.league_workspaces where id = i.workspace_id;
  if w.owner_user_id = auth.uid() then raise exception 'league:owner_cannot_join' using errcode = '22023'; end if;
  select * into m from public.league_workspace_members
   where workspace_id = i.workspace_id and user_id = auth.uid() and status = 'active'
     and role = i.role and coalesce(team_id, '') = coalesce(i.team_id, '');
  if not found then
    if i.revoked_at is not null or i.expires_at <= now() then raise exception 'league:invalid_invite' using errcode = 'P0002'; end if;
    if i.uses >= i.max_uses then raise exception 'league:invite_used' using errcode = 'P0001'; end if;
    if i.player_id is not null and exists (
         select 1 from public.league_workspace_members x
          where x.workspace_id = i.workspace_id and x.role = 'athlete' and x.player_id = i.player_id and x.status = 'active') then
      raise exception 'league:player_taken' using errcode = 'P0001';
    end if;
    insert into public.league_workspace_members (workspace_id, user_id, role, team_id, player_id, invited_by)
      values (i.workspace_id, auth.uid(), i.role, i.team_id, i.player_id, i.created_by) returning * into m;
    update public.league_workspace_invites set uses = uses + 1 where id = i.id;
  end if;
  return jsonb_build_object('workspace_id', w.id, 'slug', w.slug, 'league_name', w.name,
                            'role', m.role, 'team_id', m.team_id, 'player_id', m.player_id);
end $$;

-- ── 3. Members (owner) and "my leagues" ───────────────────
create or replace function public.league_members_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'role', m.role, 'team_id', m.team_id, 'player_id', m.player_id,
             'team_name', public.league_ws_team(w.state, m.team_id) ->> 'name',
             'player_name', public.league_ws_player(w.state, m.player_id) ->> 'name',
             'email', regexp_replace(coalesce(u.email, ''), '^(.).*(@.*)$', '\1•••\2'),
             'created_at', m.created_at) order by m.created_at)
      from public.league_workspace_members m
      join auth.users u on u.id = m.user_id
     where m.workspace_id = w.id and m.status = 'active'), '[]'::jsonb);
end $$;

create or replace function public.league_member_remove(p_member uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select * into w from public.league_workspaces where owner_user_id = auth.uid();
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  update public.league_workspace_members set status = 'removed', removed_at = now()
   where id = p_member and workspace_id = w.id and status = 'active';
  if not found then raise exception 'league:not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('removed', true);
end $$;

create or replace function public.league_my_memberships()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'workspace_id', w.id, 'slug', w.slug, 'league_name', w.name, 'role', m.role,
             'team_id', m.team_id, 'team_name', public.league_ws_team(w.state, m.team_id) ->> 'name',
             'player_id', m.player_id, 'player_name', public.league_ws_player(w.state, m.player_id) ->> 'name')
           order by m.created_at)
      from public.league_workspace_members m
      join public.league_workspaces w on w.id = m.workspace_id
     where m.user_id = auth.uid() and m.status = 'active'), '[]'::jsonb);
end $$;

-- ── 4. The league as a member sees it ─────────────────────
-- Same projection as the public page, plus the full records the member owns:
-- a captain sees every field of their own team's players, an athlete of their own record.
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
        'players', players),
      'modules', coalesce(s -> 'modules', '{}'::jsonb),
      'matches', coalesce(s -> 'matches', '[]'::jsonb),
      'logs', coalesce(s -> 'logs', '{}'::jsonb),
      'announcements', coalesce(s -> 'announcements', '[]'::jsonb),
      'fanVotes', '{}'::jsonb, 'fantasy', '{}'::jsonb,
      'viewer', jsonb_build_object('role', v_role, 'entered', true),
      'prefs', jsonb_build_object('supportTeamId', null, 'followTeamIds', '[]'::jsonb, 'followPlayerIds', '[]'::jsonb,
                                  'notifyResults', true, 'notifyCalendar', true)));
end $$;

-- ── 5. Captain saves the squad of their own team ──────────
-- Patch, not replace: players keep their ids (events refer to them), other teams are untouched,
-- extra fields already on a player survive. A player with recorded history cannot be removed.
create or replace function public.league_captain_save_squad(p_workspace uuid, p_team_id text, p_players jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype;
  v_owner uuid; e record; v_old jsonb; v_id text; v_name text; v_nick text; v_num integer; v_pos text;
  v_new jsonb := '[]'::jsonb; v_others jsonb; v_seen_ids text[] := '{}'; v_seen_nums integer[] := '{}';
  v_history text; r record;
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
  if jsonb_array_length(p_players) > 40 then raise exception 'league:squad_too_large' using errcode = '22023'; end if;

  for e in select value from jsonb_array_elements(p_players) loop
    if coalesce(jsonb_typeof(e.value), '') <> 'object' then raise exception 'league:invalid_squad' using errcode = '22023'; end if;
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
    if v_id is null then v_id := 'pl-' || substr(md5(random()::text || clock_timestamp()::text || v_name), 1, 10); end if;
    if v_id = any (v_seen_ids) then raise exception 'league:duplicate_player' using errcode = '22023'; end if;
    v_seen_ids := v_seen_ids || v_id;
    v_new := v_new || jsonb_build_array(coalesce(v_old, '{}'::jsonb) || jsonb_build_object(
      'id', v_id, 'teamId', p_team_id, 'name', v_name, 'nick', nullif(v_nick, ''), 'number', v_num,
      'position', nullif(v_pos, ''), 'captain', coalesce(e.value -> 'captain' = 'true'::jsonb, false)));
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
     set state = jsonb_set(w.state, '{data,players}', v_others || v_new), version = w.version + 1, updated_at = now()
   where id = w.id returning * into w;
  return jsonb_build_object('version', w.version, 'players', v_new);
end $$;

-- ── 6. Owner: cheap version check (the app reloads when someone else saved) ──
create or replace function public.league_workspace_version()
returns integer language plpgsql stable security definer set search_path = '' as $$
declare v integer;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  select version into v from public.league_workspaces where owner_user_id = auth.uid();
  return v;
end $$;

-- ── grants ────────────────────────────────────────────────
revoke all on function
  public.league_invite_create(text, text, text, integer), public.league_invites_list(), public.league_invite_revoke(uuid),
  public.league_invite_preview(text), public.league_invite_accept(text), public.league_members_list(),
  public.league_member_remove(uuid), public.league_my_memberships(), public.league_member_state(uuid),
  public.league_captain_save_squad(uuid, text, jsonb), public.league_workspace_version()
  from public, anon;
grant execute on function
  public.league_invite_create(text, text, text, integer), public.league_invites_list(), public.league_invite_revoke(uuid),
  public.league_invite_accept(text), public.league_members_list(), public.league_member_remove(uuid),
  public.league_my_memberships(), public.league_member_state(uuid), public.league_captain_save_squad(uuid, text, jsonb),
  public.league_workspace_version()
  to authenticated;
grant execute on function public.league_invite_preview(text) to anon, authenticated;

comment on table public.league_workspace_members is 'PITCH Ligas: who belongs to a league workspace and with which role (captain, athlete). RPC-only.';
comment on table public.league_workspace_invites is 'PITCH Ligas: invite links for captains and athletes. RPC-only.';
