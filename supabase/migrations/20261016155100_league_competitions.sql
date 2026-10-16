-- ─────────────────────────────────────────────────────────
-- PITCH Ligas Fase 2 — migration L2a (design plan PR L2): seasons, categories, competitions
-- (editions) and the versioned regulation.
--
-- Source: docs/ligas-draft-sql/02_competitions_regulation.sql. Depends on 01.
-- Plan: docs/LIGAS-FASE2-PLAN.md §3.2, §3.3.
--
-- What this does
--   • league_seasons / league_categories   reusable per league.
--   • competitions             one concrete edition (league × season ×
--                              category). structure: only 'league' (pontos
--                              corridos) can be created in Fase 2 — the
--                              check already lists the future structures so
--                              the column never has to change, but
--                              create_competition refuses them (brief §9: no
--                              selector promising a generator that does not
--                              exist).
--   • competition_regulations  versioned rules (jsonb) — one editable draft
--                              at a time, published versions IMMUTABLE
--                              (trigger). Every homologation (L6) records
--                              the version it applied.
--   • league_validate_rules()  allow-list + defaults. Unknown keys or
--                              unsupported tiebreakers are REFUSED, never
--                              silently ignored (brief §9 "evitar aplicá-los
--                              parcialmente").
--   • can_see_competition()    effective visibility = competition override
--                              or the league's; private never reachable by
--                              id/slug guessing (RPC returns null).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.league_seasons (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),   -- "2026/27", "Verão 2026"
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now(),
  constraint league_seasons_dates_check check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint league_seasons_name_key unique (league_id, name)
);

create table if not exists public.league_categories (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),   -- "Sénior", "Veteranos +35", "Sub-17"
  -- youth = athletes may be minors → restrictive public athlete payloads (plan §5.4).
  youth      boolean not null default false,
  created_at timestamptz not null default now(),
  constraint league_categories_name_key unique (league_id, name)
);

create table if not exists public.competitions (
  id                 uuid primary key default gen_random_uuid(),
  league_id          uuid not null references public.leagues(id) on delete cascade,
  season_id          uuid references public.league_seasons(id) on delete restrict,
  category_id        uuid references public.league_categories(id) on delete restrict,
  slug               text not null,
  name               text not null check (char_length(btrim(name)) between 2 and 80),
  modality           text not null default 'futebol' check (modality in ('futebol','society','futsal')),
  format             text not null default '7v7' check (format in ('5v5','6v6','7v7','8v8','9v9','11v11')),
  match_duration_min int  not null default 50 check (match_duration_min between 20 and 180),
  structure          text not null default 'league' check (structure in ('league','groups','knockout','groups_knockout')),
  status             text not null default 'draft'
                       check (status in ('draft','registration_open','registration_closed','in_progress','finished','archived')),
  visibility         text check (visibility is null or visibility in ('public','unlisted','private')),  -- null = league's
  view_key           text not null default replace(gen_random_uuid()::text, '-', ''),
  timezone           text,                                                -- null = league's
  current_regulation_version int,                                         -- last PUBLISHED version
  registration_deadline timestamptz,
  var_enabled        boolean not null default false,   -- Fase 3 seam; off by default
  fantasy_enabled    boolean not null default false,   -- Fase 4 seam
  created_by         uuid references public.players(id) on delete set null,
  client_ref         text check (client_ref is null or char_length(client_ref) <= 64),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint competitions_slug_key unique (league_id, slug)
);
create index if not exists competitions_league_idx on public.competitions (league_id, created_at desc);
create unique index if not exists competitions_creator_client_ref_key
  on public.competitions (created_by, client_ref) where client_ref is not null;

create table if not exists public.competition_regulations (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  version        int  not null check (version >= 1),
  rules          jsonb not null,
  status         text not null default 'draft' check (status in ('draft','published')),
  change_reason  text check (change_reason is null or char_length(change_reason) <= 500),
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  published_by   uuid references public.players(id) on delete set null,
  published_at   timestamptz,
  primary key (competition_id, version)
);
create unique index if not exists competition_regulations_one_draft_key
  on public.competition_regulations (competition_id) where status = 'draft';

