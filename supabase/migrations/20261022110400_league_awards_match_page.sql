-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L8 (design plan PR L8, second half):
-- official MVP ("Craque oficial") vs the fans' vote ("Craque da torcida"),
-- plus the one-call public match page payload.
--
-- Source: docs/ligas-draft-sql/08_fans_awards_follows.sql §2, §5, §6 (fans,
-- follows and notification preferences already shipped in
-- 20261016155500_league_fans_follows.sql and are NOT touched here).
-- Depends on 155000–155500 + 20261022110100..110300.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.13. Check: supabase/tests/ligas_l8_check.sql.
--
-- Changes vs the draft (integration):
--   • fan_vote_results applies the youth rule (initials) to names.
--   • NEW match_page(match, key): match_live() + teams, competition, round,
--     current homologation, official MVP, fans' vote state, published
--     formations, dispute window and the caller's capabilities — so the
--     match page renders from one RPC. anon-callable, same visibility as
--     match_live (null when not visible). Disputes are never in it except
--     a count for staff / the two teams.
--
-- The fans' vote never feeds the official award or fantasy (brief §11, §13).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.team_match_awards (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.team_matches(id) on delete cascade,
  award        text not null default 'official_mvp' check (award in ('official_mvp')),
  revision     int  not null check (revision >= 1),
  player_id    uuid not null references public.players(id) on delete restrict,
  team_id      uuid not null references public.teams(id) on delete restrict,
  status       text not null default 'current' check (status in ('current','superseded')),
  decided_by   uuid references public.players(id) on delete set null,
  decided_role text not null,
  reason       text check (reason is null or char_length(reason) <= 500),
  created_at   timestamptz not null default now(),
  constraint team_match_awards_rev_key unique (match_id, award, revision)
);
create unique index if not exists team_match_awards_one_current_key
  on public.team_match_awards (match_id, award) where status = 'current';

create table if not exists public.team_match_fan_vote_windows (
  match_id   uuid primary key references public.team_matches(id) on delete cascade,
  opens_at   timestamptz not null,
  closes_at  timestamptz not null,
  opened_by  uuid references public.players(id) on delete set null,
  constraint team_match_fan_vote_windows_check check (closes_at > opens_at)
);

create table if not exists public.team_match_fan_votes (
  match_id         uuid not null references public.team_matches(id) on delete cascade,
  voter_player_id  uuid not null references public.players(id) on delete cascade,
  voted_player_id  uuid not null references public.players(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (match_id, voter_player_id)
);
create index if not exists team_match_fan_votes_voted_idx on public.team_match_fan_votes (match_id, voted_player_id);

-- ── 2. RLS + explicit Data API grants ────────────────────
alter table public.team_match_awards           enable row level security;
alter table public.team_match_fan_vote_windows enable row level security;
alter table public.team_match_fan_votes        enable row level security;

drop policy if exists "team_match_awards select" on public.team_match_awards;
create policy "team_match_awards select" on public.team_match_awards for select to authenticated
  using (public.can_see_match(match_id));
drop policy if exists "team_match_fan_vote_windows select" on public.team_match_fan_vote_windows;
create policy "team_match_fan_vote_windows select" on public.team_match_fan_vote_windows for select to authenticated
  using (public.can_see_match(match_id));
-- Your own vote only; tallies through fan_vote_results() after close.
drop policy if exists "team_match_fan_votes select" on public.team_match_fan_votes;
create policy "team_match_fan_votes select" on public.team_match_fan_votes for select to authenticated
  using (voter_player_id = public.my_player_id());

-- anon: none (public pages go through RPCs). authenticated: read (RLS
-- decides rows); writes only through the SECURITY DEFINER RPCs below.
revoke all on table public.team_match_awards, public.team_match_fan_vote_windows, public.team_match_fan_votes from anon, authenticated;
grant select on table public.team_match_awards, public.team_match_fan_vote_windows, public.team_match_fan_votes to authenticated;
grant select, insert, update, delete on table public.team_match_awards, public.team_match_fan_vote_windows, public.team_match_fan_votes to service_role;

-- Internal: display name under the competition's youth rule.
create or replace function public.league_public_name(p_player uuid, p_youth boolean)
returns text language sql stable security definer set search_path = public as $$
  select case when p_player is null then null
              when p_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = p_player)
              else public.league_person_name(p_player) end;
