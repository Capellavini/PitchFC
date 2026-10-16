-- ─────────────────────────────────────────────────────────
-- DRAFT — PITCH Ligas Fase 2, PR L5 (second migration of the same PR):
-- persisted match formation (TacticsBoard). Owner request 2026-10-16.
--
-- NOT A MIGRATION (see 01 header). Depends on 01–05.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.14.
--
-- Today src/components/TacticsBoard.jsx keeps {formation: "3-3-1",
-- slots: {"def-0": playerId, …}} in localStorage, per viewer. This
-- persists ONE current formation per (match, team), versioned, in the SAME
-- shape so the client maps 1:1. It works for BOTH origins (league matches
-- and Rivals friendlies) and is organizational only: it never feeds the
-- score, stats, standings or fantasy.
--   visibility 'team'      → saved for the team's members (planning)
--              'published' → part of the match page ("Escalações", brief §7)
-- Eligibility goes through league_player_eligible(), which L7 redefines to
-- add "not suspended" (same pattern as league_guard_lineup).
-- ─────────────────────────────────────────────────────────

create table if not exists public.team_match_formations (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.team_matches(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  version      int  not null check (version >= 1),
  formation    text not null check (formation ~ '^[0-9]{1,2}(-[0-9]{1,2}){1,4}$'),   -- "3-3-1"
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
revoke all on table public.team_match_formations, public.team_match_formation_slots from anon, authenticated;
grant select on table public.team_match_formations, public.team_match_formation_slots to authenticated;
grant all on table public.team_match_formations, public.team_match_formation_slots to service_role;

-- Can p_player play for p_team in match m? Friendly: active team member.
-- League: in the homologated squad (L7 adds: and not suspended).
create or replace function public.league_player_eligible(m public.team_matches, p_team uuid, p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when m.source_type = 'competition' then public.league_in_squad(m, p_team, p_player)
              else exists (select 1 from public.team_members tm where tm.team_id = p_team and tm.player_id = p_player and tm.status = 'active') end;
$$;

-- save_match_formation(match, team, formation, slots {"def-0": player_id, …}, visibility, base_version)
--   → {version, visibility}
-- Who: a leader (captain/vice) of that team, or a competition manager on a
-- league match. base_version = the version the editor started from (null
-- for the first save); stale → league:stale_formation, so captain and vice
-- never silently overwrite each other. Locked once the match is live.
create or replace function public.save_match_formation(p_match_id uuid, p_team_id uuid, p_formation text, p_slots jsonb,
                                                       p_visibility text default 'team', p_base_version int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_cur public.team_match_formations%rowtype; v_id uuid; v_ver int; s record;
begin
  -- Lock the match row (FOR UPDATE, no column change ⇒ the league guard
  -- trigger does not fire) to serialize concurrent saves.
  select * into m from public.team_matches where id = p_match_id for update;
  if not found or p_team_id not in (m.home_team_id, m.away_team_id) then raise exception 'league:match_not_found'; end if;
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
  for s in select key, value::uuid as pid from jsonb_each_text(p_slots) loop
    if not public.league_player_eligible(m, p_team_id, s.pid) then raise exception 'league:player_not_eligible' using detail = s.key; end if;
  end loop;
  update public.team_match_formations set status = 'superseded' where id = v_cur.id;
  v_ver := coalesce(v_cur.version, 0) + 1;
  insert into public.team_match_formations (match_id, team_id, version, formation, visibility, published_by)
  values (m.id, p_team_id, v_ver, p_formation, p_visibility, public.my_player_id()) returning id into v_id;
  insert into public.team_match_formation_slots (formation_id, slot_key, player_id)
  select v_id, x.key, x.value::uuid from jsonb_each_text(p_slots) x;
  return jsonb_build_object('version', v_ver, 'visibility', p_visibility);
exception when unique_violation or check_violation or invalid_text_representation then
  raise exception 'league:invalid_formation';
end $$;

-- match_formation(match, team) → {formation, version, visibility, published_by, slots{slot_key: {player_id, name}}} | null
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
  return jsonb_build_object('formation', f.formation, 'version', f.version, 'visibility', f.visibility,
    'published_by', public.league_person_name(f.published_by), 'published_at', f.published_at,
    'slots', coalesce((select jsonb_object_agg(s.slot_key, jsonb_build_object('player_id', s.player_id,
               'name', case when v_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = s.player_id)
                            else public.league_person_name(s.player_id) end))
                       from public.team_match_formation_slots s where s.formation_id = f.id), '{}'::jsonb));
end $$;

do $$ begin
  execute 'revoke execute on function public.save_match_formation(uuid, uuid, text, jsonb, text, int) from public, anon';
  execute 'grant execute on function public.save_match_formation(uuid, uuid, text, jsonb, text, int) to authenticated, service_role';
  execute 'revoke execute on function public.match_formation(uuid, uuid) from public, anon';
  execute 'grant execute on function public.match_formation(uuid, uuid) to authenticated, service_role';
  execute 'revoke execute on function public.league_player_eligible(public.team_matches, uuid, uuid) from public, anon, authenticated';
  execute 'grant execute on function public.league_player_eligible(public.team_matches, uuid, uuid) to service_role';
end $$;
