-- ─────────────────────────────────────────────────────────
-- PITCH Ligas — Pitch Manager for REAL leagues (the same game and engine as
-- the group app, fed with the league's own athletes and rounds).
--
-- A real league is ONE state document owned by its Gestor (league_workspaces).
-- The Pitch Manager needs per-person data (one squad per account) and a fair
-- lock, so it gets its own two tables; the league state stays the single
-- source of matches, athletes and event logs (scoring runs in the client with
-- the same pure engine, over what is locked here).
--
--   • league_pm_squads        one CURRENT squad per account and league
--   • league_pm_locks         one snapshot per round: every squad as it was
--                             at the round's first kick-off (the only thing
--                             scoring ever reads — edits after it count for
--                             the NEXT round)
--   • league_pm_rounds()      rounds + first kick-off, read from the state
--   • league_pm_lock_due()    lazily snapshots every round whose first match
--                             has kicked off (run before every read/write)
--   • league_pm_board()       my squad, the locked lineups, how many managers
--                             own each athlete (counts only, never whose)
--   • league_pm_save_squad()  the ONLY way to change a squad
--
-- Who plays: the league's Gestor and its active members (captains, athletes).
-- Fans with an account on the public page are a later slice.
--
-- Known limit (documented, same as the demo): the server checks structure
-- (athletes exist, no duplicates, captain/vice/Conexão are starters, sizes) but
-- NOT the budget — prices come from form and are computed by the engine in
-- the client. Pitch Manager in Ligas has no money and no prizes.
--
-- Additive and idempotent. Errors: 'league:<code>'. Explicit grants (the
-- Data API stops auto-granting new tables on 2026-10-30).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.league_pm_squads (
  workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  squad jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint league_pm_squad_object check (jsonb_typeof(squad) = 'object'),
  constraint league_pm_squad_size check (octet_length(squad::text) <= 20000)
);

create table if not exists public.league_pm_locks (
  workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
  round integer not null,
  kickoff_at timestamptz not null,
  lineups jsonb not null default '{}'::jsonb,
  locked_at timestamptz not null default now(),
  primary key (workspace_id, round),
  constraint league_pm_lock_object check (jsonb_typeof(lineups) = 'object')
);

alter table public.league_pm_squads enable row level security;
alter table public.league_pm_locks enable row level security;
revoke all on table public.league_pm_squads, public.league_pm_locks from public, anon, authenticated;
grant select, insert, update, delete on table public.league_pm_squads, public.league_pm_locks to service_role;

