-- ─────────────────────────────────────────────────────────
-- Fix: anonymous callers could read PRIVATE competitions without a key.
--
-- The visibility guard in the public read RPCs was
--     not ( A or ( not draft and ( vis in ('public','unlisted') or p_key in (view_key, league_key) ) ) )
-- With p_key NULL (no key given) and a private competition, "p_key in (…)" is
-- NULL, so the whole condition is NULL and `if NULL then return null` is NOT
-- taken: the data was returned. (competition_page already handled NULL
-- explicitly; these did not.) Wrong key was fine — only "no key" leaked.
-- Same family as 20261019120148_rivals_null_role_fix.sql.
--
-- Fix: coalesce(p_key in (…), false). The L6/L7 functions of this PR
-- (standings, player_stats, discipline) are patched in their own migrations;
-- this migration redefines the three that were already in production:
-- competition_teams_page, competition_matches, match_live. Bodies are copied
-- verbatim from their last definition; only the key guard changes. CREATE OR
-- REPLACE keeps the existing EXECUTE grants.
-- Check: supabase/tests/ligas_l6_check.sql (section "private competition").
-- ─────────────────────────────────────────────────────────

-- competition_teams_page: unchanged except the key guard (source: 20261016155200_league_registrations.sql)
create or replace function public.competition_teams_page(p_competition_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_youth boolean; v_vis text;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found then return null; end if;
  select * into v_g from public.leagues where id = v_c.league_id;
  v_vis := coalesce(v_c.visibility, v_g.visibility);
  if not ((public.my_player_id() is not null and public.can_see_competition(v_c.id))
          or (v_c.status <> 'draft' and v_g.status <> 'draft'
              and (v_vis in ('public','unlisted') or coalesce(p_key in (v_c.view_key, v_g.view_key), false)))) then
    return null;
  end if;
  v_youth := coalesce((select youth from public.league_categories where id = v_c.category_id), false);
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'registration_id', ct.id,
             'team', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', coalesce(ct.registered_name, t.name),
                                        'logo_url', coalesce(ct.registered_logo_url, t.logo_url), 'color', t.color),
             'squad', (select coalesce(jsonb_agg(jsonb_build_object(
                         'player_id', p.id,
                         'name', case when v_youth then upper(left(p.name, 1)) || '.' else public.league_person_name(p.id) end,
                         'photo_url', case when v_youth then null else p.photo_url end,
                         'position', p.position, 'shirt_number', sq.shirt_number, 'squad_role', sq.squad_role)
                         order by sq.shirt_number nulls last), '[]'::jsonb)
                         from public.competition_squad(ct.id) sq join public.players p on p.id = sq.player_id))
           order by coalesce(ct.registered_name, t.name))
      from public.competition_teams ct join public.teams t on t.id = ct.team_id
     where ct.competition_id = v_c.id and ct.status = 'homologated'), '[]'::jsonb));
end $$;

-- competition_matches: unchanged except the key guard (source: 20261016155300_league_match_origin.sql)
create or replace function public.competition_matches(p_competition_id uuid, p_round int default null, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found then return null; end if;
  select * into v_g from public.leagues where id = v_c.league_id;
  v_vis := coalesce(v_c.visibility, v_g.visibility);
  if not ((public.my_player_id() is not null and public.can_see_competition(v_c.id))
          or (v_c.status <> 'draft' and v_g.status <> 'draft'
              and (v_vis in ('public','unlisted') or coalesce(p_key in (v_c.view_key, v_g.view_key), false)))) then
    return null;
  end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'round', r.number, 'round_name', r.name,
             'home', jsonb_build_object('id', m.home_team_id, 'name', coalesce(hc.registered_name, ht.name), 'slug', ht.slug, 'logo_url', coalesce(hc.registered_logo_url, ht.logo_url)),
             'away', jsonb_build_object('id', m.away_team_id, 'name', coalesce(ac.registered_name, at.name), 'slug', at.slug, 'logo_url', coalesce(ac.registered_logo_url, at.logo_url)),
             'kickoff_at', m.kickoff_at, 'timezone', m.timezone, 'venue_name', m.venue_name,
             'match_status', m.match_status, 'result_status', m.result_status,
             -- Official score only once homologated; live/provisional score comes from L5's match_live().
             'home_score', case when m.result_status = 'homologated' then m.official_home_score end,
             'away_score', case when m.result_status = 'homologated' then m.official_away_score end)
           order by r.number, m.kickoff_at nulls last, m.id)
      from public.team_matches m
      join public.competition_rounds r on r.id = m.round_id
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      left join public.competition_teams hc on hc.competition_id = m.competition_id and hc.team_id = m.home_team_id
      left join public.competition_teams ac on ac.competition_id = m.competition_id and ac.team_id = m.away_team_id
     where m.competition_id = v_c.id and (p_round is null or r.number = p_round)), '[]'::jsonb));
