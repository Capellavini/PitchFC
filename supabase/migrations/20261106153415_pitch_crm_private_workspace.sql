-- Private expansion CRM. Initial access: only the account explicitly authorized by the owner.
create table public.crm_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.crm_members enable row level security;
revoke all on public.crm_members from public, anon, authenticated;
grant select on public.crm_members to authenticated;
grant all on public.crm_members to service_role;
create policy crm_members_self_read on public.crm_members for select to authenticated using (user_id = (select auth.uid()));

create table public.crm_state (
 id text primary key check(id='main'),
 leagues jsonb not null default '[]'::jsonb check(jsonb_typeof(leagues)='array' and jsonb_array_length(leagues)<=10000 and octet_length(leagues::text)<=4000000),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.crm_state enable row level security;
revoke all on public.crm_state from public, anon, authenticated;
grant select on public.crm_state to authenticated;
grant update(leagues) on public.crm_state to authenticated;
grant all on public.crm_state to service_role;
create policy crm_state_member_read on public.crm_state for select to authenticated
 using (exists(select 1 from public.crm_members where user_id=(select auth.uid())));
create policy crm_state_member_update on public.crm_state for update to authenticated
 using (exists(select 1 from public.crm_members where user_id=(select auth.uid())))
 with check (exists(select 1 from public.crm_members where user_id=(select auth.uid())));

create function public.crm_stamp_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.revision := old.revision+1;
 new.updated_at := now();
 new.updated_by := auth.uid();
 return new;
end;
$$;
revoke all on function public.crm_stamp_revision() from public, anon, authenticated;
create trigger crm_state_revision before update on public.crm_state for each row execute function public.crm_stamp_revision();

insert into public.crm_members(user_id) select id from auth.users where lower(email)='vini@pitch-fc.com' and email_confirmed_at is not null;
do $$ begin if not exists(select 1 from public.crm_members) then raise exception 'The authorized confirmed account is missing'; end if; end $$;
insert into public.crm_state(id,leagues) values('main','[{"id":"afpce","name":"AFPCE","city":"Espinho","country":"Portugal","address":"","lat":41.007,"lng":-8.641,"exact":false,"status":"talk","owner":"","athletes":700,"teams":17,"competitions":null,"quality":"estimate","contact":"Presidente e vice-presidente (nomes a confirmar)","email":"","source":"Notas internas de 27/10/2026 · LIGAS-APP-V1.md","notes":"Direção nova, em reestruturação. Cerca de 700 atletas e 17 clubes; 19 previstos para o próximo ano. Fichas em papel, digitalização no Excel às segundas-feiras. Prioridades: inscrições, cartões, homologação e divulgação. No primeiro ano, apenas a direção opera. Status comercial precisa de atualização após as reuniões previstas.","action":"Confirmar resultado da reunião de 29/10 e próximos passos do piloto.","due":"","history":[{"date":"2026-10-23","channel":"Reunião","text":"Levantamento de necessidades: reduzir a digitalização de fichas, facilitar a gestão disciplinar e dar transparência aos plantéis. Registro resumido nas notas internas de 27/10; confirmar com a transcrição original."},{"date":"2026-10-27","channel":"Nota interna","text":"Reunião presencial prevista para 29/10 às 17:30, em Espinho. Não há confirmação de realização ou aceite do piloto nesta base."}]},{"id":"coimbra","name":"Liga de Coimbra","city":"Coimbra","country":"Portugal","address":"","lat":40.2056,"lng":-8.4196,"exact":false,"status":"talk","owner":"","athletes":300,"teams":null,"competitions":null,"quality":"estimate","contact":"Ricardo Goucha e Pinto Nunes","email":"","source":"Notas internas de 27/10/2026 · LIGAS-APP-V1.md","notes":"Nome oficial da organização a confirmar. Cerca de 300 atletas; mais de 2.000 passaram pela liga ao longo de 18 anos (não incluídos no total atual). Época de setembro a maio. Publicação no blog e estatística em Excel. Dor principal: disponibilizar resultados e classificação a tempo. Número de equipes e competições a confirmar.","action":"Confirmar resultado da reunião prevista para 03/11 e escopo de publicação ao minuto.","due":"","history":[{"date":"2026-10-26","channel":"Reunião","text":"Necessidade principal: publicar resultados e classificação ao minuto. Atrasos nas atualizações geram cobranças. Histórico em Excel pode ser importado, se solicitado."},{"date":"2026-10-27","channel":"Nota interna","text":"Reunião prevista para 03/11 às 12:00, com local a combinar. Resultado da reunião não registrado nesta base."}]}]'::jsonb);
