-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L7 (design plan PR L7): discipline
-- (cards → cases → decisions → suspensions → eligibility).
--
-- Source: docs/ligas-draft-sql/07_discipline.sql. Depends on 155300–155400
-- + 20261022110100 (formations) + 20261022110200 (homologation).
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.11. Check: supabase/tests/ligas_l7_check.sql.
--
-- Changes vs the draft (integration):
--   • league_guard_lineup only applies the suspension rule to matches not
--     yet finished (unscheduled/scheduled/postponed/live), so the authority
--     can still correct the team sheet of a past match (e.g. the very
--     match where the red card happened) after confirming the suspension.
--   • NEW list_discipline_cases(competition, status) — the manager's
--     inbox (pending suggestions + decided cases with served/active).
--
-- League-only by construction: cards live in team_match_events
-- (competition matches only) and in the official snapshots. Nothing here
-- reads or writes group tables or Rivals rows.
--
-- No universal suspension rule (brief §9): the regulation SUGGESTS,
-- homologation opens PENDING cases, only a decision (confirm / waive /
-- manual case, with reason) makes a suspension real. "Served" is derived
-- (homologated, non-annulled matches of the team after the source match).
-- ─────────────────────────────────────────────────────────

create table if not exists public.competition_discipline_cases (
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid not null references public.competitions(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete restrict,
  team_id           uuid not null references public.teams(id) on delete restrict,
  source_match_id   uuid references public.team_matches(id) on delete restrict,   -- null for a manual case
  trigger           text not null check (trigger in ('red','second_yellow','yellow_accumulation','manual')),
  accumulation_n    int,                                -- 1st, 2nd… threshold crossing (yellow_accumulation)
  suggested_matches int not null default 0 check (suggested_matches between 0 and 50),
  decided_matches   int check (decided_matches is null or decided_matches between 0 and 50),
  status            text not null default 'pending' check (status in ('pending','confirmed','waived')),
  decided_by        uuid references public.players(id) on delete set null,
  decided_at        timestamptz,
  reason            text check (reason is null or char_length(reason) <= 1000),
  created_at        timestamptz not null default now(),
  constraint competition_discipline_cases_decided_check check (status = 'pending' or (decided_at is not null and coalesce(btrim(reason), '') <> ''))
);
create unique index if not exists competition_discipline_cases_source_key
  on public.competition_discipline_cases (competition_id, player_id, source_match_id, trigger)
  where source_match_id is not null and trigger <> 'yellow_accumulation';
create unique index if not exists competition_discipline_cases_accum_key
  on public.competition_discipline_cases (competition_id, player_id, accumulation_n)
  where trigger = 'yellow_accumulation';

alter table public.competition_discipline_cases enable row level security;
-- Suspensions are part of the public competition (who can't play next).
drop policy if exists "competition_discipline_cases select" on public.competition_discipline_cases;
create policy "competition_discipline_cases select" on public.competition_discipline_cases for select to authenticated
  using ((status = 'confirmed' and public.can_see_competition(competition_id))
         or public.is_competition_staff(competition_id) or public.is_team_member(team_id));
revoke all on table public.competition_discipline_cases from anon, authenticated;
grant select on table public.competition_discipline_cases to authenticated;
grant select, insert, update, delete on table public.competition_discipline_cases to service_role;

-- ── Suggested cases on homologation (statement trigger, transition table) ─
create or replace function public.league_discipline_suggest()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record; v_rules jsonb; v_thr int; v_total int; n int;
begin
  for rec in
    select s.player_id, s.team_id, s.reds, s.second_yellows, h.match_id, m.competition_id
      from ins s join public.team_match_homologations h on h.id = s.homologation_id
      join public.team_matches m on m.id = h.match_id
     where s.reds > 0 or s.second_yellows > 0 or s.yellows > 0
  loop
    v_rules := public.competition_rules(rec.competition_id)->'discipline';
    if rec.reds > 0 then
      insert into public.competition_discipline_cases (competition_id, player_id, team_id, source_match_id, trigger, suggested_matches)
      values (rec.competition_id, rec.player_id, rec.team_id, rec.match_id, 'red', (v_rules->>'red_suspension')::int)
      on conflict do nothing;
    end if;
    if rec.second_yellows > 0 then
      insert into public.competition_discipline_cases (competition_id, player_id, team_id, source_match_id, trigger, suggested_matches)
      values (rec.competition_id, rec.player_id, rec.team_id, rec.match_id, 'second_yellow', (v_rules->>'second_yellow_suspension')::int)
      on conflict do nothing;
    end if;
    v_thr := nullif(v_rules->>'yellow_threshold', '')::int;
    if v_thr is not null then
      select coalesce(sum(st.yellows), 0) into v_total
        from public.team_match_official_stats st
        join public.team_match_homologations h on h.id = st.homologation_id and h.status = 'current'
        join public.team_matches m on m.id = h.match_id
       where m.competition_id = rec.competition_id and st.player_id = rec.player_id;
      for n in 1 .. (v_total / v_thr) loop
        insert into public.competition_discipline_cases (competition_id, player_id, team_id, source_match_id, trigger,
                                                         accumulation_n, suggested_matches)
        values (rec.competition_id, rec.player_id, rec.team_id, rec.match_id, 'yellow_accumulation', n,
                (v_rules->>'yellow_suspension')::int)
        on conflict do nothing;
      end loop;
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists team_match_official_stats_discipline on public.team_match_official_stats;
create trigger team_match_official_stats_discipline after insert on public.team_match_official_stats
  referencing new table as ins for each statement execute function public.league_discipline_suggest();

-- ── Derived suspension state ─────────────────────────────
create or replace function public.league_suspensions(p_competition_id uuid)
returns table (case_id uuid, player_id uuid, team_id uuid, decided_matches int, served int, active boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.player_id, c.team_id, c.decided_matches, x.served, x.served < c.decided_matches
    from public.competition_discipline_cases c
    left join public.team_matches src on src.id = c.source_match_id
    cross join lateral (
      select count(*)::int as served
        from public.team_matches m
        join public.team_match_homologations h on h.match_id = m.id and h.status = 'current' and h.kind <> 'annulled'
       where m.competition_id = c.competition_id and m.id is distinct from c.source_match_id
         and (m.home_team_id = c.team_id or m.away_team_id = c.team_id)
         and m.kickoff_at > coalesce(src.kickoff_at, c.decided_at)) x
   where c.competition_id = p_competition_id and c.status = 'confirmed' and coalesce(c.decided_matches, 0) > 0;
$$;

create or replace function public.league_is_suspended(p_competition_id uuid, p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_suspensions(p_competition_id) s where s.player_id = p_player_id and s.active);
$$;

-- Lineup guard (04) + suspension.
create or replace function public.league_guard_lineup()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.team_matches%rowtype;
begin
  select * into m from public.team_matches where id = new.match_id;
  if m.source_type <> 'competition' then return new; end if;
  if not exists (select 1 from public.competition_teams ct
                   join public.competition_squad_players sp on sp.registration_id = ct.id and sp.version = ct.homologated_squad_version
                  where ct.competition_id = m.competition_id and ct.team_id = new.team_id and sp.player_id = new.player_id) then
    raise exception 'league:player_not_in_squad';
  end if;
  if m.match_status in ('unscheduled','scheduled','postponed','live')
     and public.league_is_suspended(m.competition_id, new.player_id) then
    raise exception 'league:player_suspended';
  end if;
  return new;
end $$;

-- ── RPCs ─────────────────────────────────────────────────
-- decide_discipline_case(case, 'confirm'|'waive', matches, reason) → {status, decided_matches}
create or replace function public.decide_discipline_case(p_case_id uuid, p_decision text, p_matches int, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c public.competition_discipline_cases%rowtype;
begin
  select * into c from public.competition_discipline_cases where id = p_case_id for update;
  if not found or not public.is_league_manager(public.competition_league(c.competition_id), c.competition_id) then
    raise exception 'league:not_found';
  end if;
  if p_decision not in ('confirm','waive') then raise exception 'league:invalid_decision'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  update public.competition_discipline_cases
     set status = case p_decision when 'confirm' then 'confirmed' else 'waived' end,
         decided_matches = case p_decision when 'confirm' then coalesce(p_matches, suggested_matches) else 0 end,
         decided_by = public.my_player_id(), decided_at = now(), reason = left(p_reason, 1000)
   where id = c.id returning * into c;
  perform public.league_audit(public.competition_league(c.competition_id), 'discipline_' || p_decision,
    jsonb_build_object('case_id', c.id, 'player_id', c.player_id, 'matches', c.decided_matches, 'reason', p_reason), c.competition_id, c.source_match_id);
  return jsonb_build_object('status', c.status, 'decided_matches', c.decided_matches);
end $$;

-- open_discipline_case(competition, player, team, matches, reason, source_match) → {case_id}
-- Manual decision (e.g. misconduct reported after the match). Confirmed at once.
create or replace function public.open_discipline_case(p_competition_id uuid, p_player_id uuid, p_team_id uuid, p_matches int,
                                                       p_reason text, p_source_match_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_manager(public.competition_league(p_competition_id), p_competition_id) then raise exception 'league:not_found'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  -- Integration: the player must be in that team's homologated squad, and
  -- the source match (if any) must belong to this competition.
  if not exists (select 1 from public.competition_teams ct
                   join public.competition_squad_players sp on sp.registration_id = ct.id and sp.version = ct.homologated_squad_version
                  where ct.competition_id = p_competition_id and ct.team_id = p_team_id and sp.player_id = p_player_id) then
    raise exception 'league:player_not_in_squad';
  end if;
  if p_source_match_id is not null and not exists (select 1 from public.team_matches where id = p_source_match_id
                                                     and competition_id = p_competition_id and source_type = 'competition') then
    raise exception 'league:match_not_found';
  end if;
  insert into public.competition_discipline_cases (competition_id, player_id, team_id, source_match_id, trigger, suggested_matches,
                                                   decided_matches, status, decided_by, decided_at, reason)
  values (p_competition_id, p_player_id, p_team_id, p_source_match_id, 'manual', p_matches, p_matches, 'confirmed',
          public.my_player_id(), now(), left(p_reason, 1000))
  returning id into v_id;
  perform public.league_audit(public.competition_league(p_competition_id), 'discipline_manual',
    jsonb_build_object('case_id', v_id, 'player_id', p_player_id, 'matches', p_matches), p_competition_id, p_source_match_id);
  return jsonb_build_object('case_id', v_id);
end $$;

-- competition_discipline(competition, key) → {suspended:[…], cards:[…]}   (public, youth rule)
create or replace function public.competition_discipline(p_competition_id uuid, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_g public.leagues%rowtype; v_vis text; v_youth boolean;
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
  return jsonb_build_object(
    'suspended', coalesce((select jsonb_agg(jsonb_build_object(
                    'player_id', s.player_id, 'team_id', s.team_id, 'matches', s.decided_matches, 'served', s.served,
                    'name', case when v_youth then (select upper(left(p.name, 1)) || '.' from public.players p where p.id = s.player_id)
                                 else public.league_person_name(s.player_id) end))
                  from public.league_suspensions(v_c.id) s where s.active), '[]'::jsonb),
    'pending_cases', case when public.my_player_id() is not null and public.is_competition_staff(v_c.id)
                          then (select count(*) from public.competition_discipline_cases where competition_id = v_c.id and status = 'pending') end);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.decide_discipline_case(uuid, text, int, text)',
                           'public.open_discipline_case(uuid, uuid, uuid, int, text, uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.competition_discipline(uuid, text) from public';
  execute 'grant execute on function public.competition_discipline(uuid, text) to anon, authenticated, service_role';
  foreach f in array array['public.league_suspensions(uuid)', 'public.league_is_suspended(uuid, uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Formation eligibility (05b) + suspension.
create or replace function public.league_player_eligible(m public.team_matches, p_team uuid, p_player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case when m.source_type = 'competition'
              then public.league_in_squad(m, p_team, p_player) and not public.league_is_suspended(m.competition_id, p_player)
              else exists (select 1 from public.team_members tm where tm.team_id = p_team and tm.player_id = p_player and tm.status = 'active') end;
$$;

-- ── Integration addition: the manager's discipline inbox ─
-- list_discipline_cases(competition, status|null) → {items:[{case_id, player_id, name, team_id, team_name,
--   source_match_id, round, trigger, accumulation_n, suggested_matches, decided_matches, status, reason,
--   decided_at, created_at, served, active}]}
-- Competition staff only (pending suggestions are not public).
create or replace function public.list_discipline_cases(p_competition_id uuid, p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.competitions%rowtype;
begin
  select * into v_c from public.competitions where id = p_competition_id;
  if not found or not public.is_competition_staff(v_c.id) then raise exception 'league:not_found'; end if;
  return jsonb_build_object('is_manager', public.is_league_manager(v_c.league_id, v_c.id), 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
             'case_id', c.id, 'player_id', c.player_id, 'name', public.league_person_name(c.player_id),
             'team_id', c.team_id, 'team_name', coalesce(ct.registered_name, t.name),
             'source_match_id', c.source_match_id, 'round', r.number, 'trigger', c.trigger, 'accumulation_n', c.accumulation_n,
             'suggested_matches', c.suggested_matches, 'decided_matches', c.decided_matches, 'status', c.status,
             'reason', c.reason, 'decided_at', c.decided_at, 'created_at', c.created_at,
             'served', s.served, 'active', coalesce(s.active, false))
           order by (c.status = 'pending') desc, c.created_at desc)
      from public.competition_discipline_cases c
      join public.teams t on t.id = c.team_id
      left join public.competition_teams ct on ct.competition_id = c.competition_id and ct.team_id = c.team_id
      left join public.team_matches m on m.id = c.source_match_id
      left join public.competition_rounds r on r.id = m.round_id
      left join public.league_suspensions(v_c.id) s on s.case_id = c.id
     where c.competition_id = v_c.id and (p_status is null or c.status = p_status)), '[]'::jsonb));
end $$;

do $$
begin
  execute 'revoke execute on function public.list_discipline_cases(uuid, text) from public, anon';
  execute 'grant execute on function public.list_discipline_cases(uuid, text) to authenticated, service_role';
  execute 'revoke execute on function public.league_player_eligible(public.team_matches, uuid, uuid) from public, anon, authenticated';
  execute 'grant execute on function public.league_player_eligible(public.team_matches, uuid, uuid) to service_role';
end $$;

comment on table public.competition_discipline_cases is 'PITCH Ligas: discipline cases. Homologation SUGGESTS (pending); only decide_discipline_case / open_discipline_case make a suspension real. Served is derived.';
