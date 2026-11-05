-- PITCH Ligas community: RPC-only editorial and personal Fantasy accounts.
-- Nothing in this migration changes group Fantasy or the owner's workspace document.
create schema if not exists league_private;
revoke all on schema league_private from public, anon, authenticated;

create table public.league_articles (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
 category text not null check(category in ('news','notice','recap','tribute')),
 title text not null check(length(title) between 2 and 120),
 excerpt text not null default '' check(length(excerpt)<=280),
 body text not null check(length(body) between 1 and 30000),
 cover_url text not null default '' check(cover_url='' or (cover_url ~ '^https://' and length(cover_url)<=2000)),
 cover_alt text not null default '' check(length(cover_alt)<=200),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 author_user_id uuid not null references auth.users(id),
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 1
);
create index league_articles_public on public.league_articles(workspace_id,published_at desc,id) where status='published';
create index league_articles_owner on public.league_articles(workspace_id,updated_at desc);
alter table public.league_articles enable row level security;
revoke all on public.league_articles from public,anon,authenticated;
grant all on public.league_articles to service_role;

create function public.league_articles_list(p_slug text default null,p_id uuid default null,p_manage boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; result jsonb;
begin
 if p_manage then
  if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501'; end if;
  select * into w from public.league_workspaces where owner_user_id=auth.uid();
 else
  select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published;
 end if;
 if w.id is null then raise exception 'league:not_found' using errcode='42501'; end if;
 select coalesce(jsonb_agg(row order by row->>'published_at' desc nulls last,row->>'updated_at' desc),'[]') into result from (
  select jsonb_build_object('id',a.id,'category',a.category,'title',a.title,'excerpt',case when p_manage then a.excerpt else coalesce(nullif(a.excerpt,''),left(a.body,180)) end,'body',case when p_manage or p_id is not null then a.body else '' end,
   'cover_url',a.cover_url,'cover_alt',a.cover_alt,'status',a.status,'published_at',a.published_at,'updated_at',a.updated_at,'version',a.version) row
  from public.league_articles a where a.workspace_id=w.id and (p_id is null or a.id=p_id)
    and (p_manage or (a.status='published' and a.published_at<=now()))
  order by a.published_at desc nulls last,a.updated_at desc limit 200
 ) rows;
 return jsonb_build_object('league',jsonb_build_object('name',w.name,'slug',w.slug,'color',w.state#>>'{data,league,color}'),'articles',result);
end $$;

create function public.league_article_save(p_article jsonb,p_expected_version integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; a public.league_articles%rowtype; aid uuid; title text:=btrim(p_article->>'title'); body text:=btrim(p_article->>'body');
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501'; end if;
 select * into w from public.league_workspaces where owner_user_id=auth.uid() for update;
 if w.id is null then raise exception 'league:forbidden' using errcode='42501'; end if;
 if jsonb_typeof(p_article) is distinct from 'object' or title is null or body is null or p_article->>'category' is null or p_article->>'status' is null or octet_length(p_article::text)>150000 or length(title) not between 2 and 120 or length(body) not between 1 and 30000
  or p_article->>'category' not in ('news','notice','recap','tribute') or p_article->>'status' not in ('draft','published','archived')
  or coalesce(p_article->>'cover_url','') !~ '^(https://[^[:space:]]+)?$' or (coalesce(p_article->>'cover_url','')<>'' and length(btrim(coalesce(p_article->>'cover_alt',''))) = 0) then raise exception 'league:invalid_article'; end if;
 if coalesce(p_article->>'id','')<>'' then
  aid:=(p_article->>'id')::uuid;
  select * into a from public.league_articles where id=aid and workspace_id=w.id for update;
  if a.id is null then raise exception 'league:not_found' using errcode='42501'; end if;
  if a.version is distinct from p_expected_version then raise exception 'league:version_conflict'; end if;
 else
  if p_expected_version is distinct from 0 then raise exception 'league:version_conflict'; end if;
  if (select count(*) from public.league_articles where workspace_id=w.id)>=2000 then raise exception 'league:article_limit'; end if;
  insert into public.league_articles(workspace_id,category,title,body,author_user_id)
   values(w.id,p_article->>'category',title,body,auth.uid()) returning * into a;
 end if;
 update public.league_articles set category=p_article->>'category',title=title,body=body,
  excerpt=coalesce(p_article->>'excerpt',''),cover_url=coalesce(p_article->>'cover_url',''),cover_alt=coalesce(p_article->>'cover_alt',''),
  status=p_article->>'status',published_at=case when p_article->>'status'='published' then coalesce(a.published_at,now()) else a.published_at end,
  updated_at=now(),version=case when aid is null then 1 else a.version+1 end where id=a.id;
 return jsonb_build_object('id',a.id,'version',case when aid is null then 1 else a.version+1 end);
end $$;
revoke all on function public.league_articles_list(text,uuid,boolean) from public;
revoke all on function public.league_article_save(jsonb,integer) from public,anon;
grant execute on function public.league_articles_list(text,uuid,boolean) to anon,authenticated;
grant execute on function public.league_article_save(jsonb,integer) to authenticated;

create table public.league_fantasy_members (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.league_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 60), team_name text not null check(length(team_name) between 2 and 60),
 support_team_id text, consent_at timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(workspace_id,user_id),unique(workspace_id,id)
);
create table public.league_fantasy_rounds (
 workspace_id uuid not null references public.league_workspaces(id) on delete cascade,competition_id text not null,season text not null,round integer not null,
 kickoff_at timestamptz not null,primary key(workspace_id,competition_id,season,round)
);
create table public.league_fantasy_entries (
 workspace_id uuid not null,member_id uuid not null,competition_id text not null,season text not null,round integer not null,
 squad jsonb not null,version integer not null default 1,submitted_at timestamptz not null default now(),
 primary key(workspace_id,member_id,competition_id,season,round),
 foreign key(workspace_id,member_id) references public.league_fantasy_members(workspace_id,id) on delete cascade,
 foreign key(workspace_id,competition_id,season,round) references public.league_fantasy_rounds(workspace_id,competition_id,season,round) on delete cascade
);
create index league_fantasy_members_user on public.league_fantasy_members(user_id,workspace_id);
create index league_fantasy_entries_member on public.league_fantasy_entries(workspace_id,competition_id,season,member_id,round desc);
create index league_fantasy_entries_round on public.league_fantasy_entries(workspace_id,competition_id,season,round);
alter table public.league_fantasy_members enable row level security;
alter table public.league_fantasy_rounds enable row level security;
alter table public.league_fantasy_entries enable row level security;
revoke all on public.league_fantasy_members,public.league_fantasy_rounds,public.league_fantasy_entries from public,anon,authenticated;
grant all on public.league_fantasy_members,public.league_fantasy_rounds,public.league_fantasy_entries to service_role;

create function public.league_fantasy_join(p_slug text,p_name text,p_team_name text,p_support_team text default null,p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; m public.league_fantasy_members%rowtype;
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'league:email_unconfirmed' using errcode='42501'; end if;
 if not coalesce(p_consent,false) then raise exception 'league:consent_required'; end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published for update;
 if w.id is null then raise exception 'league:not_found' using errcode='42501'; end if;
 if w.state#>>'{modules,fantasy}'='false' then raise exception 'league:fantasy_closed';end if;
 if w.state#>>'{data,league,page,signup}'='false' and not exists(select 1 from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid()) then raise exception 'league:signup_closed';end if;
 if length(btrim(p_name)) not between 2 and 60 or length(btrim(p_team_name)) not between 2 and 60 then raise exception 'league:name_required'; end if;
 if p_support_team is not null and not exists(select 1 from jsonb_array_elements(w.state#>'{data,teams}') t where t->>'id'=p_support_team) then raise exception 'league:team_not_found'; end if;
 if not exists(select 1 from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid()) and (select count(*) from public.league_fantasy_members where workspace_id=w.id)>=2000 then raise exception 'league:signup_full'; end if;
 insert into public.league_fantasy_members(workspace_id,user_id,display_name,team_name,support_team_id)
 values(w.id,auth.uid(),btrim(p_name),btrim(p_team_name),p_support_team)
 on conflict(workspace_id,user_id) do update set display_name=excluded.display_name,team_name=excluded.team_name,support_team_id=excluded.support_team_id returning * into m;
 return jsonb_build_object('id',m.id,'name',m.display_name,'team_name',m.team_name);
end $$;
revoke all on function public.league_fantasy_join(text,text,text,text,boolean) from public,anon;
grant execute on function public.league_fantasy_join(text,text,text,text,boolean) to authenticated;

-- Build the SAME official-round summary as src/lib/leagueFantasy.js.
create function league_private.fantasy_round(s jsonb,cid text,rn integer)
returns jsonb language plpgsql immutable set search_path='' as $$
#variable_conflict use_variable
declare m jsonb; evs jsonb; events jsonb; games jsonb:='[]'; teams jsonb:='[]'; lines jsonb; played integer:=0; total integer:=0; official boolean:=true; ids jsonb:='[]';
 hn text; an text; hg integer; ag integer; homegk text; awaygk text; players jsonb:=s#>'{data,players}';
begin
 for m in select x from jsonb_array_elements(s->'matches') x where x->>'competitionId'=cid and (x->>'round')::integer=rn order by x->>'kickoff',x->>'id' loop
  if m->>'state'='cancelled' then continue; end if; total:=total+1;
  if m->>'state' not in ('homologated','walkover') then official:=false;continue;end if;
  if m->>'state'='walkover' then continue; end if; played:=played+1;
  select coalesce(jsonb_agg(x order by (x->>'minute')::integer nulls last,o),'[]') into evs from jsonb_array_elements(coalesce(s->'logs'->(m->>'id'),'[]')) with ordinality es(x,o)
   where x->>'type'<>'void' and not exists(select 1 from jsonb_array_elements(coalesce(s->'logs'->(m->>'id'),'[]')) y where y->>'supersedes'=x->>'id');
  select t->>'name' into hn from jsonb_array_elements(s#>'{data,teams}') t where t->>'id'=m->>'homeId';
  select t->>'name' into an from jsonb_array_elements(s#>'{data,teams}') t where t->>'id'=m->>'awayId';
  select count(*) filter(where x->>'teamId'=m->>'homeId'),count(*) filter(where x->>'teamId'=m->>'awayId') into hg,ag from jsonb_array_elements(evs) x where x->>'type' in ('goal','own_goal') and x->>'matchId'=m->>'id';
  select coalesce(jsonb_agg(jsonb_build_object('id',x->>'id','side',case when x->>'teamId'=m->>'homeId' then 'h' else 'a' end,'type',case when x->>'type'='own_goal' then 'og' else 'goal' end,'by',x->'playerId','min',x->'minute')||case when x->>'type'='goal' and x->>'assistId' is not null then jsonb_build_object('ast',x->'assistId') else '{}'::jsonb end),'[]') into events from jsonb_array_elements(evs) x
   where x->>'matchId'=m->>'id' and x->>'type' in ('goal','own_goal') and x->>'teamId' in (m->>'homeId',m->>'awayId') and (x->>'type'='goal' or x->>'playerId' is not null);
  select x into homegk from jsonb_array_elements_text(coalesce(m->'lineups'->(m->>'homeId'),'[]')) x where exists(select 1 from jsonb_array_elements(players) p where p->>'id'=x and p->>'position'='GR') limit 1;
  select x into awaygk from jsonb_array_elements_text(coalesce(m->'lineups'->(m->>'awayId'),'[]')) x where exists(select 1 from jsonb_array_elements(players) p where p->>'id'=x and p->>'position'='GR') limit 1;
  games:=games||jsonb_build_array(jsonb_build_object('n',played,'homeName',hn,'awayName',an,'homeGoals',hg,'awayGoals',ag,'homeGk',homegk,'awayGk',awaygk,'events',events));
  teams:=teams||jsonb_build_array(jsonb_build_object('name',hn,'players',coalesce(m->'lineups'->(m->>'homeId'),'[]')),jsonb_build_object('name',an,'players',coalesce(m->'lineups'->(m->>'awayId'),'[]')));
  ids:=ids||jsonb_build_array(m->>'id');
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('key',pid,'goals',goals,'assists',assists)),'[]') into lines from (
  select pid,count(*) filter(where kind='goal') goals,count(*) filter(where kind='assist') assists from (
   select e->>'by' pid,'goal' kind from jsonb_array_elements(games) g cross join lateral jsonb_array_elements(g->'events') e where e->>'type'='goal' and e->>'by' is not null
   union all select e->>'ast','assist' from jsonb_array_elements(games) g cross join lateral jsonb_array_elements(g->'events') e where e->>'type'='goal' and e->>'ast' is not null
  ) a group by pid
 ) l;
 return jsonb_build_object('official',official and total>0 and played>0,'matchIds',ids,'summary',jsonb_build_object('teamResults',teams,'matches',games,'lines',lines,'candidates','[]'::jsonb));
end $$;
revoke all on function league_private.fantasy_round(jsonb,text,integer) from public,anon,authenticated;

create function league_private.fantasy_score(sq jsonb,summary jsonb,positions jsonb,charge boolean)
returns jsonb language plpgsql immutable set search_path='' as $$
#variable_conflict use_variable
declare starters jsonb; result jsonb; conn jsonb:=sq->'connection'; hits jsonb:='[]'; ev jsonb; g jsonb; tm jsonb; cid text:=conn->>'creator_id'; fid text:=conn->>'finisher_id'; bonus integer:=0; seen text[]:='{}';
begin
 select coalesce(jsonb_agg(x),'[]') into starters from jsonb_array_elements_text(sq->'player_ids') x where not coalesce(sq->'reserve_ids','[]') ? x;
 result:=public.fantasy_v2_score_lineup(jsonb_build_object('starters',starters,'bench',coalesce(sq->'reserve_ids','[]'),'captain',sq->'captain_id','vice',sq->'vice_captain_id','transferCost',case when charge then coalesce((sq->>'transfer_cost')::integer,0) else 0 end),summary,positions,'{}');
 for g in select x from jsonb_array_elements(summary->'matches') x loop
  for ev in select x from jsonb_array_elements(g->'events') x where x->>'type'='goal' and x->>'by'=fid and x->>'ast'=cid order by (x->>'min')::integer nulls last,x->>'id' loop
   if ev->>'id'=any(seen) then continue;end if;seen:=seen||(ev->>'id');
   select x->'players' into tm from jsonb_array_elements(summary->'teamResults') x where x->>'name'=case when ev->>'side'='h' then g->>'homeName' else g->>'awayName' end limit 1;
   if starters ? cid and starters ? fid and cid<>fid and tm ? cid and tm ? fid then
    hits:=hits||jsonb_build_array(jsonb_build_object('id',ev->>'id','game',g->'n','min',ev->'min','by',fid,'ast',cid,'awarded',jsonb_array_length(hits)<2));
   end if;
  end loop;
 end loop;
 bonus:=least(2,jsonb_array_length(hits))*3;
 return result||jsonb_build_object('base',result->'total','total',(result->>'total')::integer+bonus,'connection',jsonb_build_object('status',case when cid is null then 'none' when bonus>0 then 'activated' else 'no_match' end,'points',bonus,'events',hits,'totalValid',jsonb_array_length(hits),'awarded',least(2,jsonb_array_length(hits)),'capped',jsonb_array_length(hits)>2,'provisional',0));
end $$;
revoke all on function league_private.fantasy_score(jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;

create function league_private.fantasy_context(wid uuid,mid uuid)
returns jsonb language plpgsql volatile set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; comp jsonb; season text; positions jsonb; rd record; info jsonb; allrounds jsonb:='[]'; scores jsonb:='[]'; points jsonb:='[]'; prices jsonb:='{}'; people jsonb; next_r jsonb; entry record; score jsonb; p jsonb; form numeric[]; night jsonb; pn jsonb; sq jsonb; prev jsonb; current_entry public.league_fantasy_entries%rowtype; me public.league_fantasy_members%rowtype; rid text; k timestamptz; ownership jsonb; prev_round integer; allowed_free integer:=1;
begin
 select * into w from public.league_workspaces where id=wid;
 select x into comp from jsonb_array_elements(w.state#>'{data,competitions}') x where coalesce(x->>'kind','league')<>'cup' limit 1;
 if comp is null then raise exception 'league:no_competition';end if;
 season:=coalesce(comp->>'season','');
 select coalesce(jsonb_object_agg(x->>'id',case x->>'position' when 'GR' then 'Guarda-redes' when 'DEF' then 'Defesa' when 'AVA' then 'Avançado' else 'Médio' end),'{}') into positions from jsonb_array_elements(w.state#>'{data,players}') x;
 for rd in select (x->>'round')::integer n,min((x->>'kickoff')::timestamptz) kick from jsonb_array_elements(w.state->'matches') x where x->>'competitionId'=comp->>'id' and nullif(x->>'kickoff','') is not null and x->>'state'<>'cancelled' group by (x->>'round')::integer order by (x->>'round')::integer loop
  insert into public.league_fantasy_rounds(workspace_id,competition_id,season,round,kickoff_at) values(wid,comp->>'id',season,rd.n,rd.kick)
  on conflict on constraint league_fantasy_rounds_pkey do update set kickoff_at=case when public.league_fantasy_rounds.kickoff_at<=now() then public.league_fantasy_rounds.kickoff_at else excluded.kickoff_at end returning kickoff_at into k;
  info:=league_private.fantasy_round(w.state,comp->>'id',rd.n);rid:=(comp->>'id')||':'||season||':'||rd.n;
  allrounds:=allrounds||jsonb_build_array(info||jsonb_build_object('id',rid,'round',rd.n,'kickoff_at',k,'kickoffAt',k,'status',case when (info->>'official')::boolean and k<=now() then 'scored' when k<=now() then 'locked' else 'open' end));
  if k>now() and not (info->>'official')::boolean and (next_r is null or (next_r->>'kickoff_at')::timestamptz>k) then next_r:=jsonb_build_object('id',rid,'round',rd.n,'kickoff_at',k);end if;
  if (info->>'official')::boolean and k<=now() then
   for entry in select distinct on (e.member_id) e.* from public.league_fantasy_entries e where e.workspace_id=wid and e.competition_id=comp->>'id' and e.season=season and e.round<=rd.n and e.submitted_at<k order by e.member_id,e.round desc loop
    score:=league_private.fantasy_score(entry.squad,info->'summary',positions,entry.round=rd.n)||jsonb_build_object('connectionPair',entry.squad->'connection');
    scores:=scores||jsonb_build_array(jsonb_build_object('id',rid||':'||entry.member_id,'league_id',wid,'round_id',rid,'matchday_id',rid,'participant_id',entry.member_id,'points',score->'total','breakdown',case when entry.member_id=mid then score else null end,'captain_id',entry.squad->'captain_id','vice_captain_id',entry.squad->'vice_captain_id','transfer_cost',case when entry.round=rd.n then coalesce((entry.squad->>'transfer_cost')::integer,0) else 0 end));
   end loop;
   night:=public.fantasy_v2_night(info->'summary');
   for p in select x from jsonb_array_elements(w.state#>'{data,players}') x loop
    pn:=public.fantasy_v2_player_night(night,info->'summary',p->>'id',positions->>(p->>'id'),'{}');
    if coalesce((pn->>'played')::boolean,false) then points:=points||jsonb_build_array(jsonb_build_object('round_id',rid,'round',rd.n,'player_id',p->>'id','points',pn->'pts'));end if;
   end loop;
  end if;
 end loop;
 for p in select x from jsonb_array_elements(w.state#>'{data,players}') x loop
  select array_agg(v order by n desc) into form from (select (x->>'points')::numeric v,(x->>'round')::integer n from jsonb_array_elements(points) x where x->>'player_id'=p->>'id' order by (x->>'round')::integer desc limit 3) f;
  prices:=prices||jsonb_build_object(p->>'id',jsonb_build_object('price',public.fantasy_v2_price(coalesce(form,'{}'),20,1.5),'prev',null));
 end loop;
 select * into me from public.league_fantasy_members where id=mid and workspace_id=wid;
 select coalesce(jsonb_agg(jsonb_build_object('uuid',id,'name',display_name,'nick',team_name,'isMe',id=mid) order by created_at),'[]') into people from public.league_fantasy_members where workspace_id=wid;
 if next_r is not null then
  select * into current_entry from public.league_fantasy_entries e where workspace_id=wid and member_id=mid and competition_id=comp->>'id' and e.season=season and e.round=(next_r->>'round')::integer;
  select e.squad,e.round into prev,prev_round from public.league_fantasy_entries e where workspace_id=wid and member_id=mid and competition_id=comp->>'id' and e.season=season and e.round<(next_r->>'round')::integer order by e.round desc limit 1;
  if prev_round is not null then allowed_free:=least(2,coalesce((prev->>'next_free')::integer,1)+greatest(0,(next_r->>'round')::integer-prev_round-1));end if;
 else
  select e.squad into prev from public.league_fantasy_entries e where workspace_id=wid and member_id=mid and competition_id=comp->>'id' and e.season=season order by e.round desc limit 1;
 end if;
 sq:=coalesce(current_entry.squad,prev,jsonb_build_object('player_ids','[]'::jsonb,'reserve_ids','[]'::jsonb,'captain_id',null,'vice_captain_id',null,'prices_paid','{}'::jsonb,'free_transfers',1));
 sq:=sq||jsonb_build_object('participant_id',mid,'version',coalesce(current_entry.version,0),'locked_player_ids',prev->'player_ids','free_transfers',allowed_free);
 select coalesce(jsonb_object_agg(pid,n),'{}') into ownership from (
  select pid,count(*) n from (select distinct on (e.member_id) e.squad from public.league_fantasy_entries e where e.workspace_id=wid and e.member_id<>mid and e.competition_id=comp->>'id' and e.season=season and (next_r is null or e.round<=(next_r->>'round')::integer) order by e.member_id,e.round desc) others cross join lateral jsonb_array_elements_text(others.squad->'player_ids') pid group by pid
 ) counts;
 return jsonb_build_object('ownership',jsonb_build_object('participants',jsonb_array_length(people),'counts',ownership),'workspace_id',wid,'member',jsonb_build_object('id',mid,'name',me.display_name,'team_name',me.team_name),'state',public.league_workspace_public(w.slug)->'state','competition',comp,'participants',people,'squad',sq,'rounds',allrounds,'scores',scores,'roundPlayers',points,'prices',prices,'nextRound',next_r);
end $$;
revoke all on function league_private.fantasy_context(uuid,uuid) from public,anon,authenticated;

create function public.league_fantasy_state(p_slug text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype;m public.league_fantasy_members%rowtype;
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501';end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published;
 if w.id is null then raise exception 'league:not_found' using errcode='42501';end if;
 if w.state#>>'{modules,fantasy}'='false' then raise exception 'league:fantasy_closed';end if;
 select * into m from public.league_fantasy_members where workspace_id=w.id and user_id=auth.uid();
 if m.id is null then raise exception 'league:join_required';end if;
 return league_private.fantasy_context(w.id,m.id);
end $$;
revoke all on function public.league_fantasy_state(text) from public,anon;
grant execute on function public.league_fantasy_state(text) to authenticated;

create function public.league_fantasy_save(p_slug text,p_squad jsonb,p_expected_version integer,p_round integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.league_workspaces%rowtype; m public.league_fantasy_members%rowtype; ctx jsonb; comp text; season text; next_r integer; ids text[]; bench text[]; starters text[]; id text; current_sq jsonb; prev record; paid jsonb:='{}'; cost numeric:=0; owned integer; cap integer; added boolean; transfer jsonb; free integer:=1; version integer; sq jsonb; conn jsonb:=p_squad->'connection';
begin
 if auth.uid() is null then raise exception 'league:not_authenticated' using errcode='42501';end if;
 select * into w from public.league_workspaces where slug=lower(btrim(p_slug)) and published for update;
 if w.id is null or w.state#>>'{modules,fantasy}'='false' then raise exception 'league:not_found' using errcode='42501';end if;
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
revoke all on function public.league_fantasy_save(text,jsonb,integer,integer) from public,anon;
grant execute on function public.league_fantasy_save(text,jsonb,integer,integer) to authenticated;
