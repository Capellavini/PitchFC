-- ─────────────────────────────────────────────────────────
-- Migration — PITCH Rivals (2/3): challenges + the shared team match
--
-- Plan: docs/RIVALS-PLAN.md §2 "20261013140000_rivals_challenges" + §3 "Challenges"
-- RPCs. Spec: docs/TEAMS-CHALLENGES-SPEC.md (owner decisions block wins:
-- response deadline = min(now + 24h, kickoff − 2h), decision 9).
--
-- What this does
--   • team_challenges         ONE row per challenge (stable id for links and
--                             FKs). status = the negotiation only:
--                             pending | agreed | declined | cancelled | expired.
--                             mode directed (challenged team known) or
--                             claimable (open link; challenged_team_id stays
--                             null until a leader of another team claims it —
--                             the two are never mixed). turn_team_id = whose
--                             answer is awaited. current_version = the latest
--                             version number (incl. a pending post-agreement
--                             change). expires_at = the response deadline of
--                             whatever is open (pending proposal, or a pending
--                             change while status = 'agreed').
--   • team_challenge_versions immutable terms, one row per proposal /
--                             counter / change (PK challenge_id, version).
--                             Only outcome + responded_* are ever written
--                             after insert (trigger-enforced).
--   • team_matches            the ONE shared match of an agreed challenge
--                             (unique challenge_id). match_status, field_status
--                             and result_status are separate; result_status
--                             stays 'none' until 007200 (results).
--   • RLS: members of either team read; NO write policies, NO direct writes
--     (every transition is a SECURITY DEFINER RPC that locks the challenge
--     row, validates, and writes an audit row).
--   • expire_rivals() hourly via pg_cron ('pitch-rivals-expire'); RPCs also
--     treat an overdue pending challenge as expired (refuse with
--     rivals:challenge_expired) and create_challenge / claims persist the
--     expiry of the pair's stale rows before inserting. Expiry never touches
--     results and never counts as a loss.
--   • Teams being archived (archive_team, or the last member leaving)
--     cancel their pending challenges / pending changes / scheduled matches
--     (trigger); archive_team itself refuses while a match is scheduled.
--
-- Never touches games / attendances / matchdays (option B). Same policy
-- fingerprint technique as 007000 ('migration_baseline:20261013140000').
--
-- Errors: 'rivals:<code>' (src/lib/rivalsCopy.js maps them to copy).
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

-- ── 0. Regression baseline (first run only) ──────────────
insert into public.rivals_audit_log (action, payload)
select 'migration_baseline:20261013140000', jsonb_build_object(
  'group_policies_md5', (
    select md5(coalesce(string_agg(
      format('%s|%s|%s|%s|%s|%s|%s', tablename, policyname, permissive, cmd, roles::text,
             coalesce(qual, ''), coalesce(with_check, '')),
      E'\n' order by tablename, policyname), ''))
    from pg_policies
    where schemaname = 'public' and tablename in ('games', 'attendances', 'matchdays')
  ))
where not exists (select 1 from public.rivals_audit_log where action = 'migration_baseline:20261013140000');

-- ── 1. team_challenges ───────────────────────────────────
create table if not exists public.team_challenges (
  id                    uuid primary key default gen_random_uuid(),
  challenger_team_id    uuid not null,
  challenged_team_id    uuid,
  mode                  text not null,
  -- 32 hex chars (122 random bits) — the ?desafio=<token> link.
  invite_token          text not null default replace(gen_random_uuid()::text, '-', ''),
  status                text not null default 'pending',
  current_version       int  not null default 1,
  turn_team_id          uuid,
  expires_at            timestamptz not null,
  pending_change_version int,
  created_by            uuid references public.players(id) on delete set null,
  client_ref            text,
  decided_by_team_id    uuid references public.teams(id) on delete set null,
  decided_by_player_id  uuid references public.players(id) on delete set null,
  decided_at            timestamptz,
  reason                text,
  rematch_of_match_id   uuid,   -- FK below (team_matches); used by PR9 (rematch)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint team_challenges_challenger_fkey foreign key (challenger_team_id) references public.teams(id) on delete cascade,
  constraint team_challenges_challenged_fkey foreign key (challenged_team_id) references public.teams(id) on delete cascade,
  constraint team_challenges_turn_fkey       foreign key (turn_team_id)       references public.teams(id) on delete set null,
  constraint team_challenges_token_key       unique (invite_token),
  constraint team_challenges_client_ref_key  unique (created_by, client_ref),
  constraint team_challenges_mode_check      check (mode in ('directed','claimable')),
  constraint team_challenges_status_check    check (status in ('pending','agreed','declined','cancelled','expired')),
  constraint team_challenges_directed_check  check (mode = 'claimable' or challenged_team_id is not null),
  constraint team_challenges_distinct_check  check (challenged_team_id is null or challenged_team_id <> challenger_team_id),
  constraint team_challenges_version_check   check (current_version between 1 and 50),
  constraint team_challenges_reason_check    check (reason is null or char_length(reason) <= 280),
  constraint team_challenges_client_ref_check check (client_ref is null or client_ref ~ '^[A-Za-z0-9_-]{8,64}$')
);

-- One OPEN proposal per team pair (either direction).
create unique index if not exists team_challenges_one_open_pair_key
  on public.team_challenges (least(challenger_team_id, challenged_team_id), greatest(challenger_team_id, challenged_team_id))
  where status = 'pending' and challenged_team_id is not null;
create index if not exists team_challenges_challenger_idx on public.team_challenges (challenger_team_id, status, updated_at desc);
create index if not exists team_challenges_challenged_idx on public.team_challenges (challenged_team_id, status, updated_at desc);
create index if not exists team_challenges_open_expiry_idx
  on public.team_challenges (expires_at) where status = 'pending' or pending_change_version is not null;

-- ── 2. team_challenge_versions (immutable terms) ─────────
create table if not exists public.team_challenge_versions (
  challenge_id           uuid not null references public.team_challenges(id) on delete cascade,
  version                int  not null,
  kind                   text not null check (kind in ('proposal','counter','change')),
  proposed_by_team_id    uuid not null references public.teams(id) on delete cascade,
  proposed_by_player_id  uuid references public.players(id) on delete set null,
  kickoff_at             timestamptz not null,
  timezone               text not null,
  format                 text not null check (format in ('5v5','6v6','7v7','8v8','9v9','11v11')),
  duration_min           int  not null check (duration_min between 20 and 180),
  venue_name             text check (venue_name is null or char_length(venue_name) between 1 and 80),
  venue_address          text check (venue_address is null or char_length(venue_address) <= 120),
  venue_url              text check (venue_url is null or (venue_url ~ '^https://' and char_length(venue_url) <= 500)),
  -- who confirms the pitch is available (relative to the challenge, so it
  -- reads the same across counters): challenger | challenged.
  field_responsible      text not null check (field_responsible in ('challenger','challenged')),
  -- Informational only — PITCH never charges, books or collects.
  cost_cents             int  check (cost_cents is null or cost_cents between 0 and 10000000),
  currency               text not null check (currency in ('EUR','BRL')),
  cost_split             text not null check (cost_split in ('split','challenger','challenged','loser','none')),
  note                   text check (note is null or char_length(note) <= 280),
  -- Set exactly once when the version stops being open.
  outcome                text check (outcome is null or outcome in ('accepted','declined','countered','cancelled','expired')),
  responded_by_player_id uuid references public.players(id) on delete set null,
  responded_at           timestamptz,
  created_at             timestamptz not null default now(),
  primary key (challenge_id, version)
);

-- History is never rewritten: only outcome/responded_* may change, and
-- the outcome only once. (Player FKs set null on account deletion are
-- allowed too.)
create or replace function public.rivals_versions_immutable()
returns trigger language plpgsql set search_path = public as $$
declare skip text[] := array['outcome','responded_by_player_id','responded_at','proposed_by_player_id'];
begin
  if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    raise exception 'rivals:version_immutable';
  end if;
  if old.outcome is not null and new.outcome is distinct from old.outcome then
    raise exception 'rivals:version_immutable';
  end if;
  return new;
