-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L-fans (first half of design plan PR L8):
-- fans (Adepto / Torcedor / Fan) as first-class accounts — the team I
-- support, follows, notification preferences.
--
-- Source: docs/ligas-draft-sql/08_fans_awards_follows.sql §1, §3, §4 —
-- copied verbatim, minus the official MVP + fans' vote (team_match_awards,
-- team_match_fan_vote_windows, team_match_fan_votes and their RPCs), which
-- depend on homologation (draft 06) and ship later with L6/L8.
-- Depends on 01–03 (competitions, competition_teams, can_see_competition,
-- can_see_league). Check: supabase/tests/ligas_fans_check.sql.
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
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.competition_supporters (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (competition_id, player_id)
);
create index if not exists competition_supporters_team_idx on public.competition_supporters (competition_id, team_id);
comment on table public.competition_supporters is 'PITCH Ligas: the team a fan supports in one competition (one per fan per competition). Written only by set_supported_team().';

create table if not exists public.follows (
  follower_player_id uuid not null references public.players(id) on delete cascade,
  entity_type        text not null check (entity_type in ('team','player','competition','league')),
  entity_id          uuid not null,                  -- polymorphic; validated by follow()
  notify             boolean not null default true,
  created_at         timestamptz not null default now(),
  primary key (follower_player_id, entity_type, entity_id)
);
create index if not exists follows_entity_idx on public.follows (entity_type, entity_id);
comment on table public.follows is 'PITCH: asymmetric follow of ENTITIES (team, player page, competition, league). Bilateral friendship stays group-side. Written only by follow() / set_supported_team().';

create table if not exists public.notification_preferences (
  player_id  uuid not null references public.players(id) on delete cascade,
  topic      text not null check (topic in ('match_reminder','match_live','result','schedule_change','call_up',
                                            'decision','fan_vote','fantasy','announcement')),
  channel    text not null check (channel in ('push','email','whatsapp')),
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, topic, channel)
);
comment on table public.notification_preferences is 'PITCH: per-account topic x channel switches (seam for the Fase 3 league-notify Edge Function).';

-- ── 2. RLS + explicit Data API grants ────────────────────
alter table public.competition_supporters   enable row level security;
alter table public.follows                  enable row level security;
alter table public.notification_preferences enable row level security;

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

revoke all on table public.competition_supporters, public.follows, public.notification_preferences from anon, authenticated;
grant select on table public.competition_supporters, public.follows, public.notification_preferences to authenticated;
grant all on table public.competition_supporters, public.follows, public.notification_preferences to service_role;

-- ── 3. RPCs ──────────────────────────────────────────────
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_supported_team(uuid, uuid)', 'public.follow(text, uuid, boolean, boolean)',
    'public.set_notification_preference(text, text, boolean)', 'public.my_following()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