-- ── 2. Rounds, from the state ────────────────────────────
-- Pitch Manager follows ONE competition: the first one that is not a cup (the
-- league table). → jsonb [{ round, kickoff_at }] ascending, one per round, the
-- kick-off being the round's EARLIEST non-cancelled match. A kick-off with no
-- offset is Lisbon time (the app's convention); unparseable rows are skipped.
create or replace function public.league_pm_rounds(p_state jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_comp text;
  m jsonb;
  v_round integer;
  v_ko timestamptz;
  v_raw text;
  v_rounds jsonb := '{}'::jsonb;
  v_cur timestamptz;
  v_out jsonb;
begin
  select c ->> 'id' into v_comp
    from jsonb_array_elements(case when jsonb_typeof(p_state #> '{data,competitions}') = 'array' then p_state #> '{data,competitions}' else '[]'::jsonb end)
         with ordinality as x(c, n)
   where coalesce(c ->> 'kind', 'league') <> 'cup'
   order by n limit 1;

  for m in select e from jsonb_array_elements(case when jsonb_typeof(p_state -> 'matches') = 'array' then p_state -> 'matches' else '[]'::jsonb end) e loop
    begin
      continue when coalesce(m ->> 'state', '') = 'cancelled';
      continue when v_comp is not null and coalesce(m ->> 'competitionId', v_comp) <> v_comp;
      v_raw := m ->> 'kickoff';
      continue when v_raw is null or (m ->> 'round') is null or (m ->> 'round') !~ '^[0-9]{1,4}$';
      v_round := (m ->> 'round')::integer;
      if v_raw ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' then v_ko := v_raw::timestamptz;
      else v_ko := v_raw::timestamp at time zone 'Europe/Lisbon'; end if;
      v_cur := nullif(v_rounds ->> v_round::text, '')::timestamptz;
      if v_cur is null or v_ko < v_cur then
        v_rounds := jsonb_set(v_rounds, array[v_round::text], to_jsonb(v_ko::text));
      end if;
    exception when others then
      continue; -- a malformed match never blocks the others
    end;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('round', k::integer, 'kickoff_at', v) order by k::integer), '[]'::jsonb)
    into v_out from jsonb_each_text(v_rounds) as t(k, v);
  return v_out;
end $$;

-- ── 3. Access ────────────────────────────────────────────
-- The workspace the caller plays in: p_workspace = null → their own league
-- (the Gestor); otherwise they must be its owner or an active member.
create or replace function public.league_pm_workspace(p_workspace uuid)
returns public.league_workspaces language plpgsql stable security definer set search_path = '' as $$
declare w public.league_workspaces%rowtype;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  if p_workspace is null then
    select * into w from public.league_workspaces where owner_user_id = auth.uid();
  else
    select * into w from public.league_workspaces where id = p_workspace;
    if found and w.owner_user_id <> auth.uid() and not exists (
         select 1 from public.league_workspace_members m
          where m.workspace_id = w.id and m.user_id = auth.uid() and m.status = 'active') then
      raise exception 'league:forbidden' using errcode = '42501';
    end if;
  end if;
  if not found then raise exception 'league:forbidden' using errcode = '42501'; end if;
  return w;
end $$;

-- The module is the Gestor's switch (default off).
create or replace function public.league_pm_enabled(p_state jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce((p_state #>> '{modules,fantasy}') = 'true', false);
$$;

-- ── 4. Lock at kick-off ──────────────────────────────────
-- Snapshot every squad into each round whose first match has kicked off and
-- has no snapshot yet. Serialised per league so a squad saved at the same
-- instant lands either wholly before or wholly after the snapshot. Run first
-- by every read and write, so an edit made after a kick-off can never leak
-- into that round, even without a scheduler.
create or replace function public.league_pm_lock_due(p_workspace uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_state jsonb; r jsonb; v_round integer; v_ko timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('league_pm:' || p_workspace::text, 0));
  select state into v_state from public.league_workspaces where id = p_workspace;
  if v_state is null then return; end if;
  for r in select e from jsonb_array_elements(public.league_pm_rounds(v_state)) e loop
    v_round := (r ->> 'round')::integer;
    v_ko := (r ->> 'kickoff_at')::timestamptz;
    if v_ko <= now() and not exists (select 1 from public.league_pm_locks where workspace_id = p_workspace and round = v_round) then
      insert into public.league_pm_locks (workspace_id, round, kickoff_at, lineups)
      select p_workspace, v_round, v_ko,
             coalesce(jsonb_object_agg(s.user_id::text, jsonb_build_object('name', s.display_name, 'squad', s.squad)), '{}'::jsonb)
        from public.league_pm_squads s where s.workspace_id = p_workspace
      on conflict (workspace_id, round) do nothing;
    end if;
  end loop;
end $$;

-- ── 5. Squad validation ──────────────────────────────────
-- Structure only (see the header). Returns the squad as it is stored.
create or replace function public.league_pm_clean_squad(p_state jsonb, p_squad jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_ids text[]; v_bench text[]; v_starters text[]; v_all text[];
  v_cap text; v_vice text; v_conn jsonb := null; v_cr text; v_fi text; v_paid jsonb := '{}'::jsonb; k text; v numeric;
begin
  if p_squad is null or jsonb_typeof(p_squad) <> 'object' then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_squad -> 'player_ids', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_squad -> 'reserve_ids', '[]'::jsonb)) <> 'array' then
    raise exception 'league:pm_invalid' using errcode = '22023';
  end if;
  select coalesce(array_agg(x order by o), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_squad -> 'player_ids', '[]'::jsonb)) with ordinality t(x, o);
  select coalesce(array_agg(x order by o), '{}') into v_bench from jsonb_array_elements_text(coalesce(p_squad -> 'reserve_ids', '[]'::jsonb)) with ordinality t(x, o);
  if coalesce(array_length(v_ids, 1), 0) > 14 or coalesce(array_length(v_bench, 1), 0) > 9 then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  -- no duplicates, bench inside the squad
  if (select count(distinct x) from unnest(v_ids) x) <> coalesce(array_length(v_ids, 1), 0) then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  if (select count(distinct x) from unnest(v_bench) x) <> coalesce(array_length(v_bench, 1), 0) then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_bench) x where not (x = any (v_ids))) then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  v_starters := coalesce((select array_agg(x order by o) from unnest(v_ids) with ordinality t(x, o) where not (x = any (v_bench))), '{}');
  if coalesce(array_length(v_starters, 1), 0) > 5 then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  -- every athlete exists in this league
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(p_state #> '{data,players}') = 'array' then p_state #> '{data,players}' else '[]'::jsonb end) p
        where p ->> 'id' = x)) then
    raise exception 'league:pm_unknown_athlete' using errcode = '22023';
  end if;
  v_cap := nullif(p_squad ->> 'captain_id', '');
  v_vice := nullif(p_squad ->> 'vice_captain_id', '');
  if v_cap is not null and not (v_cap = any (v_starters)) then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  if v_vice is not null and (not (v_vice = any (v_starters)) or v_vice = v_cap) then raise exception 'league:pm_invalid' using errcode = '22023'; end if;
  -- Conexão: two distinct starters, creator → finisher
  if jsonb_typeof(p_squad -> 'connection') = 'object' then
    v_cr := nullif(p_squad #>> '{connection,creator_id}', '');
    v_fi := nullif(p_squad #>> '{connection,finisher_id}', '');
    if v_cr is null or v_fi is null or v_cr = v_fi or not (v_cr = any (v_starters)) or not (v_fi = any (v_starters)) then
      raise exception 'league:pm_connection_invalid' using errcode = '22023';
    end if;
    v_conn := jsonb_build_object('creator_id', v_cr, 'finisher_id', v_fi);
  end if;
  -- prices paid (display only): numbers keyed by athletes of the squad
  if jsonb_typeof(p_squad -> 'prices_paid') = 'object' then
    for k in select key from jsonb_each(p_squad -> 'prices_paid') loop
      continue when not (k = any (v_ids));
      begin v := (p_squad -> 'prices_paid' ->> k)::numeric; exception when others then continue; end;
      v_paid := v_paid || jsonb_build_object(k, v);
    end loop;
  end if;
  v_all := v_ids;
  return jsonb_build_object(
    'player_ids', to_jsonb(v_all), 'reserve_ids', to_jsonb(v_bench),
    'captain_id', to_jsonb(v_cap), 'vice_captain_id', to_jsonb(v_vice),
    'prices_paid', v_paid, 'connection', coalesce(v_conn, 'null'::jsonb));
end $$;

-- ── 6. Board ─────────────────────────────────────────────
create or replace function public.league_pm_board(p_workspace uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype; v_mine public.league_pm_squads%rowtype; v_locks jsonb; v_own jsonb;
begin
  w := public.league_pm_workspace(p_workspace);
  if not public.league_pm_enabled(w.state) then
    return jsonb_build_object('enabled', false, 'workspace_id', w.id, 'me', auth.uid());
  end if;
  perform public.league_pm_lock_due(w.id);
  select * into v_mine from public.league_pm_squads where workspace_id = w.id and user_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('round', l.round, 'kickoff_at', l.kickoff_at, 'lineups', l.lineups) order by l.round), '[]'::jsonb)
    into v_locks from public.league_pm_locks l where l.workspace_id = w.id;
  -- how many OTHER managers own each athlete right now (the ownership cap) — counts, never whose squad
  select coalesce(jsonb_object_agg(a.id, a.n), '{}'::jsonb) into v_own
    from (select pid as id, count(*) as n
            from public.league_pm_squads s, jsonb_array_elements_text(s.squad -> 'player_ids') pid
           where s.workspace_id = w.id and s.user_id <> auth.uid()
           group by pid) a;
  return jsonb_build_object(
    'enabled', true, 'workspace_id', w.id, 'me', auth.uid(),
    'mine', case when v_mine.user_id is null then null else v_mine.squad end,
    'name', case when v_mine.user_id is null then null else v_mine.display_name end,
    'locks', v_locks, 'ownership', v_own,
    'managers', (select coalesce(jsonb_agg(jsonb_build_object('uuid', s.user_id, 'name', s.display_name) order by s.updated_at), '[]'::jsonb)
                   from public.league_pm_squads s where s.workspace_id = w.id));
end $$;

-- ── 7. Save ──────────────────────────────────────────────
create or replace function public.league_pm_save_squad(p_workspace uuid, p_squad jsonb, p_name text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  w public.league_workspaces%rowtype; v_clean jsonb; v_name text;
begin
  w := public.league_pm_workspace(p_workspace);
  if not public.league_pm_enabled(w.state) then raise exception 'league:module_off' using errcode = '22023'; end if;
  -- the snapshot of every round that already kicked off is taken BEFORE this edit lands
  perform public.league_pm_lock_due(w.id);
  v_clean := public.league_pm_clean_squad(w.state, p_squad);
  v_name := left(btrim(coalesce(p_name, '')), 60);
  if v_name = '' then v_name := 'Treinador'; end if;
  insert into public.league_pm_squads (workspace_id, user_id, display_name, squad, updated_at)
  values (w.id, auth.uid(), v_name, v_clean, now())
  on conflict (workspace_id, user_id) do update
    set display_name = excluded.display_name, squad = excluded.squad, updated_at = now();
  return jsonb_build_object('saved', true, 'squad', v_clean, 'name', v_name);
end $$;

-- ── 8. Grants ────────────────────────────────────────────
revoke all on function
  public.league_pm_rounds(jsonb), public.league_pm_workspace(uuid), public.league_pm_enabled(jsonb),
  public.league_pm_lock_due(uuid), public.league_pm_clean_squad(jsonb, jsonb),
  public.league_pm_board(uuid), public.league_pm_save_squad(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.league_pm_board(uuid), public.league_pm_save_squad(uuid, jsonb, text) to authenticated;
grant execute on function
  public.league_pm_rounds(jsonb), public.league_pm_workspace(uuid), public.league_pm_enabled(jsonb),
  public.league_pm_lock_due(uuid), public.league_pm_clean_squad(jsonb, jsonb)
  to service_role;
