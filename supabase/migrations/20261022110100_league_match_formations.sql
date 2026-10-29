-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L5 (design plan PR L5, second half):
-- persisted match formation (TacticsBoard) + the súmula team sheet.
--
-- Source: docs/ligas-draft-sql/05b_match_formations.sql (the event log,
-- draft 05, already shipped in 20261016155400_league_match_events.sql).
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.14. Check: supabase/tests/ligas_l5_check.sql.
--
-- Changes vs the draft (integration):
--   • save_match_formation ignores empty slots (null / "") instead of
--     failing, and caps the slots at the match format's players per side
--     ("5v5" → 5, so a futsal starting five = gk + 4) with at most one gk.
--     Format-generic: no futsal-specific rule is invented.
--   • match_formation also hides the photo-less youth names as initials
--     (unchanged) and returns the formation's team_id.
--   • NEW set_league_lineup(match, team, players[]): the mesa (assigned
--     scorer/referee) or a manager records who is on the team sheet of a
--     league match — today only the captain could, through the Rivals
--     set_match_lineup. Same table (team_match_lineup), same guard trigger
--     (homologated squad; L7 adds "not suspended"). Bumps seq, so a
--     homologation always quotes the sheet it saw.
--
-- Works for BOTH origins (league matches and Rivals friendlies) and is
-- organizational only: it never feeds the score, stats, standings or fantasy.
--   visibility 'team'      → saved for the team's members (planning)
--              'published' → part of the match page ("Escalações")
-- ─────────────────────────────────────────────────────────