$$;

-- ── 3. RPCs: official MVP ────────────────────────────────
-- award_official_mvp(match, player, reason) → {revision}
-- Role in regulation mvp.official_by (referee = assigned referee; owner /
-- manager = league role). Only after the match is finished. Re-awarding
-- supersedes (audited, reason required). Never derived from the fans' vote.
create or replace function public.award_official_mvp(p_match_id uuid, p_player_id uuid, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; v_role text; v_team uuid; v_rev int; v_roles text[];
begin
  perform public.league_rpc_begin();
  m := public.league_lock_match(p_match_id);
  select array_agg(x) into v_roles from jsonb_array_elements_text(public.competition_rules(m.competition_id)#>'{mvp,official_by}') x;
  v_role := case
    when 'referee' = any(v_roles) and public.is_match_official(m.id, array['referee']) then 'referee'
    when 'owner'   = any(v_roles) and public.has_league_role(public.competition_league(m.competition_id), array['owner'], m.competition_id) then 'owner'
    when 'manager' = any(v_roles) and (public.is_admin() or public.has_league_role(public.competition_league(m.competition_id), array['owner','manager'], m.competition_id)) then 'manager'
  end;
  if v_role is null then raise exception 'league:not_authority' using errcode = '42501'; end if;
  if m.match_status not in ('finished','abandoned') then raise exception 'league:match_not_finished'; end if;
  v_team := case when public.league_in_squad(m, m.home_team_id, p_player_id) then m.home_team_id
                 when public.league_in_squad(m, m.away_team_id, p_player_id) then m.away_team_id end;
  if v_team is null then raise exception 'league:player_not_in_squad'; end if;
  select coalesce(max(revision), 0) + 1 into v_rev from public.team_match_awards where match_id = m.id and award = 'official_mvp';
  if v_rev > 1 and coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  update public.team_match_awards set status = 'superseded' where match_id = m.id and award = 'official_mvp' and status = 'current';
  insert into public.team_match_awards (match_id, award, revision, player_id, team_id, decided_by, decided_role, reason)
  values (m.id, 'official_mvp', v_rev, p_player_id, v_team, public.my_player_id(), v_role, left(p_reason, 500));
  perform public.league_audit(public.competition_league(m.competition_id), 'official_mvp',
    jsonb_build_object('player_id', p_player_id, 'revision', v_rev), m.competition_id, m.id);
  return jsonb_build_object('revision', v_rev, 'player_id', p_player_id, 'team_id', v_team, 'role', v_role);
end $$;

-- ── 4. RPCs: fans' vote ──────────────────────────────────
-- open_fan_vote(match, hours 1..168) → {opens_at, closes_at}
-- Competition manager; regulation mvp.fan_vote = true; match finished.
-- Idempotent: an existing window is returned unchanged.
create or replace function public.open_fan_vote(p_match_id uuid, p_hours int default 24)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m public.team_matches%rowtype; w public.team_match_fan_vote_windows%rowtype;
begin
  select * into m from public.team_matches where id = p_match_id and source_type = 'competition';
  if not found or not public.is_league_manager(public.competition_league(m.competition_id), m.competition_id) then
    raise exception 'league:match_not_found';
  end if;
  if not coalesce((public.competition_rules(m.competition_id)#>>'{mvp,fan_vote}')::boolean, false) then raise exception 'league:fan_vote_disabled'; end if;
  if m.match_status not in ('finished','abandoned') then raise exception 'league:match_not_finished'; end if;
  insert into public.team_match_fan_vote_windows (match_id, opens_at, closes_at, opened_by)
  values (m.id, now(), now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 168))), public.my_player_id())
  on conflict (match_id) do nothing;
  select * into w from public.team_match_fan_vote_windows where match_id = m.id;
  return jsonb_build_object('opens_at', w.opens_at, 'closes_at', w.closes_at);
end $$;

-- cast_fan_vote(match, player) → {voted_player_id, closes_at}
-- Any signed-in account that can see the match, inside the window; one
-- vote per account, changeable until close; no self-vote; candidates =
-- players on the team sheet or who appeared in the official snapshot.
create or replace function public.cast_fan_vote(p_match_id uuid, p_player_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_pid uuid := public.my_player_id(); w public.team_match_fan_vote_windows%rowtype;
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  if not public.can_see_match(p_match_id) then raise exception 'league:match_not_found'; end if;
  select * into w from public.team_match_fan_vote_windows where match_id = p_match_id;
  if not found or now() < w.opens_at or now() >= w.closes_at then raise exception 'league:vote_closed'; end if;
  if p_player_id = v_pid then raise exception 'league:no_self_vote'; end if;
  if not exists (select 1 from public.team_match_lineup l where l.match_id = p_match_id and l.player_id = p_player_id)
     and not exists (select 1 from public.team_match_official_stats s join public.team_match_homologations h on h.id = s.homologation_id
                      where h.match_id = p_match_id and h.status = 'current' and s.player_id = p_player_id and s.appeared) then
    raise exception 'league:not_a_candidate';
  end if;
  insert into public.team_match_fan_votes (match_id, voter_player_id, voted_player_id) values (p_match_id, v_pid, p_player_id)
  on conflict (match_id, voter_player_id) do update set voted_player_id = excluded.voted_player_id, updated_at = now();
  return jsonb_build_object('voted_player_id', p_player_id, 'closes_at', w.closes_at);
end $$;

-- Internal: fans' vote block (no visibility check — callers check).
create or replace function public.league_fan_vote_block(p_match_id uuid, p_youth boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w public.team_match_fan_vote_windows%rowtype; v_closed boolean;
begin
  select * into w from public.team_match_fan_vote_windows where match_id = p_match_id;
  if not found then return jsonb_build_object('state', 'none'); end if;
  v_closed := now() >= w.closes_at;
  return jsonb_build_object(
    'state', case when v_closed then 'closed' else 'open' end, 'opens_at', w.opens_at, 'closes_at', w.closes_at,
    'total_votes', case when v_closed then (select count(*) from public.team_match_fan_votes where match_id = p_match_id) end,
    'my_vote', case when public.my_player_id() is null then null
                    else (select voted_player_id from public.team_match_fan_votes where match_id = p_match_id and voter_player_id = public.my_player_id()) end,
    'items', case when v_closed then coalesce((
               select jsonb_agg(jsonb_build_object('player_id', v.voted_player_id, 'name', public.league_public_name(v.voted_player_id, p_youth), 'votes', v.n)
                                order by v.n desc, v.voted_player_id)
                 from (select voted_player_id, count(*)::int as n from public.team_match_fan_votes where match_id = p_match_id group by 1) v), '[]'::jsonb) end);
end $$;

-- fan_vote_results(match) → {state:'none'|'open'|'closed', opens_at, closes_at, my_vote, total_votes (closed), items (closed only)}
create or replace function public.fan_vote_results(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_youth boolean;
begin
  if not public.can_see_match(p_match_id) then raise exception 'league:match_not_found'; end if;
  select coalesce(k.youth, false) into v_youth from public.team_matches m
    left join public.competitions c on c.id = m.competition_id left join public.league_categories k on k.id = c.category_id
   where m.id = p_match_id;
  return public.league_fan_vote_block(p_match_id, coalesce(v_youth, false));
end $$;

-- Internal: a team's saved sheet for match m (no visibility check — callers check).
-- {team_id, count, players:[{player_id, name, photo_url, shirt_number, squad_role, position}]}
-- Number / role from the homologated squad; youth → initials, no photo.
create or replace function public.league_sheet(m public.team_matches, p_team uuid, p_youth boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('team_id', p_team, 'count', count(l.player_id),
    'players', coalesce(jsonb_agg(jsonb_build_object(
        'player_id', l.player_id, 'name', public.league_public_name(l.player_id, p_youth),
        'photo_url', case when p_youth then null else p.photo_url end,
        'shirt_number', sp.shirt_number, 'squad_role', sp.squad_role, 'position', p.position)
      order by sp.shirt_number nulls last, public.league_public_name(l.player_id, p_youth)) filter (where l.player_id is not null), '[]'::jsonb))
    from public.team_match_lineup l
    join public.players p on p.id = l.player_id
    left join public.competition_teams ct on ct.competition_id = m.competition_id and ct.team_id = p_team
    left join public.competition_squad_players sp on sp.registration_id = ct.id and sp.version = ct.homologated_squad_version and sp.player_id = l.player_id
   where l.match_id = m.id and l.team_id = p_team;
$$;

-- ── 5. Match page payload ────────────────────────────────
-- match_page(match, key) → null | match_live(match, key) ∪ {
--   competition{id, name, slug, league_id, league_slug, league_name, modality, format, match_duration_min, youth},
--   round{number, name}, teams{home{id,name,slug,logo_url}, away{…}},
--   homologation{revision, kind, home_score, away_score, decided_role, created_at, regulation_version, reason} | null,
--   official_mvp{player_id, name, team_id, revision, decided_role} | null,
--   fan_vote{…fan_vote_results…},
--   formations{home: match_formation | null, away: … }   (published ones; your own team's also when 'team'),
--   lineups{home: sheet | null, away: …} | null   (team sheets: staff + assigned officials both; team members own; anon/fans null),
--   dispute{window_closes_at, open_count (staff/teams only, else null)},
--   me{is_staff, is_manager, operator_role, can_homologate, leader_of_team_id, member_of_team_id} }
create or replace function public.match_page(p_match_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_live jsonb; m public.team_matches%rowtype; v_c public.competitions%rowtype; v_g public.leagues%rowtype;
        v_youth boolean; h public.team_match_homologations%rowtype; v_pid uuid := public.my_player_id();
        v_staff boolean := false; v_member boolean := false; v_form jsonb := '{}'::jsonb; t record; f jsonb;
        v_lineups jsonb := null; v_official boolean := false;
begin
  v_live := public.match_live(p_match_id, p_key);
  if v_live is null then return null; end if;
  select * into m from public.team_matches where id = p_match_id;
  select * into v_c from public.competitions where id = m.competition_id;
  select * into v_g from public.leagues where id = v_c.league_id;
  v_youth := coalesce((select youth from public.league_categories where id = v_c.category_id), false);
  select * into h from public.team_match_homologations where match_id = m.id and status = 'current';
  if v_pid is not null or public.is_admin() then
    v_staff := public.is_competition_staff(v_c.id);
    v_member := public.is_team_member(m.home_team_id) or public.is_team_member(m.away_team_id);
  end if;
  -- Team sheets (plan §5: not public). Staff of the competition and the
  -- match's assigned officials see both; a team's members see their own.
  if v_pid is not null then
    v_official := public.is_match_official(m.id);
    if v_staff or v_official or v_member then
      v_lineups := jsonb_build_object(
        'home', case when v_staff or v_official or public.is_team_member(m.home_team_id) then public.league_sheet(m, m.home_team_id, v_youth) end,
        'away', case when v_staff or v_official or public.is_team_member(m.away_team_id) then public.league_sheet(m, m.away_team_id, v_youth) end);
    end if;
  end if;
  for t in select x.side, x.team_id from (values ('home', m.home_team_id), ('away', m.away_team_id)) x(side, team_id) loop
    f := null;
    if v_pid is not null and public.is_team_member(t.team_id) then
      f := public.match_formation(m.id, t.team_id);
    else
      select jsonb_build_object('team_id', fm.team_id, 'formation', fm.formation, 'version', fm.version, 'visibility', fm.visibility,
               'published_at', fm.published_at,
               'slots', coalesce((select jsonb_object_agg(s.slot_key, jsonb_build_object('player_id', s.player_id,
                                    'name', public.league_public_name(s.player_id, v_youth)))
                                    from public.team_match_formation_slots s where s.formation_id = fm.id), '{}'::jsonb))
        into f
        from public.team_match_formations fm
       where fm.match_id = m.id and fm.team_id = t.team_id and fm.status = 'current' and fm.visibility = 'published';
    end if;
    v_form := v_form || jsonb_build_object(t.side, f);
  end loop;
  return v_live || jsonb_build_object(
    'competition', jsonb_build_object('id', v_c.id, 'name', v_c.name, 'slug', v_c.slug, 'league_id', v_g.id, 'league_slug', v_g.slug,
                                      'league_name', v_g.name, 'modality', v_c.modality, 'format', v_c.format,
                                      'match_duration_min', v_c.match_duration_min, 'youth', v_youth),
    'round', (select jsonb_build_object('number', r.number, 'name', r.name) from public.competition_rounds r where r.id = m.round_id),
    'teams', jsonb_build_object(
       'home', (select jsonb_build_object('id', tm.id, 'name', coalesce(ct.registered_name, tm.name), 'slug', tm.slug, 'logo_url', coalesce(ct.registered_logo_url, tm.logo_url))
                  from public.teams tm left join public.competition_teams ct on ct.team_id = tm.id and ct.competition_id = v_c.id where tm.id = m.home_team_id),
       'away', (select jsonb_build_object('id', tm.id, 'name', coalesce(ct.registered_name, tm.name), 'slug', tm.slug, 'logo_url', coalesce(ct.registered_logo_url, tm.logo_url))
                  from public.teams tm left join public.competition_teams ct on ct.team_id = tm.id and ct.competition_id = v_c.id where tm.id = m.away_team_id)),
    'homologation', case when h.id is null then null else jsonb_build_object(
       'revision', h.revision, 'kind', h.kind, 'home_score', h.home_score, 'away_score', h.away_score,
       'decided_role', h.decided_role, 'created_at', h.created_at, 'regulation_version', h.regulation_version, 'reason', h.reason) end,
    'official_mvp', (select jsonb_build_object('player_id', a.player_id, 'name', public.league_public_name(a.player_id, v_youth),
                                               'team_id', a.team_id, 'revision', a.revision, 'decided_role', a.decided_role)
                       from public.team_match_awards a where a.match_id = m.id and a.award = 'official_mvp' and a.status = 'current'),
    'fan_vote', public.league_fan_vote_block(m.id, v_youth),
    'formations', v_form,
    'lineups', v_lineups,
    'dispute', jsonb_build_object(
       'window_closes_at', case when h.id is not null then h.created_at + make_interval(hours => coalesce((public.competition_rules(v_c.id)->>'dispute_window_hours')::int, 0)) end,
       'open_count', case when v_staff or v_member then (select count(*) from public.team_match_disputes d where d.match_id = m.id and d.status = 'open') end),
    'me', jsonb_build_object(
       'is_staff', v_staff,
       'is_manager', v_pid is not null and public.is_league_manager(v_g.id, v_c.id),
       'operator_role', case when v_pid is null then null else public.league_operator_role(m) end,
       'can_homologate', v_pid is not null and public.league_can_homologate(m) is not null,
       'leader_of_team_id', case when v_pid is null then null when public.is_team_leader(m.home_team_id) then m.home_team_id
                                 when public.is_team_leader(m.away_team_id) then m.away_team_id end,
       'member_of_team_id', case when v_pid is null then null when public.is_team_member(m.home_team_id) then m.home_team_id
                                 when public.is_team_member(m.away_team_id) then m.away_team_id end));
end $$;

-- ── 6. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.award_official_mvp(uuid, uuid, text)', 'public.open_fan_vote(uuid, int)',
    'public.cast_fan_vote(uuid, uuid)', 'public.fan_vote_results(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.match_page(uuid, text) from public';
  execute 'grant execute on function public.match_page(uuid, text) to anon, authenticated, service_role';
  foreach f in array array['public.league_public_name(uuid, boolean)', 'public.league_fan_vote_block(uuid, boolean)', 'public.league_sheet(public.team_matches, uuid, boolean)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── Comments ─────────────────────────────────────────────
comment on table public.team_match_awards is 'PITCH Ligas: official MVP (Craque oficial) per match, revisioned, decided by the regulation''s mvp.official_by role. Never derived from the fans'' vote.';
comment on table public.team_match_fan_vote_windows is 'PITCH Ligas: fans'' vote window per match (opened by a manager when mvp.fan_vote is on).';
comment on table public.team_match_fan_votes is 'PITCH Ligas: Craque da torcida votes — one per account per match, changeable until close; tallies only after close via RPC.';
