-- ─────────────────────────────────────────────────────────
-- DRAFT — PITCH Ligas Fase 2b/3, PR L8: fans (Adepto / Torcedor / Fan) as
-- first-class accounts — supported team, follows, notification
-- preferences — plus the official MVP and the fans' vote.
--
-- NOT A MIGRATION (see 01 header). Depends on 01–06.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.12, §3.13.
--
-- A fan is just an account with a players row (created by the existing
-- ensureOwnPlayer path, group_id null — same as team-only players) and NO
-- organization role. Everything a fan does is personal and keyed by
-- my_player_id(); nothing here grants any league/team permission.
--
--   • competition_supporters   "the team I support" — one per (fan, competition).
--   • follows                  team | player | competition | league; bilateral
--                              friendship stays the group-side concept
--                              (CLAUDE.md "seguir fica para entidades").
--   • notification_preferences topic × channel switches (seam; delivery is
--                              the Fase 3 Edge Function league-notify).
--   • team_match_awards        OFFICIAL MVP, decided by the regulation's
--                              mvp.official_by role, revisioned, with author.
--   • team_match_fan_votes     "Craque da torcida": separate table, window,
--                              one vote per account per match, editable until
--                              close, results hidden until close.
-- ─────────────────────────────────────────────────────────

-- ── 1. Fans ──────────────────────────────────────────────
create table if not exists public.competition_supporters (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (competition_id, player_id)
);
create index if not exists competition_supporters_team_idx on public.competition_supporters (competition_id, team_id);

create table if not exists public.follows (
  follower_player_id uuid not null references public.players(id) on delete cascade,
  entity_type        text not null check (entity_type in ('team','player','competition','league')),
  entity_id          uuid not null,                  -- polymorphic; validated by follow()
  notify             boolean not null default true,
  created_at         timestamptz not null default now(),
  primary key (follower_player_id, entity_type, entity_id)
);
create index if not exists follows_entity_idx on public.follows (entity_type, entity_id);

create table if not exists public.notification_preferences (
  player_id  uuid not null references public.players(id) on delete cascade,
  topic      text not null check (topic in ('match_reminder','match_live','result','schedule_change','call_up',
                                            'decision','fan_vote','fantasy','announcement')),
  channel    text not null check (channel in ('push','email','whatsapp')),
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, topic, channel)
);

-- ── 2. Awards + fans' vote ───────────────────────────────
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

-- ── 3. RLS + grants ──────────────────────────────────────
alter table public.competition_supporters      enable row level security;
alter table public.follows                     enable row level security;
alter table public.notification_preferences    enable row level security;
alter table public.team_match_awards           enable row level security;
alter table public.team_match_fan_vote_windows enable row level security;
alter table public.team_match_fan_votes        enable row level security;

-- Personal rows: owner only (supporter counts per team come via RPC).
drop policy if exists "competition_supporters select" on public.competition_supporters;
create policy "competition_supporters select" on public.competition_supporters for select to authenticated
  using (player_id = public.my_player_id());
drop policy if exists "follows select" on public.follows;
create policy "follows select" on public.follows for select to authenticated
  using (follower_player_id = public.my_player_id());
drop policy if exists "notification_preferences select" on public.notification_preferences;
create policy "notification_preferences select" on public.notification_preferences for select to authenticated
  using (player_id = public.my_player_id());
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

revoke all on table public.competition_supporters, public.follows, public.notification_preferences, public.team_match_awards,
                    public.team_match_fan_vote_windows, public.team_match_fan_votes from anon, authenticated;
grant select on table public.competition_supporters, public.follows, public.notification_preferences, public.team_match_awards,
                      public.team_match_fan_vote_windows, public.team_match_fan_votes to authenticated;
grant all on table public.competition_supporters, public.follows, public.notification_preferences, public.team_match_awards,
                   public.team_match_fan_vote_windows, public.team_match_fan_votes to service_role;

