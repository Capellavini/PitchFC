-- ─────────────────────────────────────────────────────────
-- Pitch VAR hardening (Cris review, 2026-10-14)
--
-- H1  Recurring games reuse the same games row every week. Ending a
--     matchday (live_matchday → null, also done by "Cancelar dia" and the
--     weekly reset) set var_games.finished_at forever, so the next week the
--     organizer got "Esta partida já terminou." and VAR could never be
--     turned on again for that group. Now: a new weekly cycle
--     (games.cycle_opened_at changes) or a new matchday starting
--     (live_matchday null → not null) re-opens var_games (enabled=false —
--     the organizer turns it on again). Plus a one-time repair of rows
--     already stuck.
-- H2  var_* foreign keys to players / auth.users / groups had no ON DELETE,
--     so removing a member who scored or filmed, deleting an account (GDPR)
--     or deleting a group failed with an FK violation. Now ON DELETE CASCADE
--     (VAR rows are short-lived metadata; clips expire after 3h anyway).
-- H3  The SECURITY DEFINER goal-sync trigger trusted any write to
--     games.live_matchday, and RLS lets any group member update games →
--     a plain member could fabricate VAR goals or end VAR. Now the VAR side
--     effects only run for organizer/assistant writes (is_group_manager) or
--     server-side writes with no user (cron / service role).
-- M1  A VAR error inside the trigger could abort the organizer's
--     live_matchday UPDATE (the goal itself not saved). The VAR work is now
--     wrapped: on any error it logs a warning and the matchday write goes on.
--
-- Body of var_sync_goals is otherwise identical to 20261013160044.
-- ─────────────────────────────────────────────────────────

-- ── H2: ON DELETE CASCADE on every var_* FK to players / auth.users / groups / var_goals
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col,
           c.confrelid::regclass as ref, af.attname as refcol
    from pg_constraint c
    join pg_attribute a  on a.attrelid = c.conrelid  and a.attnum  = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f'
      and c.conrelid in ('public.var_sessions'::regclass, 'public.var_goals'::regclass, 'public.var_cloud_clips'::regclass)
      and c.confrelid in ('public.players'::regclass, 'auth.users'::regclass, 'public.groups'::regclass, 'public.var_goals'::regclass)
      and c.confdeltype <> 'c'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s(%I) on delete cascade',
                   r.tbl, r.conname, r.col, r.ref, r.refcol);
  end loop;
end $$;