end $$;
drop trigger if exists team_challenge_versions_immutable on public.team_challenge_versions;
create trigger team_challenge_versions_immutable before update on public.team_challenge_versions
  for each row execute function public.rivals_versions_immutable();

-- ── 3. team_matches (one per agreed challenge) ───────────
create table if not exists public.team_matches (
  id                     uuid primary key default gen_random_uuid(),
  challenge_id           uuid not null,
  home_team_id           uuid not null,   -- the challenger
  away_team_id           uuid not null,   -- the challenged
  agreed_version         int  not null,
  -- Terms copied from the agreed version (a later accepted change rewrites them).
  kickoff_at             timestamptz not null,
  timezone               text not null,
  format                 text not null check (format in ('5v5','6v6','7v7','8v8','9v9','11v11')),
  duration_min           int  not null check (duration_min between 20 and 180),
  venue_name             text,
  venue_address          text,
  venue_url              text,
  field_responsible      text not null check (field_responsible in ('challenger','challenged')),
  cost_cents             int,
  currency               text not null check (currency in ('EUR','BRL')),
  cost_split             text not null check (cost_split in ('split','challenger','challenged','loser','none')),
  note                   text,
  match_status           text not null default 'scheduled' check (match_status in ('scheduled','cancelled','not_played','played')),
  -- Accepting a challenge NEVER books the pitch: unconfirmed until the
  -- responsible team says so.
  field_status           text not null default 'unconfirmed' check (field_status in ('unconfirmed','confirmed','unavailable')),
  field_note             text check (field_note is null or char_length(field_note) <= 280),
  field_status_by        uuid references public.players(id) on delete set null,
  field_status_at        timestamptz,
  -- Results arrive with 007200; placeholders so the shape is final.
  result_status          text not null default 'none' check (result_status in ('none','reported','disputed','confirmed')),
  official_home_score    int check (official_home_score is null or official_home_score between 0 and 99),
  official_away_score    int check (official_away_score is null or official_away_score between 0 and 99),
  confirmed_revision     int,
  result_confirmed_at    timestamptz,
  cancelled_by_team_id   uuid references public.teams(id) on delete set null,
  cancelled_by_player_id uuid references public.players(id) on delete set null,
  cancelled_at           timestamptz,
  cancel_reason          text check (cancel_reason is null or char_length(cancel_reason) <= 280),
  not_played_reason      text check (not_played_reason is null or char_length(not_played_reason) <= 280),
  not_played_at          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint team_matches_challenge_fkey foreign key (challenge_id) references public.team_challenges(id) on delete cascade,
  constraint team_matches_challenge_key  unique (challenge_id),
  constraint team_matches_home_fkey      foreign key (home_team_id) references public.teams(id) on delete cascade,
  constraint team_matches_away_fkey      foreign key (away_team_id) references public.teams(id) on delete cascade,
  constraint team_matches_distinct_check check (home_team_id <> away_team_id)
);
create index if not exists team_matches_home_idx on public.team_matches (home_team_id, kickoff_at desc);
create index if not exists team_matches_away_idx on public.team_matches (away_team_id, kickoff_at desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_challenges_rematch_fkey') then
    alter table public.team_challenges add constraint team_challenges_rematch_fkey
      foreign key (rematch_of_match_id) references public.team_matches(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rivals_audit_log_challenge_fkey') then
    alter table public.rivals_audit_log add constraint rivals_audit_log_challenge_fkey
      foreign key (challenge_id) references public.team_challenges(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rivals_audit_log_match_fkey') then
    alter table public.rivals_audit_log add constraint rivals_audit_log_match_fkey
      foreign key (match_id) references public.team_matches(id) on delete set null;
  end if;
end $$;
create index if not exists rivals_audit_log_challenge_idx on public.rivals_audit_log (challenge_id, created_at desc) where challenge_id is not null;

-- ── 4. Helpers ───────────────────────────────────────────
-- Can the caller see this challenge? (member of either team, or admin)
create or replace function public.can_see_challenge(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.team_challenges ch
     where ch.id = c
       and (public.is_team_member(ch.challenger_team_id)
            or (ch.challenged_team_id is not null and public.is_team_member(ch.challenged_team_id))));
$$;

-- Internal: audit row for a challenge / match transition.
create or replace function public.rivals_audit_challenge(p_team uuid, p_challenge uuid, p_match uuid, p_action text,
                                                         p_payload jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.rivals_audit_log (team_id, challenge_id, match_id, actor_player_id, action, payload)
  values (p_team, p_challenge, p_match, public.my_player_id(), p_action, coalesce(p_payload, '{}'::jsonb));
$$;

-- Response deadline (owner decision 2026-10-08): min(now + 24h, kickoff − 2h).
create or replace function public.rivals_deadline(p_kickoff timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select least(now() + interval '24 hours', p_kickoff - interval '2 hours');
$$;

-- Internal: terms of a version / match as the normalised jsonb used by
-- rivals_norm_terms (same keys, same value rendering).
create or replace function public.rivals_version_terms(v public.team_challenge_versions)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'kickoff_at', to_jsonb(v.kickoff_at), 'timezone', v.timezone, 'format', v.format, 'duration_min', v.duration_min,
    'venue_name', v.venue_name, 'venue_address', v.venue_address, 'venue_url', v.venue_url,
    'field_responsible', v.field_responsible, 'cost_cents', v.cost_cents, 'currency', v.currency,
    'cost_split', v.cost_split, 'note', v.note);
$$;
create or replace function public.rivals_match_terms(m public.team_matches)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'kickoff_at', to_jsonb(m.kickoff_at), 'timezone', m.timezone, 'format', m.format, 'duration_min', m.duration_min,
    'venue_name', m.venue_name, 'venue_address', m.venue_address, 'venue_url', m.venue_url,
    'field_responsible', m.field_responsible, 'cost_cents', m.cost_cents, 'currency', m.currency,
    'cost_split', m.cost_split, 'note', m.note);
$$;

-- Internal: validate + normalise a terms object. Keys missing from p_terms
-- come from p_base (the version being countered / the agreed match), so a
-- counter can send only what changed. Returns the full normalised object.
create or replace function public.rivals_norm_terms(p_terms jsonb, p_base jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  k      text;
  t      jsonb;
  v_kick timestamptz;
  v_dur  int;
  v_cost int;
  s      text;
begin
  if p_terms is null or jsonb_typeof(p_terms) <> 'object' then raise exception 'rivals:invalid_terms'; end if;
  for k in select jsonb_object_keys(p_terms) loop
    if k not in ('kickoff_at','timezone','format','duration_min','venue_name','venue_address','venue_url',
                 'field_responsible','cost_cents','currency','cost_split','note') then
      raise exception 'rivals:invalid_field' using detail = k;
    end if;
  end loop;
  t := coalesce(p_base, '{}'::jsonb) || p_terms;

  begin
    v_kick := (t->>'kickoff_at')::timestamptz;
  exception when others then raise exception 'rivals:invalid_kickoff';
  end;
  if v_kick is null then raise exception 'rivals:invalid_kickoff'; end if;

  if t->>'timezone' is null or not exists (select 1 from pg_timezone_names where name = t->>'timezone') then
    raise exception 'rivals:invalid_timezone';
  end if;
  if coalesce(t->>'format', '') not in ('5v5','6v6','7v7','8v8','9v9','11v11') then raise exception 'rivals:invalid_format'; end if;

  begin
    v_dur := (t->>'duration_min')::int;
  exception when others then raise exception 'rivals:invalid_duration';
  end;
  if v_dur is null or v_dur not between 20 and 180 then raise exception 'rivals:invalid_duration'; end if;

  s := nullif(btrim(coalesce(t->>'venue_name', '')), '');
  if char_length(coalesce(s, '')) > 80 then raise exception 'rivals:invalid_venue'; end if;
  t := jsonb_set(t, '{venue_name}', coalesce(to_jsonb(s), 'null'::jsonb));
  s := nullif(btrim(coalesce(t->>'venue_address', '')), '');
  if char_length(coalesce(s, '')) > 120 then raise exception 'rivals:invalid_venue'; end if;
  t := jsonb_set(t, '{venue_address}', coalesce(to_jsonb(s), 'null'::jsonb));
  s := nullif(btrim(coalesce(t->>'venue_url', '')), '');
  if s is not null and (s !~ '^https://' or char_length(s) > 500) then raise exception 'rivals:invalid_venue'; end if;
  t := jsonb_set(t, '{venue_url}', coalesce(to_jsonb(s), 'null'::jsonb));

  if coalesce(t->>'field_responsible', '') not in ('challenger','challenged') then raise exception 'rivals:invalid_field_responsible'; end if;

  if t->>'cost_cents' is null then
    v_cost := null;
  else
    begin
      v_cost := (t->>'cost_cents')::int;
    exception when others then raise exception 'rivals:invalid_cost';
    end;
    if v_cost not between 0 and 10000000 then raise exception 'rivals:invalid_cost'; end if;
  end if;
  if coalesce(t->>'currency', '') not in ('EUR','BRL') then raise exception 'rivals:invalid_currency'; end if;
  if coalesce(t->>'cost_split', '') not in ('split','challenger','challenged','loser','none') then raise exception 'rivals:invalid_split'; end if;

  s := nullif(btrim(coalesce(t->>'note', '')), '');
  if char_length(coalesce(s, '')) > 280 then raise exception 'rivals:note_too_long'; end if;

  return jsonb_build_object(
    'kickoff_at', to_jsonb(v_kick), 'timezone', t->>'timezone', 'format', t->>'format', 'duration_min', v_dur,
    'venue_name', t->'venue_name', 'venue_address', t->'venue_address', 'venue_url', t->'venue_url',
    'field_responsible', t->>'field_responsible', 'cost_cents', v_cost, 'currency', t->>'currency',
    'cost_split', t->>'cost_split', 'note', coalesce(to_jsonb(s), 'null'::jsonb));
end $$;

-- Internal: kickoff must be ≥ 3h ahead (so the 24h/kickoff−2h response
-- window is at least 1h) and ≤ 180 days ahead.
create or replace function public.rivals_check_kickoff(p_terms jsonb)
returns timestamptz language plpgsql stable set search_path = public as $$
declare v_kick timestamptz := (p_terms->>'kickoff_at')::timestamptz;
begin
  if v_kick < now() + interval '3 hours' then raise exception 'rivals:kickoff_too_soon'; end if;
  if v_kick > now() + interval '180 days' then raise exception 'rivals:kickoff_too_far'; end if;
  return v_kick;
end $$;

-- Internal: keys whose value differs between two normalised term objects.
create or replace function public.rivals_changed_keys(a jsonb, b jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
    from jsonb_object_keys(coalesce(a, '{}'::jsonb) || coalesce(b, '{}'::jsonb)) k
   where (a->k) is distinct from (b->k);
$$;

-- Internal: insert a version row from a normalised terms object.
create or replace function public.rivals_insert_version(p_challenge uuid, p_version int, p_kind text, p_team uuid, t jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.team_challenge_versions (
    challenge_id, version, kind, proposed_by_team_id, proposed_by_player_id,
    kickoff_at, timezone, format, duration_min, venue_name, venue_address, venue_url,
    field_responsible, cost_cents, currency, cost_split, note)
  values (
    p_challenge, p_version, p_kind, p_team, public.my_player_id(),
    (t->>'kickoff_at')::timestamptz, t->>'timezone', t->>'format', (t->>'duration_min')::int,
    t->>'venue_name', t->>'venue_address', t->>'venue_url',
    t->>'field_responsible', (t->>'cost_cents')::int, t->>'currency', t->>'cost_split', t->>'note');
$$;

-- Internal: persist the expiry of overdue open items (one team's, or all
-- when p_team is null). Pending proposals → status 'expired'; pending
-- post-agreement changes → dropped (the match keeps its agreed terms).
-- Never touches results. Returns how many rows expired.
create or replace function public.rivals_expire_due(p_team uuid default null)
returns int language plpgsql volatile security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, current_version, challenger_team_id from public.team_challenges
     where status = 'pending' and expires_at <= now()
       and (p_team is null or challenger_team_id = p_team or challenged_team_id = p_team)
     for update skip locked
  loop
    update public.team_challenges set status = 'expired', turn_team_id = null, updated_at = now() where id = r.id;
    update public.team_challenge_versions set outcome = 'expired', responded_at = now()
     where challenge_id = r.id and version = r.current_version and outcome is null;
    insert into public.rivals_audit_log (team_id, challenge_id, action, payload)
    values (r.challenger_team_id, r.id, 'challenge_expired', jsonb_build_object('version', r.current_version));
    n := n + 1;
  end loop;
  for r in
    select c.id, c.pending_change_version, c.challenger_team_id, m.id as match_id
      from public.team_challenges c left join public.team_matches m on m.challenge_id = c.id
     where c.status = 'agreed' and c.pending_change_version is not null and c.expires_at <= now()
       and (p_team is null or c.challenger_team_id = p_team or c.challenged_team_id = p_team)
     for update of c skip locked
  loop
    update public.team_challenge_versions set outcome = 'expired', responded_at = now()
     where challenge_id = r.id and version = r.pending_change_version and outcome is null;
    update public.team_challenges set pending_change_version = null, turn_team_id = null, updated_at = now() where id = r.id;
    insert into public.rivals_audit_log (team_id, challenge_id, match_id, action, payload)
    values (r.challenger_team_id, r.id, r.match_id, 'match_change_expired', jsonb_build_object('version', r.pending_change_version));
    n := n + 1;
  end loop;
  return n;
end $$;

-- pg_cron entry point (hourly). Not callable through the API.
create or replace function public.expire_rivals()
returns int language sql volatile security definer set search_path = public as $$
  select public.rivals_expire_due(null);
$$;

-- Internal: which of the two teams the caller acts for. p_as_team picks
-- explicitly (a player who leads both teams); otherwise the team whose
-- turn it is, then the challenger, then the challenged.
create or replace function public.rivals_acting_team(ch public.team_challenges, p_as_team uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if p_as_team is not null then
    if p_as_team is distinct from ch.challenger_team_id and p_as_team is distinct from ch.challenged_team_id then
      raise exception 'rivals:not_a_party' using errcode = '42501';
    end if;
    if not public.is_team_leader(p_as_team) then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
    return p_as_team;
  end if;
  if ch.turn_team_id is not null and public.is_team_leader(ch.turn_team_id) then return ch.turn_team_id; end if;
  if public.is_team_leader(ch.challenger_team_id) then return ch.challenger_team_id; end if;
  if ch.challenged_team_id is not null and public.is_team_leader(ch.challenged_team_id) then return ch.challenged_team_id; end if;
  raise exception 'rivals:not_team_leader' using errcode = '42501';
end $$;

-- Internal: claim an unclaimed claimable challenge for p_as_team (caller
-- must lead it and hold the link's token). Runs with the row already
-- locked. Returns the updated row.
create or replace function public.rivals_claim(ch public.team_challenges, p_as_team uuid, p_token text)
returns public.team_challenges language plpgsql volatile security definer set search_path = public as $$
declare v_row public.team_challenges%rowtype;
begin
  if p_token is null or p_token is distinct from ch.invite_token then raise exception 'rivals:invalid_token' using errcode = '42501'; end if;
  if p_as_team is null then raise exception 'rivals:choose_team'; end if;
  if p_as_team = ch.challenger_team_id then raise exception 'rivals:cannot_accept_own'; end if;
  if not public.is_team_leader(p_as_team) then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;
  if exists (select 1 from public.teams where id = p_as_team and archived_at is not null) then raise exception 'rivals:team_archived'; end if;
  perform public.rivals_expire_due(p_as_team);
  begin
    update public.team_challenges
       set challenged_team_id = p_as_team, turn_team_id = p_as_team, updated_at = now()
     where id = ch.id
     returning * into v_row;
  exception when unique_violation then
    raise exception 'rivals:pair_open_challenge';
  end;
  perform public.rivals_audit_challenge(p_as_team, ch.id, null, 'challenge_claimed', '{}'::jsonb);
  return v_row;
end $$;

-- Internal: public team card used by the reads below.
create or replace function public.rivals_team_card(p_team uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'slug', t.slug, 'city', t.city, 'region', t.region, 'country', t.country,
    'color', t.color, 'secondary_color', t.secondary_color, 'logo_url', t.logo_url,
    'preferred_format', t.preferred_format, 'home_venue', t.home_venue, 'timezone', t.timezone,
    'currency', t.currency, 'archived', t.archived_at is not null,
    'captain_nick', (select coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1))
                       from public.team_members m join public.players p on p.id = m.player_id
                      where m.team_id = t.id and m.role = 'captain' and m.status = 'active' limit 1))
    from public.teams t where t.id = p_team;
$$;

-- ── 5. RLS: read-only, members of either team ────────────
alter table public.team_challenges         enable row level security;
alter table public.team_challenge_versions enable row level security;
alter table public.team_matches            enable row level security;

drop policy if exists "team_challenges select" on public.team_challenges;
create policy "team_challenges select" on public.team_challenges for select to authenticated
  using (public.is_team_member(challenger_team_id)
         or (challenged_team_id is not null and public.is_team_member(challenged_team_id))
         or public.is_admin());

drop policy if exists "team_challenge_versions select" on public.team_challenge_versions;
create policy "team_challenge_versions select" on public.team_challenge_versions for select to authenticated
  using (public.can_see_challenge(challenge_id));

drop policy if exists "team_matches select" on public.team_matches;
create policy "team_matches select" on public.team_matches for select to authenticated
  using (public.is_team_member(home_team_id) or public.is_team_member(away_team_id) or public.is_admin());

-- Audit rows of a challenge are readable by both teams (007000 only
-- covered rows tagged with one of my teams).
drop policy if exists "rivals_audit_log select" on public.rivals_audit_log;
create policy "rivals_audit_log select" on public.rivals_audit_log for select to authenticated
  using ((team_id is not null and public.is_team_member(team_id))
         or (challenge_id is not null and public.can_see_challenge(challenge_id))
         or public.is_admin());

-- ── 6. Table grants (explicit — CLAUDE.md, Oct 30 2026 change) ──
revoke all on table public.team_challenges         from anon, authenticated;
revoke all on table public.team_challenge_versions from anon, authenticated;
revoke all on table public.team_matches            from anon, authenticated;
grant  select on table public.team_challenges         to authenticated;
grant  select on table public.team_challenge_versions to authenticated;
grant  select on table public.team_matches            to authenticated;
grant  all    on table public.team_challenges         to service_role;
grant  all    on table public.team_challenge_versions to service_role;
grant  all    on table public.team_matches            to service_role;

do $$ begin alter publication supabase_realtime add table public.team_challenges; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.team_matches;    exception when others then null; end $$;

-- ── 7. Team archiving cancels what's open (never a loss) ─
create or replace function public.rivals_on_team_archived()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is null or old.archived_at is not null then return new; end if;
  -- Pending proposals.
  update public.team_challenge_versions v set outcome = 'cancelled', responded_at = now()
    from public.team_challenges c
   where c.id = v.challenge_id and v.version = c.current_version and v.outcome is null
     and c.status = 'pending' and (c.challenger_team_id = new.id or c.challenged_team_id = new.id);
  update public.team_challenges
     set status = 'cancelled', turn_team_id = null, decided_by_team_id = new.id, decided_at = now(),
         reason = 'team_archived', updated_at = now()
   where status = 'pending' and (challenger_team_id = new.id or challenged_team_id = new.id);
  -- Pending post-agreement changes.
  update public.team_challenge_versions v set outcome = 'cancelled', responded_at = now()
    from public.team_challenges c
   where c.id = v.challenge_id and v.version = c.pending_change_version and v.outcome is null
     and c.status = 'agreed' and (c.challenger_team_id = new.id or c.challenged_team_id = new.id);
  update public.team_challenges set pending_change_version = null, turn_team_id = null, updated_at = now()
   where status = 'agreed' and pending_change_version is not null
     and (challenger_team_id = new.id or challenged_team_id = new.id);
  -- Scheduled matches without a result.
  update public.team_matches
     set match_status = 'cancelled', cancelled_by_team_id = new.id, cancelled_at = now(),
         cancel_reason = 'team_archived', updated_at = now()
   where match_status = 'scheduled' and result_status = 'none' and (home_team_id = new.id or away_team_id = new.id);
  insert into public.rivals_audit_log (team_id, action, payload)
  values (new.id, 'team_archived_challenges_closed', '{}'::jsonb);
  return new;
end $$;
drop trigger if exists teams_rivals_archived on public.teams;
create trigger teams_rivals_archived after update of archived_at on public.teams
  for each row execute function public.rivals_on_team_archived();

-- archive_team (007000 EXTENSION POINT): refuse while a match is still to
-- be played; otherwise archive (the trigger closes pending challenges).
create or replace function public.archive_team(p_team_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_team public.teams%rowtype;
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if not (public.is_admin() or public.is_team_captain(p_team_id)) then
    raise exception 'rivals:captain_only' using errcode = '42501';
  end if;
  if v_team.archived_at is not null then
    return jsonb_build_object('team_id', p_team_id, 'archived_at', v_team.archived_at);
  end if;
  if exists (select 1 from public.team_matches
              where (home_team_id = p_team_id or away_team_id = p_team_id)
                and match_status = 'scheduled' and kickoff_at > now()) then
    raise exception 'rivals:team_has_scheduled_match';
  end if;
  update public.teams set archived_at = now(), updated_at = now() where id = p_team_id;
  update public.team_invites set revoked_at = now() where team_id = p_team_id and revoked_at is null;
  perform public.rivals_audit(p_team_id, 'team_archived', '{}'::jsonb);
  return jsonb_build_object('team_id', p_team_id, 'archived_at', now());
end $$;

-- ── 8. Challenge RPCs ────────────────────────────────────

-- create_challenge(from, to|null, terms, client_ref)
--   → {challenge_id, token, status, version, expires_at, mode, created}
-- Leader of `from`. to = null → claimable link. Kickoff 3h..180d ahead.
-- One open proposal per pair; ≤10 pending proposals per team. Idempotent
-- on (caller, client_ref): a retried tap returns the same challenge.
create or replace function public.create_challenge(p_from_team uuid, p_to_team uuid, p_terms jsonb,
                                                   p_client_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_from  public.teams%rowtype;
  v_to    public.teams%rowtype;
  v_ch    public.team_challenges%rowtype;
  v_terms jsonb;
  v_kick  timestamptz;
  v_n     int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_client_ref is not null then
    if p_client_ref !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'rivals:invalid_field' using detail = 'client_ref'; end if;
    select * into v_ch from public.team_challenges where created_by = v_pid and client_ref = p_client_ref;
    if found then
      return jsonb_build_object('challenge_id', v_ch.id, 'token', v_ch.invite_token, 'status', v_ch.status,
        'version', v_ch.current_version, 'expires_at', v_ch.expires_at, 'mode', v_ch.mode, 'created', false);
    end if;
  end if;

  -- Lock the challenger team: serialises the pending count + pair check.
  select * into v_from from public.teams where id = p_from_team for update;
  if not found then raise exception 'rivals:team_not_found'; end if;
  if v_from.archived_at is not null then raise exception 'rivals:team_archived'; end if;
  if not public.is_team_leader(p_from_team) then raise exception 'rivals:not_team_leader' using errcode = '42501'; end if;

  if p_to_team is not null then
    if p_to_team = p_from_team then raise exception 'rivals:invalid_opponent'; end if;
    select * into v_to from public.teams where id = p_to_team;
    if not found then raise exception 'rivals:team_not_found'; end if;
    if v_to.archived_at is not null then raise exception 'rivals:invalid_opponent'; end if;
  end if;

  v_terms := public.rivals_norm_terms(coalesce(p_terms, '{}'::jsonb),
    jsonb_build_object('timezone', v_from.timezone, 'currency', v_from.currency,
                       'format', coalesce(v_from.preferred_format, '7v7'), 'duration_min', 60,
                       'field_responsible', 'challenger', 'cost_split', 'split',
                       'venue_name', v_from.home_venue));
  v_kick := public.rivals_check_kickoff(v_terms);

  perform public.rivals_expire_due(p_from_team);
  if p_to_team is not null then perform public.rivals_expire_due(p_to_team); end if;

  select count(*) into v_n from public.team_challenges where challenger_team_id = p_from_team and status = 'pending';
  if v_n >= 10 then raise exception 'rivals:too_many_pending'; end if;
  if p_to_team is not null and exists (
    select 1 from public.team_challenges
     where status = 'pending'
       and ((challenger_team_id = p_from_team and challenged_team_id = p_to_team)
         or (challenger_team_id = p_to_team and challenged_team_id = p_from_team))) then
    raise exception 'rivals:pair_open_challenge';
  end if;

  begin
    insert into public.team_challenges (challenger_team_id, challenged_team_id, mode, status, current_version,
                                        turn_team_id, expires_at, created_by, client_ref)
    values (p_from_team, p_to_team, case when p_to_team is null then 'claimable' else 'directed' end, 'pending', 1,
            p_to_team, public.rivals_deadline(v_kick), v_pid, p_client_ref)
    returning * into v_ch;
  exception when unique_violation then
    -- a concurrent create: same client_ref → that one; else the pair index
    select * into v_ch from public.team_challenges where created_by = v_pid and client_ref = p_client_ref;
    if found then
      return jsonb_build_object('challenge_id', v_ch.id, 'token', v_ch.invite_token, 'status', v_ch.status,
        'version', v_ch.current_version, 'expires_at', v_ch.expires_at, 'mode', v_ch.mode, 'created', false);
    end if;
    raise exception 'rivals:pair_open_challenge';
  end;
  perform public.rivals_insert_version(v_ch.id, 1, 'proposal', p_from_team, v_terms);
  perform public.rivals_audit_challenge(p_from_team, v_ch.id, null, 'challenge_created',
    jsonb_build_object('mode', v_ch.mode, 'to_team', p_to_team, 'kickoff_at', v_terms->'kickoff_at'));
  return jsonb_build_object('challenge_id', v_ch.id, 'token', v_ch.invite_token, 'status', v_ch.status,
    'version', 1, 'expires_at', v_ch.expires_at, 'mode', v_ch.mode, 'created', true);
end $$;

-- respond_challenge(id, version, 'accept'|'decline', as_team, token, reason)
--   → {challenge_id, status, match_id, already_agreed}
-- Only a leader of the team whose turn it is; only the CURRENT version
-- (rivals:stale_version otherwise); the proposer can never accept its own
-- version. An unclaimed claimable link is claimed here (token + as_team)
-- under the row lock, so only one team ever gets it. Accept creates the
-- ONE shared match (field unconfirmed); repeating the accept of the same
-- version returns that same match (already_agreed = true).
create or replace function public.respond_challenge(p_challenge_id uuid, p_version int, p_action text,
                                                    p_as_team uuid default null, p_token text default null,
                                                    p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  ch       public.team_challenges%rowtype;
  ver      public.team_challenge_versions%rowtype;
  v_team   uuid;
  v_match  uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_acc    int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_action not in ('accept','decline') then raise exception 'rivals:invalid_action'; end if;
  if char_length(coalesce(v_reason, '')) > 280 then raise exception 'rivals:reason_too_long'; end if;

  select * into ch from public.team_challenges where id = p_challenge_id for update;
  if not found then raise exception 'rivals:challenge_not_found'; end if;

  -- Idempotent accept: the accepted version again → the same match.
  if ch.status = 'agreed' and p_action = 'accept' then
    select version into v_acc from public.team_challenge_versions
     where challenge_id = ch.id and outcome = 'accepted' and kind <> 'change' limit 1;
    if (public.is_team_leader(ch.challenger_team_id) or public.is_team_leader(ch.challenged_team_id))
       and p_version = v_acc then
      select id into v_match from public.team_matches where challenge_id = ch.id;
      return jsonb_build_object('challenge_id', ch.id, 'status', 'agreed', 'match_id', v_match, 'already_agreed', true);
    end if;
    if ch.mode = 'claimable'
       and not (public.is_team_leader(ch.challenger_team_id) or public.is_team_leader(ch.challenged_team_id)) then
      raise exception 'rivals:challenge_claimed';
    end if;
    raise exception 'rivals:stale_version';
  end if;
  if ch.status = 'pending' and ch.expires_at <= now() then raise exception 'rivals:challenge_expired'; end if;
  if ch.status <> 'pending' then raise exception 'rivals:challenge_%', ch.status; end if;
  if p_version is distinct from ch.current_version then raise exception 'rivals:stale_version'; end if;

  if ch.mode = 'claimable' and ch.challenged_team_id is null then
    if p_action = 'decline' then raise exception 'rivals:not_your_turn'; end if;
    ch := public.rivals_claim(ch, p_as_team, p_token);
    v_team := p_as_team;
  else
    if ch.mode = 'claimable' and p_token is not null
       and not (public.is_team_leader(ch.challenger_team_id) or public.is_team_leader(ch.challenged_team_id)) then
      raise exception 'rivals:challenge_claimed';
    end if;
    v_team := public.rivals_acting_team(ch, p_as_team);
  end if;
  if ch.turn_team_id is distinct from v_team then raise exception 'rivals:not_your_turn'; end if;

  select * into ver from public.team_challenge_versions where challenge_id = ch.id and version = ch.current_version;
  if ver.proposed_by_team_id = v_team then raise exception 'rivals:cannot_accept_own'; end if;
  if exists (select 1 from public.teams where id = v_team and archived_at is not null) then raise exception 'rivals:team_archived'; end if;

  if p_action = 'decline' then
    update public.team_challenges
       set status = 'declined', turn_team_id = null, decided_by_team_id = v_team, decided_by_player_id = v_pid,
           decided_at = now(), reason = v_reason, updated_at = now()
     where id = ch.id;
    update public.team_challenge_versions set outcome = 'declined', responded_by_player_id = v_pid, responded_at = now()
     where challenge_id = ch.id and version = ch.current_version;
    perform public.rivals_audit_challenge(v_team, ch.id, null, 'challenge_declined',
      jsonb_build_object('version', ch.current_version, 'reason', v_reason));
    return jsonb_build_object('challenge_id', ch.id, 'status', 'declined', 'match_id', null, 'already_agreed', false);
  end if;

  update public.team_challenges
     set status = 'agreed', turn_team_id = null, decided_by_team_id = v_team, decided_by_player_id = v_pid,
         decided_at = now(), updated_at = now()
   where id = ch.id;
  update public.team_challenge_versions set outcome = 'accepted', responded_by_player_id = v_pid, responded_at = now()
   where challenge_id = ch.id and version = ch.current_version;
  insert into public.team_matches (challenge_id, home_team_id, away_team_id, agreed_version,
                                   kickoff_at, timezone, format, duration_min, venue_name, venue_address, venue_url,
                                   field_responsible, cost_cents, currency, cost_split, note)
  values (ch.id, ch.challenger_team_id, ch.challenged_team_id, ver.version,
          ver.kickoff_at, ver.timezone, ver.format, ver.duration_min, ver.venue_name, ver.venue_address, ver.venue_url,
          ver.field_responsible, ver.cost_cents, ver.currency, ver.cost_split, ver.note)
  on conflict (challenge_id) do nothing
  returning id into v_match;
  if v_match is null then select id into v_match from public.team_matches where challenge_id = ch.id; end if;
  perform public.rivals_audit_challenge(v_team, ch.id, v_match, 'challenge_accepted', jsonb_build_object('version', ver.version));
  return jsonb_build_object('challenge_id', ch.id, 'status', 'agreed', 'match_id', v_match, 'already_agreed', false);
end $$;

-- counter_challenge(id, base_version, terms, as_team, token)
--   → {challenge_id, version, status, turn_team_id, expires_at}
-- The turn team's leader answers with new terms (only the changed keys
-- are needed). Flips the turn, resets the deadline, marks the previous
-- version 'countered'. No-op counters are refused (rivals:no_changes).
create or replace function public.counter_challenge(p_challenge_id uuid, p_base_version int, p_terms jsonb,
                                                    p_as_team uuid default null, p_token text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  ch      public.team_challenges%rowtype;
  ver     public.team_challenge_versions%rowtype;
  v_team  uuid;
  v_other uuid;
  v_base  jsonb;
  v_terms jsonb;
  v_kick  timestamptz;
  v_new   int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select * into ch from public.team_challenges where id = p_challenge_id for update;
  if not found then raise exception 'rivals:challenge_not_found'; end if;
  if ch.status = 'pending' and ch.expires_at <= now() then raise exception 'rivals:challenge_expired'; end if;
  if ch.status <> 'pending' then raise exception 'rivals:challenge_%', ch.status; end if;
  if p_base_version is distinct from ch.current_version then raise exception 'rivals:stale_version'; end if;
  if ch.current_version >= 20 then raise exception 'rivals:too_many_versions'; end if;

  select * into ver from public.team_challenge_versions where challenge_id = ch.id and version = ch.current_version;
  v_base := public.rivals_version_terms(ver);
  v_terms := public.rivals_norm_terms(coalesce(p_terms, '{}'::jsonb), v_base);
  v_kick := public.rivals_check_kickoff(v_terms);
  if v_terms = v_base then raise exception 'rivals:no_changes'; end if;

  if ch.mode = 'claimable' and ch.challenged_team_id is null then
    ch := public.rivals_claim(ch, p_as_team, p_token);
    v_team := p_as_team;
  else
    v_team := public.rivals_acting_team(ch, p_as_team);
  end if;
  if ch.turn_team_id is distinct from v_team then raise exception 'rivals:not_your_turn'; end if;
  if exists (select 1 from public.teams where id = v_team and archived_at is not null) then raise exception 'rivals:team_archived'; end if;

  v_other := case when v_team = ch.challenger_team_id then ch.challenged_team_id else ch.challenger_team_id end;
  v_new := ch.current_version + 1;
  update public.team_challenge_versions set outcome = 'countered', responded_by_player_id = v_pid, responded_at = now()
   where challenge_id = ch.id and version = ch.current_version;
  perform public.rivals_insert_version(ch.id, v_new, 'counter', v_team, v_terms);
  update public.team_challenges
     set current_version = v_new, turn_team_id = v_other, expires_at = public.rivals_deadline(v_kick), updated_at = now()
   where id = ch.id
   returning * into ch;
  perform public.rivals_audit_challenge(v_team, ch.id, null, 'challenge_countered',
    jsonb_build_object('version', v_new, 'changed', public.rivals_changed_keys(v_base, v_terms)));
  return jsonb_build_object('challenge_id', ch.id, 'version', v_new, 'status', ch.status,
                            'turn_team_id', ch.turn_team_id, 'expires_at', ch.expires_at);
end $$;

-- cancel_challenge(id, reason) → {challenge_id, status, match_id, match_status}
-- Either team's leader. Pending → 'cancelled'. Agreed → the match is
-- cancelled (before kickoff; afterwards PR6's "not played" applies).
-- Who cancelled + optional reason are kept. NEVER a loss: result_status
-- stays 'none'. Repeating it is a no-op.
create or replace function public.cancel_challenge(p_challenge_id uuid, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  ch       public.team_challenges%rowtype;
  m        public.team_matches%rowtype;
  v_team   uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if char_length(coalesce(v_reason, '')) > 280 then raise exception 'rivals:reason_too_long'; end if;
  select * into ch from public.team_challenges where id = p_challenge_id for update;
  if not found then raise exception 'rivals:challenge_not_found'; end if;
  if public.is_team_leader(ch.challenger_team_id) then v_team := ch.challenger_team_id;
  elsif ch.challenged_team_id is not null and public.is_team_leader(ch.challenged_team_id) then v_team := ch.challenged_team_id;
  else raise exception 'rivals:not_team_leader' using errcode = '42501';
  end if;

  if ch.status = 'cancelled' then
    return jsonb_build_object('challenge_id', ch.id, 'status', 'cancelled', 'match_id', null, 'match_status', null);
  end if;

  if ch.status = 'pending' then
    if ch.expires_at <= now() then raise exception 'rivals:challenge_expired'; end if;
    update public.team_challenges
       set status = 'cancelled', turn_team_id = null, decided_by_team_id = v_team, decided_by_player_id = v_pid,
           decided_at = now(), reason = v_reason, updated_at = now()
     where id = ch.id;
    update public.team_challenge_versions set outcome = 'cancelled', responded_by_player_id = v_pid, responded_at = now()
     where challenge_id = ch.id and version = ch.current_version and outcome is null;
    perform public.rivals_audit_challenge(v_team, ch.id, null, 'challenge_cancelled', jsonb_build_object('reason', v_reason));
    return jsonb_build_object('challenge_id', ch.id, 'status', 'cancelled', 'match_id', null, 'match_status', null);
  end if;

  if ch.status <> 'agreed' then raise exception 'rivals:challenge_%', ch.status; end if;
  select * into m from public.team_matches where challenge_id = ch.id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  if m.match_status = 'cancelled' then
    return jsonb_build_object('challenge_id', ch.id, 'status', ch.status, 'match_id', m.id, 'match_status', 'cancelled');
  end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  if m.kickoff_at <= now() then raise exception 'rivals:match_started'; end if;

  update public.team_matches
     set match_status = 'cancelled', cancelled_by_team_id = v_team, cancelled_by_player_id = v_pid,
         cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
   where id = m.id;
  if ch.pending_change_version is not null then
    update public.team_challenge_versions set outcome = 'cancelled', responded_by_player_id = v_pid, responded_at = now()
     where challenge_id = ch.id and version = ch.pending_change_version and outcome is null;
    update public.team_challenges set pending_change_version = null, turn_team_id = null, updated_at = now() where id = ch.id;
  else
    update public.team_challenges set updated_at = now() where id = ch.id;
  end if;
  perform public.rivals_audit_challenge(v_team, ch.id, m.id, 'match_cancelled',
    jsonb_build_object('reason', v_reason, 'late', m.kickoff_at - now() < interval '24 hours'));
  return jsonb_build_object('challenge_id', ch.id, 'status', ch.status, 'match_id', m.id, 'match_status', 'cancelled');
end $$;

-- propose_match_change(match, base_version, terms, as_team)
--   → {match_id, challenge_id, version, expires_at}
-- After the agreement, a material change needs the other team's consent:
-- a 'change' version that leaves the match untouched until accepted. One
-- open change at a time; deadline min(now + 24h, earliest kickoff − 2h).
create or replace function public.propose_match_change(p_match_id uuid, p_base_version int, p_terms jsonb,
                                                       p_as_team uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  v_cid    uuid;
  ch       public.team_challenges%rowtype;
  m        public.team_matches%rowtype;
  v_team   uuid;
  v_other  uuid;
  v_base   jsonb;
  v_terms  jsonb;
  v_kick   timestamptz;
  v_dead   timestamptz;
  v_new    int;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  select challenge_id into v_cid from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  select * into ch from public.team_challenges where id = v_cid for update;
  select * into m from public.team_matches where id = p_match_id for update;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  if m.kickoff_at <= now() then raise exception 'rivals:match_started'; end if;
  if ch.pending_change_version is not null then
    if ch.expires_at > now() then raise exception 'rivals:change_pending'; end if;
    perform public.rivals_expire_due(ch.challenger_team_id);
    select * into ch from public.team_challenges where id = v_cid;
  end if;
  if p_base_version is distinct from ch.current_version then raise exception 'rivals:stale_version'; end if;
  if ch.current_version >= 20 then raise exception 'rivals:too_many_versions'; end if;
  v_team := public.rivals_acting_team(ch, p_as_team);

  v_base := public.rivals_match_terms(m);
  v_terms := public.rivals_norm_terms(coalesce(p_terms, '{}'::jsonb), v_base);
  v_kick := public.rivals_check_kickoff(v_terms);
  if v_terms = v_base then raise exception 'rivals:no_changes'; end if;
  v_dead := least(now() + interval '24 hours', least(m.kickoff_at, v_kick) - interval '2 hours');
  if v_dead <= now() then raise exception 'rivals:too_late_to_change'; end if;

  v_other := case when v_team = ch.challenger_team_id then ch.challenged_team_id else ch.challenger_team_id end;
  v_new := ch.current_version + 1;
  perform public.rivals_insert_version(ch.id, v_new, 'change', v_team, v_terms);
  update public.team_challenges
     set current_version = v_new, pending_change_version = v_new, turn_team_id = v_other, expires_at = v_dead, updated_at = now()
   where id = ch.id;
  perform public.rivals_audit_challenge(v_team, ch.id, m.id, 'match_change_proposed',
    jsonb_build_object('version', v_new, 'changed', public.rivals_changed_keys(v_base, v_terms)));
  return jsonb_build_object('match_id', m.id, 'challenge_id', ch.id, 'version', v_new, 'expires_at', v_dead);
end $$;

-- respond_match_change(match, version, 'accept'|'decline', as_team)
--   → {match_id, version, accepted, field_status}
-- The other team's leader. Accept rewrites the match terms; a new
-- kickoff or venue puts the field back to 'unconfirmed'.
create or replace function public.respond_match_change(p_match_id uuid, p_version int, p_action text,
                                                       p_as_team uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_cid   uuid;
  ch      public.team_challenges%rowtype;
  m       public.team_matches%rowtype;
  ver     public.team_challenge_versions%rowtype;
  v_team  uuid;
  v_reset boolean;
  v_field text;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_action not in ('accept','decline') then raise exception 'rivals:invalid_action'; end if;
  select challenge_id into v_cid from public.team_matches where id = p_match_id;
  if not found then raise exception 'rivals:match_not_found'; end if;
  select * into ch from public.team_challenges where id = v_cid for update;
  select * into m from public.team_matches where id = p_match_id for update;

  if ch.pending_change_version is null then
    select * into ver from public.team_challenge_versions where challenge_id = ch.id and version = p_version;
    if found and ver.kind = 'change' and ver.outcome = 'accepted' and p_action = 'accept' then
      return jsonb_build_object('match_id', m.id, 'version', p_version, 'accepted', true, 'field_status', m.field_status, 'already', true);
    end if;
    raise exception 'rivals:no_pending_change';
  end if;
  if p_version is distinct from ch.pending_change_version then raise exception 'rivals:stale_version'; end if;
  if ch.expires_at <= now() then raise exception 'rivals:change_expired'; end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  v_team := public.rivals_acting_team(ch, p_as_team);
  if ch.turn_team_id is distinct from v_team then raise exception 'rivals:not_your_turn'; end if;

  select * into ver from public.team_challenge_versions where challenge_id = ch.id and version = p_version;
  if ver.proposed_by_team_id = v_team then raise exception 'rivals:cannot_accept_own'; end if;

  v_field := m.field_status;
  if p_action = 'accept' then
    v_reset := ver.kickoff_at is distinct from m.kickoff_at or ver.venue_name is distinct from m.venue_name
            or ver.venue_address is distinct from m.venue_address;
    v_field := case when v_reset then 'unconfirmed' else m.field_status end;
    update public.team_matches set
      agreed_version = ver.version, kickoff_at = ver.kickoff_at, timezone = ver.timezone, format = ver.format,
      duration_min = ver.duration_min, venue_name = ver.venue_name, venue_address = ver.venue_address,
      venue_url = ver.venue_url, field_responsible = ver.field_responsible, cost_cents = ver.cost_cents,
      currency = ver.currency, cost_split = ver.cost_split, note = ver.note,
      field_status = v_field,
      field_note = case when v_reset then null else field_note end,
      field_status_by = case when v_reset then null else field_status_by end,
      field_status_at = case when v_reset then null else field_status_at end,
      updated_at = now()
    where id = m.id;
  end if;
  update public.team_challenge_versions
     set outcome = case when p_action = 'accept' then 'accepted' else 'declined' end,
         responded_by_player_id = v_pid, responded_at = now()
   where challenge_id = ch.id and version = p_version;
  update public.team_challenges set pending_change_version = null, turn_team_id = null, updated_at = now() where id = ch.id;
  perform public.rivals_audit_challenge(v_team, ch.id, m.id,
    case when p_action = 'accept' then 'match_change_accepted' else 'match_change_declined' end,
    jsonb_build_object('version', p_version, 'field_reset', coalesce(v_reset, false)));
  return jsonb_build_object('match_id', m.id, 'version', p_version, 'accepted', p_action = 'accept', 'field_status', v_field);
end $$;

-- set_field_status(match, 'unconfirmed'|'confirmed'|'unavailable', note)
--   → {match_id, field_status}
-- Only a leader of the team responsible for the pitch (field_responsible).
create or replace function public.set_field_status(p_match_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  m      public.team_matches%rowtype;
  v_resp uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if public.my_player_id() is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  if p_status not in ('unconfirmed','confirmed','unavailable') then raise exception 'rivals:invalid_field_status'; end if;
  if char_length(coalesce(v_note, '')) > 280 then raise exception 'rivals:note_too_long'; end if;
  select * into m from public.team_matches where id = p_match_id for update;
  if not found then raise exception 'rivals:match_not_found'; end if;
  v_resp := case when m.field_responsible = 'challenger' then m.home_team_id else m.away_team_id end;
  if not (public.is_team_leader(v_resp) or public.is_admin()) then
    raise exception 'rivals:not_field_responsible' using errcode = '42501';
  end if;
  if m.match_status <> 'scheduled' then raise exception 'rivals:match_not_scheduled'; end if;
  update public.team_matches
     set field_status = p_status, field_note = v_note, field_status_by = public.my_player_id(),
         field_status_at = now(), updated_at = now()
   where id = m.id;
  perform public.rivals_audit_challenge(v_resp, m.challenge_id, m.id, 'field_status_set',
    jsonb_build_object('from', m.field_status, 'to', p_status));
  return jsonb_build_object('match_id', m.id, 'field_status', p_status);
end $$;

-- ── 9. Reads ─────────────────────────────────────────────

-- get_challenge_invite(token) — anon OK. What a ?desafio=<token> link is,
-- before anything happens: {status, mode, claimed, challenge_id,
-- current_version, expires_at, turn_team_id, kind, challenger, challenged,
-- terms, invited_by, match_id, viewer{logged_in, side, role, has_team,
-- eligible_teams[]}}. status (effective): pending | agreed | declined |
-- cancelled | expired | claimed (a claimable link taken by another team,
-- seen from outside) | not_found. Never returns rosters.
create or replace function public.get_challenge_invite(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid    uuid := public.my_player_id();
  ch       public.team_challenges%rowtype;
  ver      public.team_challenge_versions%rowtype;
  v_status text;
  v_side   text;
  v_role   text;
  v_elig   jsonb := '[]'::jsonb;
  v_match  uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then return jsonb_build_object('status', 'not_found'); end if;
  select * into ch from public.team_challenges where invite_token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into ver from public.team_challenge_versions where challenge_id = ch.id and version = ch.current_version;

  if v_pid is not null then
    v_role := public.team_role(ch.challenger_team_id);
    if v_role is not null then v_side := 'challenger';
    elsif ch.challenged_team_id is not null then
      v_role := public.team_role(ch.challenged_team_id);
      if v_role is not null then v_side := 'challenged'; end if;
    end if;
  end if;

  v_status := case
    when ch.status = 'pending' and ch.expires_at <= now() then 'expired'
    when ch.mode = 'claimable' and ch.challenged_team_id is not null and v_side is null then 'claimed'
    else ch.status end;

  if v_pid is not null and v_status = 'pending' then
    if ch.mode = 'claimable' and ch.challenged_team_id is null then
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color,
                                  'secondary_color', t.secondary_color, 'logo_url', t.logo_url, 'role', m.role) order by m.joined_at), '[]'::jsonb)
        into v_elig
        from public.team_members m join public.teams t on t.id = m.team_id
       where m.player_id = v_pid and m.status = 'active' and m.role in ('captain','vice')
         and t.archived_at is null and t.id <> ch.challenger_team_id;
    elsif v_side = 'challenged' and v_role in ('captain','vice') then
      select jsonb_build_array(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'color', t.color,
               'secondary_color', t.secondary_color, 'logo_url', t.logo_url, 'role', v_role))
        into v_elig from public.teams t where t.id = ch.challenged_team_id;
    end if;
  end if;
  if ch.status = 'agreed' and v_side is not null then
    select id into v_match from public.team_matches where challenge_id = ch.id;
  end if;

  return jsonb_build_object(
    'status', v_status, 'mode', ch.mode, 'claimed', ch.challenged_team_id is not null,
    'challenge_id', ch.id, 'current_version', ch.current_version, 'expires_at', ch.expires_at,
    'turn_team_id', ch.turn_team_id, 'kind', ver.kind,
    'challenger', public.rivals_team_card(ch.challenger_team_id),
    'challenged', case when ch.challenged_team_id is null then null else public.rivals_team_card(ch.challenged_team_id) end,
    'terms', public.rivals_version_terms(ver),
    'invited_by', (select coalesce(nullif(p.nick, ''), split_part(p.name, ' ', 1)) from public.players p where p.id = ch.created_by),
    'match_id', v_match,
    'viewer', jsonb_build_object(
      'logged_in', v_pid is not null, 'side', v_side, 'role', v_role,
      'has_team', v_pid is not null and exists (select 1 from public.team_members m join public.teams t on t.id = m.team_id
                                                where m.player_id = v_pid and m.status = 'active' and t.archived_at is null),
      'eligible_teams', v_elig));
end $$;

-- my_challenges() → {items:[…]} — every challenge of every team I'm an
-- active member of (newest activity first, ≤200), with both team cards,
-- the full version history, the match (if any) and my side/role. The
-- invite token is only returned to the challenger's members.
create or replace function public.my_challenges()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pid   uuid := public.my_player_id();
  v_items jsonb;
begin
  if v_pid is null then raise exception 'rivals:not_authenticated' using errcode = '42501'; end if;
  with mine as (
    select m.team_id, m.role from public.team_members m join public.teams t on t.id = m.team_id
     where m.player_id = v_pid and m.status = 'active'
  ), chs as (
    select ch.*,
           case when exists (select 1 from mine where team_id = ch.turn_team_id) then ch.turn_team_id
                when exists (select 1 from mine where team_id = ch.challenger_team_id) then ch.challenger_team_id
                else ch.challenged_team_id end as my_team_id
      from public.team_challenges ch
     where ch.challenger_team_id in (select team_id from mine) or ch.challenged_team_id in (select team_id from mine)
     order by ch.updated_at desc
     limit 200
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'mode', r.mode, 'status', r.status,
    'effective_status', case when r.status = 'pending' and r.expires_at <= now() then 'expired' else r.status end,
    'current_version', r.current_version, 'turn_team_id', r.turn_team_id, 'expires_at', r.expires_at,
    'pending_change_version', r.pending_change_version,
    'invite_token', case when exists (select 1 from mine where team_id = r.challenger_team_id) then r.invite_token end,
    'created_at', r.created_at, 'updated_at', r.updated_at, 'decided_at', r.decided_at,
    'decided_by_team_id', r.decided_by_team_id, 'reason', r.reason, 'rematch_of_match_id', r.rematch_of_match_id,
    'challenger', public.rivals_team_card(r.challenger_team_id),
    'challenged', case when r.challenged_team_id is null then null else public.rivals_team_card(r.challenged_team_id) end,
    'my_team_id', r.my_team_id,
    'my_role', (select role from mine where team_id = r.my_team_id),
    'versions', (select coalesce(jsonb_agg(public.rivals_version_terms(v) || jsonb_build_object(
                    'version', v.version, 'kind', v.kind, 'proposed_by_team_id', v.proposed_by_team_id,
                    'outcome', v.outcome, 'responded_at', v.responded_at, 'created_at', v.created_at) order by v.version), '[]'::jsonb)
                   from public.team_challenge_versions v where v.challenge_id = r.id),
    'match', (select public.rivals_match_terms(m) || jsonb_build_object(
                'id', m.id, 'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id,
                'agreed_version', m.agreed_version, 'match_status', m.match_status,
                'field_status', m.field_status, 'field_note', m.field_note, 'field_status_at', m.field_status_at,
                'result_status', m.result_status, 'official_home_score', m.official_home_score,
                'official_away_score', m.official_away_score,
                'cancelled_by_team_id', m.cancelled_by_team_id, 'cancelled_at', m.cancelled_at, 'cancel_reason', m.cancel_reason)
                from public.team_matches m where m.challenge_id = r.id)
  ) order by r.updated_at desc), '[]'::jsonb)
  into v_items
  from chs r;
  return jsonb_build_object('items', v_items);
end $$;

-- ── 10. Hourly expiry (pg_cron) ──────────────────────────
select cron.unschedule('pitch-rivals-expire')
  where exists (select 1 from cron.job where jobname = 'pitch-rivals-expire');
select cron.schedule('pitch-rivals-expire', '15 * * * *', 'select public.expire_rivals()');

-- ── 11. EXECUTE grants ───────────────────────────────────
do $$
declare f text;
begin
  -- RLS helper: signed-in users (policies run as the caller).
  execute 'revoke execute on function public.can_see_challenge(uuid) from public, anon';
  execute 'grant execute on function public.can_see_challenge(uuid) to authenticated, service_role';
  -- App RPCs: signed-in users only.
  foreach f in array array[
    'public.create_challenge(uuid, uuid, jsonb, text)',
    'public.respond_challenge(uuid, int, text, uuid, text, text)',
    'public.counter_challenge(uuid, int, jsonb, uuid, text)',
    'public.cancel_challenge(uuid, text)',
    'public.propose_match_change(uuid, int, jsonb, uuid)',
    'public.respond_match_change(uuid, int, text, uuid)',
    'public.set_field_status(uuid, text, text)',
    'public.my_challenges()',
    'public.archive_team(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  -- Preview: also anonymous (logged-out ?desafio= page, OG function).
  execute 'revoke execute on function public.get_challenge_invite(text) from public';
  execute 'grant execute on function public.get_challenge_invite(text) to anon, authenticated, service_role';
  -- Internal only (cron / RPC plumbing / trigger).
  foreach f in array array[
    'public.expire_rivals()', 'public.rivals_expire_due(uuid)',
    'public.rivals_audit_challenge(uuid, uuid, uuid, text, jsonb)', 'public.rivals_deadline(timestamptz)',
    'public.rivals_version_terms(public.team_challenge_versions)', 'public.rivals_match_terms(public.team_matches)',
    'public.rivals_norm_terms(jsonb, jsonb)', 'public.rivals_check_kickoff(jsonb)', 'public.rivals_changed_keys(jsonb, jsonb)',
    'public.rivals_insert_version(uuid, int, text, uuid, jsonb)',
    'public.rivals_acting_team(public.team_challenges, uuid)',
    'public.rivals_claim(public.team_challenges, uuid, text)', 'public.rivals_team_card(uuid)',
    'public.rivals_on_team_archived()', 'public.rivals_versions_immutable()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