-- ── 4. RPCs: fans ────────────────────────────────────────
-- set_supported_team(competition, team|null) → {team_id}
-- Any signed-in account that can see the competition; the team must be
-- homologated in it. null clears.
create or replace function public.set_supported_team(p_competition_id uuid, p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_pid uuid := public.my_player_id();
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  if not public.can_see_competition(p_competition_id) then raise exception 'league:not_found'; end if;
  if p_team_id is null then
    delete from public.competition_supporters where competition_id = p_competition_id and player_id = v_pid;
    return jsonb_build_object('team_id', null);
  end if;
  if not exists (select 1 from public.competition_teams where competition_id = p_competition_id and team_id = p_team_id and status = 'homologated') then
    raise exception 'league:team_not_registered';
  end if;
  insert into public.competition_supporters (competition_id, player_id, team_id) values (p_competition_id, v_pid, p_team_id)
  on conflict (competition_id, player_id) do update set team_id = excluded.team_id, updated_at = now();
  -- Supporting implies following (one tap); unfollowing stays possible.
  insert into public.follows (follower_player_id, entity_type, entity_id) values (v_pid, 'team', p_team_id) on conflict do nothing;
  insert into public.follows (follower_player_id, entity_type, entity_id) values (v_pid, 'competition', p_competition_id) on conflict do nothing;
  return jsonb_build_object('team_id', p_team_id);
end $$;

-- follow(entity_type, entity_id, on, notify) → {following}
-- Visibility-checked so a private competition/league cannot be probed.
create or replace function public.follow(p_entity_type text, p_entity_id uuid, p_on boolean default true, p_notify boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_pid uuid := public.my_player_id(); ok boolean;
begin
  if v_pid is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  if not p_on then
    delete from public.follows where follower_player_id = v_pid and entity_type = p_entity_type and entity_id = p_entity_id;
    return jsonb_build_object('following', false);
  end if;
  ok := case p_entity_type
          when 'team'        then exists (select 1 from public.teams where id = p_entity_id and archived_at is null)
          when 'player'      then p_entity_id <> v_pid and exists (select 1 from public.players where id = p_entity_id)
          when 'competition' then public.can_see_competition(p_entity_id)
          when 'league'      then public.can_see_league(p_entity_id)
          else false end;
  if not ok then raise exception 'league:not_found'; end if;
  insert into public.follows (follower_player_id, entity_type, entity_id, notify) values (v_pid, p_entity_type, p_entity_id, coalesce(p_notify, true))
  on conflict (follower_player_id, entity_type, entity_id) do update set notify = excluded.notify;
  return jsonb_build_object('following', true);
end $$;

-- set_notification_preference(topic, channel, enabled) → {enabled}
create or replace function public.set_notification_preference(p_topic text, p_channel text, p_enabled boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if public.my_player_id() is null then raise exception 'league:not_authenticated' using errcode = '42501'; end if;
  insert into public.notification_preferences (player_id, topic, channel, enabled)
  values (public.my_player_id(), p_topic, p_channel, p_enabled)
  on conflict (player_id, topic, channel) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('enabled', p_enabled);
exception when check_violation then raise exception 'league:invalid_preference';
end $$;

-- my_following() → {supporting:[{competition_id, team_id}], follows:[…]}   ("Acompanhando")
create or replace function public.my_following()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'supporting', coalesce((select jsonb_agg(jsonb_build_object('competition_id', s.competition_id, 'team_id', s.team_id))
                              from public.competition_supporters s where s.player_id = public.my_player_id()), '[]'::jsonb),
    'follows', coalesce((select jsonb_agg(jsonb_build_object('entity_type', f.entity_type, 'entity_id', f.entity_id, 'notify', f.notify))
                           from public.follows f where f.follower_player_id = public.my_player_id()), '[]'::jsonb));
$$;

-- ── 5. RPCs: official MVP ────────────────────────────────
-- award_official_mvp(match, player, reason) → {revision}
-- Role in regulation mvp.official_by (referee = assigned referee; owner /
-- manager = league role). Only after the match is finished. Re-awarding
-- supersedes (audited). Never derived from the fans' vote.
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
  return jsonb_build_object('revision', v_rev);
end $$;

-- ── 6. RPCs: fans' vote ──────────────────────────────────
-- open_fan_vote(match, hours) → {opens_at, closes_at}   (competition manager; regulation mvp.fan_vote = true)
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
-- players who appeared (official snapshot) or, before homologation, the lineups.
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

-- fan_vote_results(match) → {state:'open'|'closed'|'none', items:[{player_id, name, votes}] (closed only), my_vote}
create or replace function public.fan_vote_results(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare w public.team_match_fan_vote_windows%rowtype; v_closed boolean;
begin
  if not public.can_see_match(p_match_id) then raise exception 'league:match_not_found'; end if;
  select * into w from public.team_match_fan_vote_windows where match_id = p_match_id;
  if not found then return jsonb_build_object('state', 'none'); end if;
  v_closed := now() >= w.closes_at;
  return jsonb_build_object(
    'state', case when v_closed then 'closed' else 'open' end, 'closes_at', w.closes_at,
    'my_vote', (select voted_player_id from public.team_match_fan_votes where match_id = p_match_id and voter_player_id = public.my_player_id()),
    'items', case when v_closed then coalesce((
               select jsonb_agg(jsonb_build_object('player_id', v.voted_player_id, 'name', public.league_person_name(v.voted_player_id), 'votes', v.n)
                                order by v.n desc)
                 from (select voted_player_id, count(*)::int as n from public.team_match_fan_votes where match_id = p_match_id group by 1) v), '[]'::jsonb) end);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_supported_team(uuid, uuid)', 'public.follow(text, uuid, boolean, boolean)',
    'public.set_notification_preference(text, text, boolean)', 'public.my_following()',
    'public.award_official_mvp(uuid, uuid, text)', 'public.open_fan_vote(uuid, int)',
    'public.cast_fan_vote(uuid, uuid)', 'public.fan_vote_results(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