end $$;

-- match_live: unchanged except the key guard (source: 20261016155400_league_match_events.sql)
create or replace function public.match_live(p_match_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text;
        v_h int; v_a int; v_youth boolean;
begin
  select * into m from public.team_matches where id = p_match_id and source_type = 'competition';
  if not found then return null; end if;
  select * into v_c from public.competitions where id = m.competition_id;
  select * into v_g from public.leagues where id = v_c.league_id;
  v_vis := coalesce(v_c.visibility, v_g.visibility);
  if not ((public.my_player_id() is not null and public.can_see_match(m.id))
          or (v_c.status <> 'draft' and v_g.status <> 'draft'
              and (v_vis in ('public','unlisted') or coalesce(p_key in (v_c.view_key, v_g.view_key), false)))) then
    return null;
  end if;
  v_youth := coalesce((select youth from public.league_categories where id = v_c.category_id), false);
  select s.home, s.away into v_h, v_a from public.league_match_score(m.id) s;
  return jsonb_build_object(
    'match', jsonb_build_object('id', m.id, 'competition_id', m.competition_id, 'round_id', m.round_id,
               'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id, 'kickoff_at', m.kickoff_at,
               'timezone', m.timezone, 'venue_name', m.venue_name, 'match_status', m.match_status,
               'result_status', m.result_status, 'seq', m.seq, 'started_at', m.started_at, 'ended_at', m.ended_at),
    'score', jsonb_build_object(
               'home', case when m.result_status = 'homologated' then m.official_home_score else v_h end,
               'away', case when m.result_status = 'homologated' then m.official_away_score else v_a end,
               'state', case m.result_status when 'homologated' then 'homologated' when 'submitted' then 'in_review'
                                             when 'provisional' then 'provisional'
                                             else case when m.match_status = 'live' then 'live' else 'none' end end,
               'pending_rehomologation', m.result_status = 'homologated'
                                         and (v_h is distinct from m.official_home_score or v_a is distinct from m.official_away_score)),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', e.id, 'type', e.type, 'team_id', e.team_id, 'period', e.period, 'minute', e.minute,
                  'added_minute', e.added_minute, 'detail', e.detail, 'corrected', e.action = 'correct',
                  'player', case when e.player_id is null then null when v_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = e.player_id)
                                 else public.league_person_name(e.player_id) end,
                  'player_id', e.player_id,
                  'assist', case when e.assist_player_id is null then null when v_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = e.assist_player_id)
                                 else public.league_person_name(e.assist_player_id) end,
                  'assist_player_id', e.assist_player_id)
                  order by e.period nulls first, e.minute nulls last, e.seq)
                  from public.team_match_events_effective e where e.match_id = m.id), '[]'::jsonb),
    'officials', coalesce((select jsonb_agg(jsonb_build_object('role', o.role, 'name', public.league_person_name(o.player_id)))
                             from public.team_match_officials o where o.match_id = m.id), '[]'::jsonb),
    'my_role', case when public.my_player_id() is null then null else public.league_operator_role(m) end,
    'can_homologate', public.my_player_id() is not null and public.league_can_homologate(m) is not null);
end $$;