create table if not exists public.team_match_formations (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.team_matches(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  version      int  not null check (version >= 1),
  formation    text not null check (formation ~ '^[0-9]{1,2}(-[0-9]{1,2}){1,4}$'),   -- "3-3-1", futsal "2-1-1"
  visibility   text not null default 'team' check (visibility in ('team','published')),
  status       text not null default 'current' check (status in ('current','superseded')),
  published_by uuid references public.players(id) on delete set null,
  published_at timestamptz not null default now(),
  constraint team_match_formations_version_key unique (match_id, team_id, version)
);
create unique index if not exists team_match_formations_one_current_key
  on public.team_match_formations (match_id, team_id) where status = 'current';

create table if not exists public.team_match_formation_slots (
  formation_id uuid not null references public.team_match_formations(id) on delete cascade,
  slot_key     text not null check (slot_key ~ '^(gk|def|mid|fwd)-[0-9]{1,2}$'),        -- TacticsBoard key
  player_id    uuid not null references public.players(id) on delete cascade,
  primary key (formation_id, slot_key),
  constraint team_match_formation_slots_player_key unique (formation_id, player_id)
);

alter table public.team_match_formations      enable row level security;
alter table public.team_match_formation_slots enable row level security;
drop policy if exists "team_match_formations select" on public.team_match_formations;
create policy "team_match_formations select" on public.team_match_formations for select to authenticated
  using (public.is_team_member(team_id) or (visibility = 'published' and public.can_see_match(match_id)));
drop policy if exists "team_match_formation_slots select" on public.team_match_formation_slots;
create policy "team_match_formation_slots select" on public.team_match_formation_slots for select to authenticated
  using (exists (select 1 from public.team_match_formations f where f.id = formation_id
                  and (public.is_team_member(f.team_id) or (f.visibility = 'published' and public.can_see_match(f.match_id)))));

-- Explicit Data API grants (CLAUDE.md, post-2026-10-30 rule). anon: none
-- (public pages go through RPCs, plan §5.2). authenticated: read only —
-- every write is a SECURITY DEFINER RPC. service_role: full.
revoke all on table public.team_match_formations, public.team_match_formation_slots from anon, authenticated;
grant select on table public.team_match_formations, public.team_match_formation_slots to authenticated;
grant select, insert, update, delete on table public.team_match_formations, public.team_match_formation_slots to service_role;

-- Can p_player play for p_team in match m? Friendly: active team member.
-- League: in the homologated squad (L7 redefines: and not suspended).
create or replace function public.league_player_eligible(m public.team_matches, p_team uuid, p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when m.source_type = 'competition' then public.league_in_squad(m, p_team, p_player)
              else exists (select 1 from public.team_members tm where tm.team_id = p_team and tm.player_id = p_player and tm.status = 'active') end;
$$;

-- save_match_formation(match, team, formation, slots {"def-0": player_id, …}, visibility, base_version)
--   → {version, visibility, slots}
-- Who: a leader (captain/vice) of that team, or a competition manager on a
-- league match. base_version = the version the editor started from (null
-- for the first save); stale → league:stale_formation, so captain and vice
-- never silently overwrite each other. Locked once the match is live.
create or replace function public.save_match_formation(p_match_id uuid, p_team_id uuid, p_formation text, p_slots jsonb,
                                                       p_visibility text default 'team', p_base_version int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_cur public.team_match_formations%rowtype; v_id uuid; v_ver int; s record;
        v_per_side int; v_n int; v_gk int;
begin
  -- Lock the match row (FOR UPDATE, no column change ⇒ the league guard
  -- trigger does not fire) to serialize concurrent saves.
  select * into m from public.team_matches where id = p_match_id for update;
  if not found or p_team_id is null or p_team_id not in (m.home_team_id, m.away_team_id) then raise exception 'league:match_not_found'; end if;
  if not (public.is_team_leader(p_team_id)
          or (m.source_type = 'competition' and public.is_league_manager(public.competition_league(m.competition_id), m.competition_id))) then
    raise exception 'league:not_team_leader' using errcode = '42501';
  end if;
  if m.match_status not in ('unscheduled','scheduled','postponed') then raise exception 'league:formation_locked'; end if;
  if p_visibility not in ('team','published') or p_slots is null or jsonb_typeof(p_slots) <> 'object' then
    raise exception 'league:invalid_formation';
  end if;
  select * into v_cur from public.team_match_formations where match_id = m.id and team_id = p_team_id and status = 'current';
  if p_base_version is distinct from v_cur.version then raise exception 'league:stale_formation'; end if;

  -- Empty slots (null / "") are simply not placed.
  select count(*), count(*) filter (where key like 'gk-%') into v_n, v_gk
    from jsonb_each_text(p_slots) where nullif(btrim(value), '') is not null;
  v_per_side := nullif(substring(coalesce(m.format, '') from '^([0-9]{1,2})v'), '')::int;
  if v_gk > 1 or (v_per_side is not null and v_n > v_per_side) then
    raise exception 'league:invalid_formation' using detail = 'too many players for ' || coalesce(m.format, '?');
  end if;
  for s in select key, value::uuid as pid from jsonb_each_text(p_slots) where nullif(btrim(value), '') is not null loop
    if not public.league_player_eligible(m, p_team_id, s.pid) then raise exception 'league:player_not_eligible' using detail = s.key; end if;
  end loop;

  update public.team_match_formations set status = 'superseded' where id = v_cur.id;
  v_ver := coalesce(v_cur.version, 0) + 1;
  insert into public.team_match_formations (match_id, team_id, version, formation, visibility, published_by)
  values (m.id, p_team_id, v_ver, p_formation, p_visibility, public.my_player_id()) returning id into v_id;
  insert into public.team_match_formation_slots (formation_id, slot_key, player_id)
  select v_id, x.key, x.value::uuid from jsonb_each_text(p_slots) x where nullif(btrim(x.value), '') is not null;
  return jsonb_build_object('version', v_ver, 'visibility', p_visibility, 'slots', v_n);
exception when unique_violation or check_violation or invalid_text_representation then
  raise exception 'league:invalid_formation';
end $$;

-- match_formation(match, team) → {team_id, formation, version, visibility, published_by, published_at,
--                                 slots{slot_key: {player_id, name}}} | null
-- Team members see the current one; anyone who can see the match sees it
-- once 'published'. Display names only; youth category → initials.
create or replace function public.match_formation(p_match_id uuid, p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.team_match_formations%rowtype; m public.team_matches%rowtype; v_youth boolean := false;
begin
  select * into f from public.team_match_formations where match_id = p_match_id and team_id = p_team_id and status = 'current';
  if not found then return null; end if;
  if not (public.is_team_member(p_team_id) or (f.visibility = 'published' and public.can_see_match(p_match_id))) then return null; end if;
  select * into m from public.team_matches where id = p_match_id;
  if m.competition_id is not null then
    v_youth := coalesce((select k.youth from public.competitions c join public.league_categories k on k.id = c.category_id
                          where c.id = m.competition_id), false);
  end if;
  return jsonb_build_object('team_id', f.team_id, 'formation', f.formation, 'version', f.version, 'visibility', f.visibility,
    'published_by', public.league_person_name(f.published_by), 'published_at', f.published_at,
    'slots', coalesce((select jsonb_object_agg(s.slot_key, jsonb_build_object('player_id', s.player_id,
               'name', case when v_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = s.player_id)
                            else public.league_person_name(s.player_id) end))
                       from public.team_match_formation_slots s where s.formation_id = f.id), '{}'::jsonb));
end $$;

-- set_league_lineup(match, team, player_ids[]) → {match_id, team_id, count, seq}
-- The súmula team sheet (who is on the sheet = appears in the official
-- stats at homologation). Who: league_operator_role (assigned scorer /
-- referee, owner/manager, team leaders only if team_leaders_can_score).
-- When: scheduled / live / finished while the súmula is open; after
-- submission only the homologation authority. ≤ 30 distinct ids. Squad and
-- suspension rules are enforced by the team_match_lineup league trigger.
-- Replaces that team's sheet. Futsal rolling substitutions need no extra
-- model: the whole sheet (starters + bench) goes here, the starting five in
-- the formation, and 'sub' events are informational.
create or replace function public.set_league_lineup(p_match_id uuid, p_team_id uuid, p_player_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_role text; v_n int; v_seq int;
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  if p_team_id is null or p_team_id not in (m.home_team_id, m.away_team_id) then raise exception 'league:invalid_team'; end if;
  if m.result_status in ('submitted','homologated') then
    v_role := public.league_can_homologate(m);
    if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
  else
    v_role := public.league_operator_role(m);
    if v_role is null then raise exception 'league:not_operator' using errcode = '42501'; end if;
  end if;
  if m.match_status not in ('scheduled','live','finished','abandoned') then raise exception 'league:invalid_transition'; end if;
  if p_player_ids is null then raise exception 'league:invalid_lineup'; end if;
  v_n := coalesce(cardinality(p_player_ids), 0);
  if v_n > 30 or exists (select 1 from unnest(p_player_ids) u(pid) where u.pid is null)
     or (select count(distinct u.pid) from unnest(p_player_ids) u(pid)) <> v_n then
    raise exception 'league:invalid_lineup';
  end if;
  delete from public.team_match_lineup where match_id = m.id and team_id = p_team_id;
  insert into public.team_match_lineup (match_id, player_id, team_id, set_by_player_id)
  select m.id, u.pid, p_team_id, public.my_player_id() from unnest(p_player_ids) u(pid);
  update public.team_matches set seq = seq + 1, updated_at = now() where id = m.id returning seq into v_seq;
  perform public.league_audit(public.competition_league(m.competition_id), 'lineup_set',
    jsonb_build_object('team_id', p_team_id, 'count', v_n, 'role', v_role), m.competition_id, m.id);
  return jsonb_build_object('match_id', m.id, 'team_id', p_team_id, 'count', v_n, 'seq', v_seq);
exception when unique_violation then raise exception 'league:invalid_lineup' using detail = 'player already on the other sheet';
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.save_match_formation(uuid, uuid, text, jsonb, text, int)', 'public.match_formation(uuid, uuid)',
                           'public.set_league_lineup(uuid, uuid, uuid[])'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.league_player_eligible(public.team_matches, uuid, uuid) from public, anon, authenticated';
  execute 'grant execute on function public.league_player_eligible(public.team_matches, uuid, uuid) to service_role';
end $$;

comment on table public.team_match_formations is 'PITCH: persisted TacticsBoard formation per (match, team), versioned (optimistic base_version). Both origins. Organizational only.';
comment on table public.team_match_formation_slots is 'PITCH: slots of a formation (TacticsBoard keys gk|def|mid|fwd-<n>), one player at most once.';