-- ── H1 + H3 + M1: goal-sync trigger
create or replace function private.var_sync_goals() returns trigger language plpgsql security definer set search_path='' as $$
declare m jsonb; e jsonb; eid uuid; scorer uuid; at_time timestamptz; valid_event_ids uuid[]:='{}'; v public.var_games; existing public.var_goals;
begin
 select * into v from public.var_games where game_id=new.id;
 if v.game_id is null then return new;end if;
 -- H3: only managers (or server-side writes without a user) drive VAR.
 if auth.uid() is not null and not public.is_group_manager(new.group_id) then return new;end if;
 begin
  -- H1: a new matchday on a reused (recurring) games row re-opens VAR.
  if old.live_matchday is null and new.live_matchday is not null and v.finished_at is not null then
   update public.var_games set finished_at=null,enabled=false,updated_at=now() where game_id=new.id;
   v.finished_at:=null; v.enabled:=false;
  end if;
  if new.live_matchday is null then
   if old.live_matchday is not null then
    update public.var_games set finished_at=coalesce(finished_at,now()),enabled=false where game_id=new.id;
    update public.var_sessions set active=false,lease_expires_at=now() where game_id=new.id;
    update public.var_goals set expires_at=least(expires_at,now()+interval '3 hours') where game_id=new.id;
    update public.var_cloud_clips c set expires_at=least(c.expires_at,g.expires_at) from public.var_goals g where c.goal_id=g.id and g.game_id=new.id;
   end if;
   return new;
  end if;
  update public.var_sessions set match_id=coalesce(private.var_current_match(new.live_matchday)->>'id','__waiting__') where game_id=new.id and active and follow_matchday;
  for m in select value from jsonb_array_elements(coalesce(new.live_matchday->'matches','[]'::jsonb)) loop
   for e in select value from jsonb_array_elements(coalesce(m->'events','[]'::jsonb)) loop
    if e->>'type'='epicSave' or e->>'eventId' is null or e->>'scorerPlayerId' is null then continue;end if;
    begin eid:=(e->>'eventId')::uuid;scorer:=(e->>'scorerPlayerId')::uuid;at_time:=(e->>'occurredAt')::timestamptz;
    exception when others then continue;end;
    if at_time is null or at_time>now()+interval '3 seconds' or at_time<now()-interval '6 hours'
     or not exists(select 1 from public.attendances a join public.player_group_memberships pm on pm.player_id=a.player_id and pm.group_id=new.group_id and not pm.banned where a.game_id=new.id and a.player_id=scorer and a.status='confirmed') then continue;end if;
    valid_event_ids:=array_append(valid_event_ids,eid);
    select * into existing from public.var_goals where id=eid;
    if existing.id is not null then
     if existing.game_id=new.id and existing.match_id=m->>'id' then
      update public.var_goals set scorer_player_id=scorer,own_goal=coalesce((e->>'ownGoal')::boolean,false),cancelled=false where id=eid;
     end if;
     continue;
    end if;
    if not v.enabled or v.finished_at is not null then continue;end if;
    insert into public.var_goals(id,game_id,group_id,match_id,scorer_player_id,own_goal,occurred_at)
     values(eid,new.id,new.group_id,m->>'id',scorer,coalesce((e->>'ownGoal')::boolean,false),at_time)
     on conflict (id) do nothing;
    insert into public.var_requests(goal_id,session_id)
     select eid,s.id from public.var_sessions s where s.game_id=new.id and (s.follow_matchday or s.match_id=m->>'id') and s.active and s.lease_expires_at>now() and s.capture_started_at<=at_time
      and exists(select 1 from public.attendances a join public.player_group_memberships pm on pm.player_id=a.player_id and pm.group_id=s.group_id and not pm.banned where a.game_id=s.game_id and a.player_id=s.operator_player_id and a.status='confirmed')
     on conflict (goal_id,session_id) do nothing;
   end loop;
  end loop;
  update public.var_goals set cancelled=true where game_id=new.id and not (id=any(valid_event_ids));
  update public.var_cloud_clips c set expires_at=now() from public.var_goals g where g.id=c.goal_id and g.game_id=new.id and g.cancelled;
 exception when others then
  -- M1: never block the organizer's scoring because of VAR.
  raise warning 'pitch var sync skipped for game % (%): %', new.id, sqlstate, sqlerrm;
 end;
 return new;
end;
$$;
revoke all on function private.var_sync_goals() from public;

-- ── H1: a new weekly cycle re-opens VAR on the reused games row
create or replace function private.var_reset_on_new_cycle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cycle_opened_at is distinct from old.cycle_opened_at then
  update public.var_games set finished_at=null,enabled=false,updated_at=now()
   where game_id=new.id and finished_at is not null;
 end if;
 return new;
end;
$$;
revoke all on function private.var_reset_on_new_cycle() from public;
drop trigger if exists pitch_var_new_cycle on public.games;
create trigger pitch_var_new_cycle after update of cycle_opened_at on public.games
 for each row execute function private.var_reset_on_new_cycle();

-- ── H1: one-time repair of rows stuck from previous weeks
update public.var_games v set finished_at=null, enabled=false, updated_at=now()
from public.games g
where g.id=v.game_id and v.finished_at is not null
  and g.cycle_opened_at is not null and g.cycle_opened_at > v.finished_at;
