create table public.ai_team_entries (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.ai_team_entries(id),
 kind text not null check (kind in ('message','request','delivery')),
 author text not null check (author in ('vinicius','ney','leo','cris')),
 recipient text not null check (recipient in ('all','vinicius','ney','leo','cris')),
 title text not null check (length(trim(title)) between 1 and 160),
 body text not null check (length(trim(body)) between 1 and 12000),
 status text not null default 'pending' check (status in ('pending','in_progress','done','blocked')),
 created_at timestamptz not null default now()
);
create index ai_team_entries_parent on public.ai_team_entries(parent_id,created_at);
create index ai_team_entries_inbox on public.ai_team_entries(recipient,status,created_at desc);
alter table public.ai_team_entries enable row level security;
revoke all on public.ai_team_entries from anon,authenticated;
grant select,insert,update on public.ai_team_entries to authenticated;
grant all on public.ai_team_entries to service_role;
create policy "team admin read" on public.ai_team_entries for select to authenticated using (public.is_admin());
create policy "team admin publish" on public.ai_team_entries for insert to authenticated with check (public.is_admin() and author='vinicius');
create policy "team admin status" on public.ai_team_entries for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update on public.ai_team_entries from authenticated;
grant update(status) on public.ai_team_entries to authenticated;
