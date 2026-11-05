-- Pitch Manager dos adeptos: o módulo só está aberto quando a liga o ligou
-- de forma explícita (modules.fantasy = true).
--
-- A migração 20261105134348 só fechava o jogo com modules.fantasy = 'false'.
-- Numa liga sem a chave (workspace antigo ou importado) o servidor deixava
-- entrar, enquanto a app trata "sem chave" como desligado (leagueModules.js,
-- default: false). Agora o servidor segue a mesma regra que a app.
--
-- Só muda a condição do módulo; o resto das três funções fica igual.
-- Mesmas assinaturas: os grants existentes mantêm-se (voltam a ser indicados
-- abaixo, de forma idempotente, para ficar claro quem pode executar).

create or replace function public.league_fantasy_join(p_slug text,p_name text,p_team_name text,p_support_team text default null,p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; m public.league_fantasy_members%rowtype;
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'league:email_unconfirmed' using errcode='42501'; end if;
 if not coalesce(p_consent,false) then raise exception 'league:consent_required'; end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published for update;
 if w.id is null then raise exception 'league:not_found' using errcode='42501'; end if;
 if w.state#>>'{modules,fantasy}' is distinct from 'true' then raise exception 'league:fantasy_closed';end if;
 if w.state#>>'{data,league,page,signup}'='false' and not exists(select 1 from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid()) then raise exception 'league:signup_closed';end if;
 if length(btrim(p_name)) not between 2 and 60 or length(btrim(p_team_name)) not between 2 and 60 then raise exception 'league:name_required'; end if;
 if p_support_team is not null and not exists(select 1 from jsonb_array_elements(w.state#>'{data,teams}') t where t->>'id'=p_support_team) then raise exception 'league:team_not_found'; end if;
 if not exists(select 1 from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid()) and (select count(*) from public.league_fantasy_members where workspace_id=w.id)>=2000 then raise exception 'league:signup_full'; end if;
 insert into public.league_fantasy_members(workspace_id,user_id,display_name,team_name,support_team_id)
 values(w.id,auth.uid(),btrim(p_name),btrim(p_team_name),p_support_team)
 on conflict(workspace_id,user_id) do update set display_name=excluded.display_name,team_name=excluded.team_name,support_team_id=excluded.support_team_id returning * into m;
 return jsonb_build_object('id',m.id,'name',m.display_name,'team_name',m.team_name);
end $$;

create or replace function public.league_fantasy_state(p_slug text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype;m public.league_fantasy_members%rowtype;
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501';end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published;
 if w.id is null then raise exception 'league:not_found' using errcode='42501';end if;
 if w.state#>>'{modules,fantasy}' is distinct from 'true' then raise exception 'league:fantasy_closed';end if;
 select * into m from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid();
 if m.id is null then raise exception 'league:join_required';end if;
 return league_private.fantasy_context(w.id,m.id);
end $$;

create or replace function public.league_fantasy_save(p_slug text,p_squad jsonb,p_expected_version integer,p_round integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; m public.league_fantasy_members%rowtype; ctx jsonb; comp text; season text; next_r integer; ids text[]; bench text[]; starters text[]; id text; current_sq jsonb; prev record; paid jsonb:='{}'; cost numeric:=0; owned integer; cap integer; added boolean; transfer jsonb; free integer:=1; version integer; sq jsonb; conn jsonb:=p_squad->'connection';
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501';end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published for update;
 if w.id is null or w.state#>>'{modules,fantasy}' is distinct from 'true' then raise exception 'league:not_found' using errcode='42501';end if;
 select * into m from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid();
 if m.id is null then raise exception 'league:join_required';end if;
 ctx:=league_private.fantasy_context(w.id,m.id);comp:=ctx#>>'{competition,id}';season:=coalesce(ctx#>>'{competition,season}','');next_r:=(ctx#>>'{nextRound,round}')::integer;
 if next_r is null or p_round is distinct from next_r or (ctx#>>'{nextRound,kickoff_at}')::timestamptz<=now() then raise exception 'league:round_locked';end if;
 current_sq:=ctx->'squad';version:=(current_sq->>'version')::integer;
 if p_expected_version is distinct from version then raise exception 'league:version_conflict';end if;
 if jsonb_typeof(p_squad) is distinct from 'object' or octet_length(p_squad::text)>12000 or jsonb_typeof(p_squad->'player_ids') is distinct from 'array' or jsonb_typeof(p_squad->'reserve_ids') is distinct from 'array' then raise exception 'league:invalid_squad';end if;
 ids:=array(select jsonb_array_elements_text(p_squad->'player_ids'));bench:=array(select jsonb_array_elements_text(p_squad->'reserve_ids'));
 starters:=array(select x from unnest(ids) x where not x=any(bench));
 if cardinality(ids) not between 5 and 7 or cardinality(bench)>2 or cardinality(starters)<>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or cardinality(bench)<>(select count(distinct x) from unnest(bench) x) or not bench<@ids
  or p_squad->>'captain_id' is null or p_squad->>'vice_captain_id' is null or not (p_squad->>'captain_id')=any(starters) or not (p_squad->>'vice_captain_id')=any(starters) or p_squad->>'captain_id'=p_squad->>'vice_captain_id' then raise exception 'league:invalid_squad';end if;
 if conn is not null and conn<>'null'::jsonb and (conn->>'creator_id' is null or conn->>'finisher_id' is null or conn->>'creator_id'=conn->>'finisher_id' or not (conn->>'creator_id')=any(starters) or not (conn->>'finisher_id')=any(starters)) then raise exception 'league:connection_invalid';end if;
 cap:=public.fantasy_ownership_cap((select count(*)::integer from public.league_fantasy_members where workspace_id=w.id));
 foreach id in array ids loop
  if id is null or not exists(select 1 from jsonb_array_elements(w.state#>'{data,players}') p where p->>'id'=id and (coalesce(jsonb_array_length(ctx#>'{competition,teamIds}'),0)=0 or ctx#>'{competition,teamIds}' ? (p->>'teamId'))) then raise exception 'league:invalid_player';end if;
  added:=not coalesce(current_sq->'player_ids','[]') ? id;
  if added and exists(select 1 from jsonb_array_elements(w.state#>'{data,players}') p where p->>'id'=id and p->>'injured'='true') then raise exception 'league:injured';end if;
  select count(*) into owned from (select distinct on (e.member_id) e.member_id,e.squad from public.league_fantasy_entries e where e.workspace_id=w.id and e.member_id<>m.id and e.competition_id=comp and e.season=season and e.round<=next_r order by e.member_id,e.round desc) others where others.squad->'player_ids' ? id;
  if added and owned>=cap then raise exception 'league:ownership_cap';end if;
  paid:=paid||jsonb_build_object(id,coalesce(current_sq->'prices_paid'->id,ctx->'prices'->id->'price','20'::jsonb));
  cost:=cost+(paid->>id)::numeric;
 end loop;
 if cost>120 then raise exception 'league:over_budget';end if;
 select e.* into prev from public.league_fantasy_entries e where workspace_id=w.id and member_id=m.id and competition_id=comp and e.season=season and e.round<next_r order by e.round desc limit 1;
 if prev.round is not null then free:=least(2,coalesce((prev.squad->>'next_free')::integer,1)+greatest(0,next_r-prev.round-1));end if;
 transfer:=public.fantasy_v2_transfer(case when prev.round is null then null else array(select jsonb_array_elements_text(prev.squad->'player_ids')) end,ids,free);
 sq:=jsonb_build_object('player_ids',to_jsonb(ids),'reserve_ids',to_jsonb(bench),'captain_id',p_squad->'captain_id','vice_captain_id',p_squad->'vice_captain_id','connection',conn,'prices_paid',paid,'free_transfers',free,'next_free',transfer->'nextFree','transfer_cost',transfer->'cost');
 insert into public.league_fantasy_entries(workspace_id,member_id,competition_id,season,round,squad) values(w.id,m.id,comp,season,next_r,sq)
 on conflict on constraint league_fantasy_entries_pkey do update set squad=excluded.squad,version=public.league_fantasy_entries.version+1,submitted_at=now();
 return league_private.fantasy_context(w.id,m.id);
end $$;

revoke all on function public.league_fantasy_join(text,text,text,text,boolean) from public,anon;
grant execute on function public.league_fantasy_join(text,text,text,text,boolean) to authenticated;
revoke all on function public.league_fantasy_state(text) from public,anon;
grant execute on function public.league_fantasy_state(text) to authenticated;
revoke all on function public.league_fantasy_save(text,jsonb,integer,integer) from public,anon;
grant execute on function public.league_fantasy_save(text,jsonb,integer,integer) to authenticated;