-- Published regulation rows never change (and are never deleted while the
-- competition exists).
create or replace function public.league_regulation_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then raise exception 'league:regulation_immutable'; end if;
    return old;
  end if;
  if old.status = 'published' then raise exception 'league:regulation_immutable'; end if;
  return new;
end $$;
drop trigger if exists competition_regulations_immutable on public.competition_regulations;
create trigger competition_regulations_immutable before update or delete on public.competition_regulations
  for each row execute function public.league_regulation_immutable();

-- FKs that 01 left open.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_members_competition_fkey') then
    alter table public.league_members add constraint league_members_competition_fkey
      foreign key (competition_id) references public.competitions(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'league_invites_competition_fkey') then
    alter table public.league_invites add constraint league_invites_competition_fkey
      foreign key (competition_id) references public.competitions(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'league_audit_log_competition_fkey') then
    alter table public.league_audit_log add constraint league_audit_log_competition_fkey
      foreign key (competition_id) references public.competitions(id) on delete set null;
  end if;
end $$;

-- ── 2. Regulation validation ─────────────────────────────
-- Returns the normalized rules (defaults filled). Refuses unknown keys.
-- Supported tiebreakers in Fase 2 (SQL standings, L6): pts, h2h (points
-- among teams level on points; only directly after pts), gd, gf, wins,
-- ga_fewest. 'lots' is NOT accepted: an absolute tie is shown as a shared
-- position flagged unresolved until the authority records a decision.
create or replace function public.league_validate_rules(p jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  d jsonb := jsonb_build_object(
    'points',      jsonb_build_object('win', 3, 'draw', 1, 'loss', 0),
    'tiebreakers', jsonb_build_array('pts', 'gd', 'gf'),
    'walkover',    jsonb_build_object('winner_score', 3, 'loser_score', 0, 'loser_points', 0),
    'assists',     'optional',
    'discipline',  jsonb_build_object('yellow_threshold', null, 'yellow_suspension', 1,
                                      'red_suspension', 1, 'second_yellow_suspension', 1),
    'homologation', jsonb_build_object('authority', jsonb_build_array('owner', 'manager'),
                                       'team_leaders_can_score', false),
    'dispute_window_hours', 48,
    'squad',       jsonb_build_object('min', 5, 'max', 25),
    'mvp',         jsonb_build_object('official_by', jsonb_build_array('referee', 'manager'), 'fan_vote', false));
  r jsonb := coalesce(p, '{}'::jsonb);
  k text; t text; i int := 0; seen text[] := '{}';
  sub text;
begin
  if jsonb_typeof(r) <> 'object' then raise exception 'league:invalid_rules'; end if;
  for k in select jsonb_object_keys(r) loop
    if not d ? k then raise exception 'league:unsupported_rule' using detail = k; end if;
  end loop;
  -- shallow merge per object section (unknown sub-keys refused too)
  for k in select jsonb_object_keys(d) loop
    if r ? k and jsonb_typeof(d->k) = 'object' then
      if jsonb_typeof(r->k) <> 'object' then raise exception 'league:invalid_rules' using detail = k; end if;
      for sub in select jsonb_object_keys(r->k) loop
        if not (d->k) ? sub then raise exception 'league:unsupported_rule' using detail = k || '.' || sub; end if;
      end loop;
      d := jsonb_set(d, array[k], (d->k) || (r->k));
    elsif r ? k then
      d := jsonb_set(d, array[k], r->k);
    end if;
  end loop;

  -- points
  if (d#>>'{points,win}')::int not between 0 and 10 or (d#>>'{points,draw}')::int not between 0 and 10
     or (d#>>'{points,loss}')::int not between -5 and 5 then raise exception 'league:invalid_points'; end if;
  -- tiebreakers
  if jsonb_typeof(d->'tiebreakers') <> 'array' or jsonb_array_length(d->'tiebreakers') = 0
     or d->'tiebreakers'->>0 <> 'pts' then raise exception 'league:invalid_tiebreakers'; end if;
  for t in select jsonb_array_elements_text(d->'tiebreakers') loop
    if t not in ('pts','h2h','gd','gf','wins','ga_fewest') then raise exception 'league:unsupported_tiebreaker' using detail = t; end if;
    if t = any(seen) then raise exception 'league:invalid_tiebreakers' using detail = 'duplicate ' || t; end if;
    if t = 'h2h' and i <> 1 then raise exception 'league:unsupported_tiebreaker' using detail = 'h2h must follow pts'; end if;
    seen := seen || t; i := i + 1;
  end loop;
  -- walkover
  if (d#>>'{walkover,winner_score}')::int not between 0 and 20 or (d#>>'{walkover,loser_score}')::int not between 0 and 20
     or (d#>>'{walkover,loser_points}')::int not between -10 and 0 then raise exception 'league:invalid_walkover'; end if;
  -- assists
  if d->>'assists' not in ('optional','none') then raise exception 'league:invalid_assists'; end if;
  -- discipline (null threshold = no automatic accumulation rule)
  if d#>'{discipline,yellow_threshold}' <> 'null'::jsonb and (d#>>'{discipline,yellow_threshold}')::int not between 2 and 10 then
    raise exception 'league:invalid_discipline';
  end if;
  if (d#>>'{discipline,yellow_suspension}')::int not between 0 and 10 or (d#>>'{discipline,red_suspension}')::int not between 0 and 10
     or (d#>>'{discipline,second_yellow_suspension}')::int not between 0 and 10 then raise exception 'league:invalid_discipline'; end if;
  -- homologation authority ⊆ {owner, manager, referee}, non-empty
  if jsonb_typeof(d#>'{homologation,authority}') <> 'array' or jsonb_array_length(d#>'{homologation,authority}') = 0
     or exists (select 1 from jsonb_array_elements_text(d#>'{homologation,authority}') a where a not in ('owner','manager','referee')) then
    raise exception 'league:invalid_homologation';
  end if;
  if jsonb_typeof(d#>'{homologation,team_leaders_can_score}') <> 'boolean' then raise exception 'league:invalid_homologation'; end if;
  if (d->>'dispute_window_hours')::int not between 0 and 336 then raise exception 'league:invalid_dispute_window'; end if;
  if (d#>>'{squad,min}')::int not between 1 and 40 or (d#>>'{squad,max}')::int not between (d#>>'{squad,min}')::int and 60 then
    raise exception 'league:invalid_squad_limits';
  end if;
  if exists (select 1 from jsonb_array_elements_text(d#>'{mvp,official_by}') a where a not in ('owner','manager','referee')) then
    raise exception 'league:invalid_mvp';
  end if;
  return d;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'league:invalid_rules';
end $$;

-- Published rules in force for a competition (null before first publish).
create or replace function public.competition_rules(c uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select r.rules from public.competitions x
    join public.competition_regulations r on r.competition_id = x.id and r.version = x.current_regulation_version
   where x.id = c;
$$;

-- ── 3. Visibility helpers ────────────────────────────────
create or replace function public.competition_league(c uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select league_id from public.competitions where id = c;
$$;

-- Effective visibility of a competition.
create or replace function public.competition_visibility(c uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(x.visibility, g.visibility) from public.competitions x join public.leagues g on g.id = x.league_id where x.id = c;
$$;

-- Competition staff = league staff with a league-wide role or a role
-- scoped to this competition.
create or replace function public.is_competition_staff(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.competitions x join public.league_members m on m.league_id = x.league_id
     where x.id = c and m.status = 'active' and m.player_id = public.my_player_id()
       and (m.competition_id is null or m.competition_id = c));
$$;

-- Table-level read (RLS). L3 redefines it to add "member of a registered team".
create or replace function public.can_see_competition(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.competitions x join public.leagues g on g.id = x.league_id
                  where x.id = c and x.status <> 'draft' and g.status <> 'draft'
                    and coalesce(x.visibility, g.visibility) = 'public')
      or public.is_competition_staff(c);
$$;

-- ── 4. RLS ───────────────────────────────────────────────
alter table public.league_seasons          enable row level security;
alter table public.league_categories       enable row level security;
alter table public.competitions            enable row level security;
alter table public.competition_regulations enable row level security;

drop policy if exists "league_seasons select" on public.league_seasons;
create policy "league_seasons select" on public.league_seasons for select to authenticated
  using (public.can_see_league(league_id));
drop policy if exists "league_categories select" on public.league_categories;
create policy "league_categories select" on public.league_categories for select to authenticated
  using (public.can_see_league(league_id));
drop policy if exists "competitions select" on public.competitions;
create policy "competitions select" on public.competitions for select to authenticated
  using (public.can_see_competition(id));
-- Published regulation is public with its competition (brief §7 "informações
-- do regulamento"); drafts only to staff.
drop policy if exists "competition_regulations select" on public.competition_regulations;
create policy "competition_regulations select" on public.competition_regulations for select to authenticated
  using ((status = 'published' and public.can_see_competition(competition_id)) or public.is_competition_staff(competition_id));

-- ── 5. Grants ────────────────────────────────────────────
revoke all on table public.league_seasons, public.league_categories, public.competitions,
                    public.competition_regulations from anon, authenticated;
grant select on table public.league_seasons, public.league_categories, public.competition_regulations to authenticated;
grant select (id, league_id, season_id, category_id, slug, name, modality, format, match_duration_min, structure, status,
              visibility, timezone, current_regulation_version, registration_deadline, var_enabled, fantasy_enabled,
              created_by, created_at, updated_at)            -- view_key / client_ref withheld
  on table public.competitions to authenticated;
grant all on table public.league_seasons, public.league_categories, public.competitions,
                   public.competition_regulations to service_role;

-- ── 6. RPCs ──────────────────────────────────────────────

-- create_season(league, name, starts_on, ends_on) → {season_id}
create or replace function public.create_season(p_league_id uuid, p_name text, p_starts_on date default null, p_ends_on date default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_manager(p_league_id) then raise exception 'league:not_found'; end if;
  insert into public.league_seasons (league_id, name, starts_on, ends_on) values (p_league_id, btrim(p_name), p_starts_on, p_ends_on)
  on conflict (league_id, name) do update set starts_on = coalesce(excluded.starts_on, league_seasons.starts_on)
  returning id into v_id;
  perform public.league_audit(p_league_id, 'season_saved', jsonb_build_object('season_id', v_id));
  return jsonb_build_object('season_id', v_id);
end $$;

-- create_category(league, name, youth) → {category_id}
create or replace function public.create_category(p_league_id uuid, p_name text, p_youth boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_league_manager(p_league_id) then raise exception 'league:not_found'; end if;
  insert into public.league_categories (league_id, name, youth) values (p_league_id, btrim(p_name), coalesce(p_youth, false))
  on conflict (league_id, name) do update set youth = excluded.youth
  returning id into v_id;
  perform public.league_audit(p_league_id, 'category_saved', jsonb_build_object('category_id', v_id, 'youth', p_youth));
  return jsonb_build_object('category_id', v_id);
end $$;

-- create_competition(league, fields, rules, client_ref) → {competition_id, slug, created, regulation_version}
-- League-wide owner/manager only. Starts as draft with regulation v1 DRAFT.
create or replace function public.create_competition(p_league_id uuid, p_fields jsonb, p_rules jsonb default '{}'::jsonb,
                                                     p_client_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  f jsonb := coalesce(p_fields, '{}'::jsonb);
  v_c public.competitions%rowtype;
  v_rules jsonb;
  v_slug text; n int := 1;
begin
  if not public.is_league_manager(p_league_id) then raise exception 'league:not_found'; end if;
  if exists (select 1 from public.leagues where id = p_league_id and status = 'archived') then raise exception 'league:archived'; end if;
  if coalesce(f->>'structure', 'league') <> 'league' then raise exception 'league:structure_not_available'; end if;
  if p_client_ref is not null then
    select * into v_c from public.competitions where created_by = public.my_player_id() and client_ref = p_client_ref;
    if found then return jsonb_build_object('competition_id', v_c.id, 'slug', v_c.slug, 'created', false, 'regulation_version', 1); end if;
  end if;
  if (f ? 'season_id' and not exists (select 1 from public.league_seasons where id = (f->>'season_id')::uuid and league_id = p_league_id))
     or (f ? 'category_id' and not exists (select 1 from public.league_categories where id = (f->>'category_id')::uuid and league_id = p_league_id)) then
    raise exception 'league:wrong_league';
  end if;
  v_rules := public.league_validate_rules(p_rules);
  v_slug := public.team_slugify(f->>'name');
  while exists (select 1 from public.competitions where league_id = p_league_id and slug = v_slug) loop
    n := n + 1; v_slug := trim(both '-' from left(public.team_slugify(f->>'name'), 35)) || '-' || n;
  end loop;
  insert into public.competitions (league_id, season_id, category_id, slug, name, modality, format, match_duration_min,
                                   structure, visibility, timezone, registration_deadline, created_by, client_ref)
  values (p_league_id, (f->>'season_id')::uuid, (f->>'category_id')::uuid, v_slug, btrim(f->>'name'),
          coalesce(f->>'modality', 'futebol'), coalesce(f->>'format', '7v7'), coalesce((f->>'match_duration_min')::int, 50),
          'league', f->>'visibility', f->>'timezone', (f->>'registration_deadline')::timestamptz, public.my_player_id(), p_client_ref)
  returning * into v_c;
  insert into public.competition_regulations (competition_id, version, rules, status, created_by)
  values (v_c.id, 1, v_rules, 'draft', public.my_player_id());
  perform public.league_audit(p_league_id, 'competition_created', jsonb_build_object('slug', v_slug), v_c.id);
  return jsonb_build_object('competition_id', v_c.id, 'slug', v_c.slug, 'created', true, 'regulation_version', 1);
exception when check_violation or invalid_text_representation then raise exception 'league:invalid_field';
end $$;

-- save_regulation_draft(competition, rules) → {version, rules}
-- Creates the next draft (current published + 1) or replaces the open draft.
create or replace function public.save_regulation_draft(p_competition_id uuid, p_rules jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c public.competitions%rowtype; v_rules jsonb; v_ver int;
begin
  select * into v_c from public.competitions where id = p_competition_id for update;
  if not found or not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  v_rules := public.league_validate_rules(p_rules);
  select version into v_ver from public.competition_regulations where competition_id = v_c.id and status = 'draft';
  if found then
    update public.competition_regulations set rules = v_rules, created_by = public.my_player_id(), created_at = now()
     where competition_id = v_c.id and version = v_ver;
  else
    v_ver := coalesce(v_c.current_regulation_version, 0) + 1;
    insert into public.competition_regulations (competition_id, version, rules, status, created_by)
    values (v_c.id, v_ver, v_rules, 'draft', public.my_player_id());
  end if;
  perform public.league_audit(v_c.league_id, 'regulation_draft_saved', jsonb_build_object('version', v_ver), v_c.id);
  return jsonb_build_object('version', v_ver, 'rules', v_rules);
end $$;

-- publish_regulation(competition, version, reason) → {version}
-- A reason is mandatory from v2 on (auditable rule change mid-season).
create or replace function public.publish_regulation(p_competition_id uuid, p_version int, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c public.competitions%rowtype;
begin
  select * into v_c from public.competitions where id = p_competition_id for update;
  if not found or not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  if not exists (select 1 from public.competition_regulations where competition_id = v_c.id and version = p_version and status = 'draft') then
    raise exception 'league:no_such_draft';
  end if;
  if p_version > 1 and coalesce(btrim(p_reason), '') = '' then raise exception 'league:reason_required'; end if;
  update public.competition_regulations
     set status = 'published', published_by = public.my_player_id(), published_at = now(), change_reason = left(p_reason, 500)
   where competition_id = v_c.id and version = p_version;
  update public.competitions set current_regulation_version = p_version, updated_at = now() where id = v_c.id;
  perform public.league_audit(v_c.league_id, 'regulation_published', jsonb_build_object('version', p_version, 'reason', p_reason), v_c.id);
  return jsonb_build_object('version', p_version);
end $$;

-- set_competition_status(competition, status) → {status}
-- Allowed: draft→registration_open (needs a published regulation and a
-- non-draft league) → registration_closed → in_progress → finished → archived;
-- registration_closed→registration_open (reopen). Anything else refused.
create or replace function public.set_competition_status(p_competition_id uuid, p_status text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c public.competitions%rowtype; ok boolean;
begin
  select * into v_c from public.competitions where id = p_competition_id for update;
  if not found or not public.is_league_manager(v_c.league_id, v_c.id) then raise exception 'league:not_found'; end if;
  if v_c.status = p_status then return jsonb_build_object('status', p_status, 'unchanged', true); end if;
  ok := (v_c.status, p_status) in (('draft','registration_open'), ('registration_open','registration_closed'),
                                   ('registration_closed','registration_open'), ('registration_closed','in_progress'),
                                   ('in_progress','finished'), ('finished','archived'), ('draft','archived'));
  if not ok then raise exception 'league:invalid_transition'; end if;
  if p_status = 'registration_open' and v_c.current_regulation_version is null then raise exception 'league:regulation_not_published'; end if;
  if p_status = 'registration_open' then
    update public.leagues set status = 'active', updated_at = now() where id = v_c.league_id and status = 'draft';
  end if;
  update public.competitions set status = p_status, updated_at = now() where id = v_c.id;
  perform public.league_audit(v_c.league_id, 'competition_status', jsonb_build_object('from', v_c.status, 'to', p_status), v_c.id);
  return jsonb_build_object('status', p_status);
end $$;

-- competition_page(league_slug, competition_slug, key) → public payload | null
-- anon + authenticated. Same null-on-hidden rule as league_page.
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
    'id', v_c.id, 'slug', v_c.slug, 'name', v_c.name, 'status', v_c.status, 'structure', v_c.structure,
    'modality', v_c.modality, 'format', v_c.format, 'match_duration_min', v_c.match_duration_min,
    'timezone', coalesce(v_c.timezone, v_g.timezone), 'visibility', v_vis,
    'league', jsonb_build_object('slug', v_g.slug, 'name', v_g.name, 'logo_url', v_g.logo_url, 'color', v_g.color),
    'season', (select jsonb_build_object('name', s.name, 'starts_on', s.starts_on, 'ends_on', s.ends_on) from public.league_seasons s where s.id = v_c.season_id),
    'category', (select jsonb_build_object('name', k.name, 'youth', k.youth) from public.league_categories k where k.id = v_c.category_id),
    'regulation', jsonb_build_object('version', v_c.current_regulation_version, 'rules', public.competition_rules(v_c.id)),
    'var_enabled', v_c.var_enabled, 'fantasy_enabled', v_c.fantasy_enabled,
    'is_staff', v_staff,
    'view_key', case when public.my_player_id() is not null and public.is_league_manager(v_g.id, v_c.id) then v_c.view_key end);
  -- teams[] (L3), rounds/matches (L4), standings (L6) are separate RPCs.
end $$;

-- ── 7. EXECUTE grants ────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.is_competition_staff(uuid)', 'public.can_see_competition(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.create_season(uuid, text, date, date)', 'public.create_category(uuid, text, boolean)',
    'public.create_competition(uuid, jsonb, jsonb, text)', 'public.save_regulation_draft(uuid, jsonb)',
    'public.publish_regulation(uuid, int, text)', 'public.set_competition_status(uuid, text)',
    'public.league_validate_rules(jsonb)'   -- harmless + lets the UI pre-validate
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke execute on function public.competition_page(text, text, text) from public';
  execute 'grant execute on function public.competition_page(text, text, text) to anon, authenticated, service_role';
  foreach f in array array['public.competition_rules(uuid)', 'public.competition_league(uuid)', 'public.competition_visibility(uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── 8. league_page gains competitions[] (integration addition) ──
-- 01's league_page said "competitions[] are appended by L2's redefinition";
-- the draft never did it. A public league page needs its competitions, and
-- anon cannot read the competitions table, so it is projected here with
-- the same visibility rule as competition_page: staff see every
-- competition; everyone else only non-draft ones whose effective
-- visibility is public (unlisted = reachable by slug, never listed), or
-- any non-draft one when the caller presents the league's view_key.
create or replace function public.league_page(p_slug text, p_key text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_lg public.leagues%rowtype; v_staff boolean; v_keyed boolean;
begin
  select * into v_lg from public.leagues where slug = lower(btrim(coalesce(p_slug, '')));
  if not found then return null; end if;
  v_staff := public.my_player_id() is not null and public.is_league_staff(v_lg.id);
  v_keyed := p_key is not null and p_key = v_lg.view_key;
  if not v_staff then
    if v_lg.status = 'draft' then return null; end if;
    if v_lg.visibility = 'private' and not v_keyed then return null; end if;
  end if;
  return jsonb_build_object(
    'id', v_lg.id, 'slug', v_lg.slug, 'name', v_lg.name, 'short_name', v_lg.short_name,
    'description', v_lg.description, 'logo_url', v_lg.logo_url, 'color', v_lg.color,
    'city', v_lg.city, 'region', v_lg.region, 'country', v_lg.country, 'timezone', v_lg.timezone,
    'visibility', v_lg.visibility, 'status', v_lg.status,
    'responsaveis', (select coalesce(jsonb_agg(jsonb_build_object('name', public.league_person_name(m.player_id), 'role', m.role)
                                               order by m.role), '[]'::jsonb)
                       from public.league_members m
                      where m.league_id = v_lg.id and m.status = 'active' and m.role in ('owner','manager') and m.competition_id is null),
    'my_roles', case when v_staff then (select jsonb_agg(distinct m.role) from public.league_members m
                                         where m.league_id = v_lg.id and m.player_id = public.my_player_id() and m.status = 'active')
                     else '[]'::jsonb end,
    'competitions', (select coalesce(jsonb_agg(jsonb_build_object(
                              'id', c.id, 'slug', c.slug, 'name', c.name, 'status', c.status, 'format', c.format,
                              'modality', c.modality, 'visibility', coalesce(c.visibility, v_lg.visibility),
                              'season', (select s.name from public.league_seasons s where s.id = c.season_id),
                              'category', (select k.name from public.league_categories k where k.id = c.category_id))
                            order by c.created_at), '[]'::jsonb)
                       from public.competitions c
                      where c.league_id = v_lg.id
                        and (v_staff or (c.status <> 'draft'
                                         and (coalesce(c.visibility, v_lg.visibility) = 'public' or v_keyed)))),
    'view_key', case when public.is_league_manager(v_lg.id) then v_lg.view_key end);
end $$;
revoke execute on function public.league_page(text, text) from public;
grant execute on function public.league_page(text, text) to anon, authenticated, service_role;

-- ── Comments ─────────────────────────────────────────────
comment on table public.league_seasons is 'PITCH Ligas: seasons of a league ("2026/27").';
comment on table public.league_categories is 'PITCH Ligas: categories of a league ("Sénior", "Sub-17"). youth = true makes every public payload initials-only, no photo.';
comment on table public.competitions is 'PITCH Ligas: one competition edition (league x season x category). Fase 2 creates structure = league only.';
comment on table public.competition_regulations is 'PITCH Ligas: versioned regulation (allow-listed jsonb). One draft at a time; published versions are immutable (trigger).';
