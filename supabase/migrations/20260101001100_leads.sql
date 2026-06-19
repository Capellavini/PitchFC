-- ─────────────────────────────────────────────────────────
-- Migration 12 — lead capture for the PITCH League MVP site (/league)
--
-- Public visitors submit interest via submit_lead() (SECURITY DEFINER,
-- granted to anon — no direct table access). Only admins can read leads.
-- ─────────────────────────────────────────────────────────

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  whatsapp      text,
  email         text,
  city          text,
  role          text,          -- capitão | jogador | empresa | patrocinador | campo
  has_team      boolean,
  team_name     text,
  players_count int,
  modality      text,
  best_day      text,
  best_time     text,
  interest      text[],
  message       text,
  source        text default 'league',
  created_at    timestamptz default now()
);

alter table public.leads enable row level security;

drop policy if exists "leads admin read" on public.leads;
create policy "leads admin read" on public.leads for select using (public.is_admin());

create or replace function public.submit_lead(payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.leads (
    name, whatsapp, email, city, role, has_team, team_name, players_count,
    modality, best_day, best_time, interest, message, source
  ) values (
    nullif(payload->>'name',''),
    nullif(payload->>'whatsapp',''),
    nullif(payload->>'email',''),
    nullif(payload->>'city',''),
    nullif(payload->>'role',''),
    case lower(coalesce(payload->>'has_team','')) when 'true' then true when 'false' then false else null end,
    nullif(payload->>'team_name',''),
    nullif(payload->>'players_count','')::int,
    nullif(payload->>'modality',''),
    nullif(payload->>'best_day',''),
    nullif(payload->>'best_time',''),
    case when payload ? 'interest' then array(select jsonb_array_elements_text(payload->'interest')) else null end,
    nullif(payload->>'message',''),
    coalesce(nullif(payload->>'source',''),'league')
  );
end $$;

grant execute on function public.submit_lead(jsonb) to anon, authenticated;
