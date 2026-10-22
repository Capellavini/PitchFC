-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L4 (design plan PR L4): staff console
-- for fixtures + officials.
--
-- Draft 04 (phases/rounds/fixtures/scheduling/officials) already shipped
-- verbatim in 20261016155300_league_match_origin.sql. What the Gestão UI
-- still lacked to run a matchday:
--   • league_collaborators(league, competition?) — who can be assigned as
--     scorer/referee (names are not readable through RLS on players).
--   • competition_matches_staff(competition) — the fixtures list WITH the
--     values staff actions need: seq (expected_seq for lifecycle RPCs),
--     assigned officials, status_reason.
--   • competition_page() (shipped in 155100) redefined with the same body
--     plus league_id / league.id (additive keys only).
-- Read-only, additive, no table created.
-- Check: supabase/tests/ligas_l4_check.sql.
-- ─────────────────────────────────────────────────────────

-- league_collaborators(league, competition|null) → {items:[{member_id, player_id, name, role, competition_id}]}
-- Owner/manager of the league (or of that competition when scoped).
-- With p_competition_id: league-wide members + members scoped to it.
create or replace function public.league_collaborators(p_league_id uuid, p_competition_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_player_id() is null and not public.is_admin() then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  if p_competition_id is not null
     and not exists (select 1 from public.competitions where id = p_competition_id and league_id = p_league_id) then
    raise exception 'league:not_found';
  end if;
  if not public.is_league_manager(p_league_id, p_competition_id) then raise exception 'league:not_found'; end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('member_id', m.id, 'player_id', m.player_id, 'name', public.league_person_name(m.player_id),
                                        'role', m.role, 'competition_id', m.competition_id, 'since', m.created_at)
                     order by case m.role when 'owner' then 1 when 'manager' then 2 when 'referee' then 3 else 4 end,
                              public.league_person_name(m.player_id))
      from public.league_members m
     where m.league_id = p_league_id and m.status = 'active'
       and (p_competition_id is null or m.competition_id is null or m.competition_id = p_competition_id)), '[]'::jsonb));
end $$;

-- competition_matches_staff(competition, round|null) → {items:[…]}  (competition staff only)
-- Same rows as competition_matches() plus seq, status_reason, officials,
-- phase_id/round_id and the replay link.
create or replace function public.competition_matches_staff(p_competition_id uuid, p_round int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found or public.my_player_id() is null and not public.is_admin() or not public.is_competition_staff(v_c.id) then
    raise exception 'league:not_found';
  end if;
  return jsonb_build_object(
    'is_manager', public.is_league_manager(v_c.league_id, v_c.id),
    'items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'phase_id', m.phase_id, 'round_id', m.round_id, 'round', r.number, 'round_name', r.name,
             'home', jsonb_build_object('id', m.home_team_id, 'name', coalesce(hc.registered_name, ht.name), 'logo_url', coalesce(hc.registered_logo_url, ht.logo_url)),
             'away', jsonb_build_object('id', m.away_team_id, 'name', coalesce(ac.registered_name, at.name), 'logo_url', coalesce(ac.registered_logo_url, at.logo_url)),
             'kickoff_at', m.kickoff_at, 'timezone', m.timezone, 'venue_name', m.venue_name, 'venue_address', m.venue_address,
             'venue_url', m.venue_url, 'match_status', m.match_status, 'result_status', m.result_status, 'seq', m.seq,
             'status_reason', m.status_reason, 'replay_of_match_id', m.replay_of_match_id,
             'home_score', case when m.result_status = 'homologated' then m.official_home_score end,
             'away_score', case when m.result_status = 'homologated' then m.official_away_score end,
             'officials', coalesce((select jsonb_agg(jsonb_build_object('player_id', o.player_id, 'name', public.league_person_name(o.player_id), 'role', o.role)
                                                     order by o.role, o.assigned_at)
                                      from public.team_match_officials o where o.match_id = m.id), '[]'::jsonb))
           order by r.number, m.kickoff_at nulls last, m.id)
      from public.team_matches m
      join public.competition_rounds r on r.id = m.round_id
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      left join public.competition_teams hc on hc.competition_id = m.competition_id and hc.team_id = m.home_team_id
      left join public.competition_teams ac on ac.competition_id = m.competition_id and ac.team_id = m.away_team_id
     where m.competition_id = v_c.id and m.source_type = 'competition' and (p_round is null or r.number = p_round)), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.league_collaborators(uuid, uuid)', 'public.competition_matches_staff(uuid, int)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

comment on function public.league_collaborators(uuid, uuid) is 'PITCH Ligas: active collaborators (names + roles) for the Gestão UI; league/competition managers only.';
comment on function public.competition_matches_staff(uuid, int) is 'PITCH Ligas: staff fixtures console (seq, officials, status_reason). Competition staff only.';

-- ── competition_page gains the league id ─────────────────

-- Redefines 155100's competition_page (identical body) adding league_id at

-- the top level and league.id, so the Gestão officials picker can call

-- league_collaborators(league_id, competition_id) directly. Additive keys

-- only; signature, visibility rule and grants unchanged (create or replace

-- keeps the existing EXECUTE grants; re-stated below for clarity).
create or replace function public.competition_page(p_league_slug text, p_competition_slug text, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_g public.leagues%rowtype; v_c public.competitions%rowtype; v_vis text; v_staff boolean;
begin
  select * into v_g from public.leagues where slug = lower(btrim(coalesce(p_league_slug, '')));
  if not found then return null; end if;
  select * into v_c from public.competitions where league_id = v_g.id and slug = lower(btrim(coalesce(p_competition_slug, '')));
  if not found then return null; end if;
  v_staff := public.my_player_id() is not null and public.is_competition_staff(v_c.id);
  v_vis := coalesce(v_c.visibility, v_g.visibility);
  if not v_staff and not public.can_see_competition(v_c.id) then
    if v_c.status = 'draft' or v_g.status = 'draft' then return null; end if;
    if v_vis = 'private' and (p_key is null or (p_key <> v_c.view_key and p_key <> v_g.view_key)) then return null; end if;
  end if;
  return jsonb_build_object(
    'id', v_c.id, 'league_id', v_g.id, 'slug', v_c.slug, 'name', v_c.name, 'status', v_c.status, 'structure', v_c.structure,
    'modality', v_c.modality, 'format', v_c.format, 'match_duration_min', v_c.match_duration_min,
    'timezone', coalesce(v_c.timezone, v_g.timezone), 'visibility', v_vis,
    'league', jsonb_build_object('id', v_g.id, 'slug', v_g.slug, 'name', v_g.name, 'logo_url', v_g.logo_url, 'color', v_g.color),
    'season', (select jsonb_build_object('name', s.name, 'starts_on', s.starts_on, 'ends_on', s.ends_on) from public.league_seasons s where s.id = v_c.season_id),
    'category', (select jsonb_build_object('name', k.name, 'youth', k.youth) from public.league_categories k where k.id = v_c.category_id),
    'regulation', jsonb_build_object('version', v_c.current_regulation_version, 'rules', public.competition_rules(v_c.id)),
    'var_enabled', v_c.var_enabled, 'fantasy_enabled', v_c.fantasy_enabled,
    'is_staff', v_staff,
    'view_key', case when public.my_player_id() is not null and public.is_league_manager(v_g.id, v_c.id) then v_c.view_key end);
  -- teams[] (L3), rounds/matches (L4), standings (L6) are separate RPCs.
end $$;
do $$ begin
  execute 'revoke execute on function public.competition_page(text, text, text) from public';
  execute 'grant execute on function public.competition_page(text, text, text) to anon, authenticated, service_role';
end $$;
