create or replace function private.var_rpc(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare uid uuid:=auth.uid(); gid uuid; pid uuid; sid uuid; rid uuid; cid uuid; g public.games; s public.var_sessions;
 r public.var_requests; goal public.var_goals; clip public.var_cloud_clips; answer jsonb; start_at timestamptz; is_live boolean;
begin
 if uid is null then raise exception 'É necessário entrar na conta Pitch.' using errcode='42501'; end if;
 if action='clock' then return jsonb_build_object('serverMs',extract(epoch from clock_timestamp())*1000); end if;
 if action='games' then
  select coalesce(jsonb_agg(jsonb_build_object('id',gg.id,'groupId',gg.group_id,'groupName',gr.name,'venue',gg.venue,'scheduledAt',gg.scheduled_at,'playerId',p.id,'matches',coalesce(gg.live_matchday->'matches','[]'::jsonb))),'[]'::jsonb) into answer
  from public.games gg join public.var_games v on v.game_id=gg.id and v.enabled and v.finished_at is null
  join public.groups gr on gr.id=gg.group_id join public.attendances a on a.game_id=gg.id and a.status='confirmed'
  join public.players p on p.id=a.player_id and p.user_id=uid
  join public.player_group_memberships m on m.player_id=p.id and m.group_id=gg.group_id and not m.banned;
  return answer;
 end if;
 if action='toggle' then
  select * into g from public.games where id=(payload->>'gameId')::uuid;
  if g.id is null or not public.is_group_manager(g.group_id) then raise exception 'Sem permissão para ativar VAR nesta partida.' using errcode='42501'; end if;
  if coalesce((payload->>'enabled')::boolean,false) and exists(select 1 from public.var_games where game_id=g.id and finished_at is not null) then raise exception 'Esta partida já terminou.'; end if;
  insert into public.var_games(game_id,enabled) values(g.id,(payload->>'enabled')::boolean)
  on conflict(game_id) do update set enabled=excluded.enabled,updated_at=now();
  if not (payload->>'enabled')::boolean then update public.var_sessions set active=false,lease_expires_at=now() where game_id=g.id; end if;
  return jsonb_build_object('enabled',(payload->>'enabled')::boolean);
 end if;
 if action='join' then
  select * into g from public.games where id=(payload->>'gameId')::uuid;
  if g.id is null or not private.var_member(g.group_id) or not exists(select 1 from public.var_games where game_id=g.id and enabled and finished_at is null) then raise exception 'VAR não está disponível nesta partida.' using errcode='42501'; end if;
  select p.id into pid from public.players p join public.attendances a on a.player_id=p.id and a.game_id=g.id and a.status='confirmed' join public.player_group_memberships m on m.player_id=p.id and m.group_id=g.group_id and not m.banned where p.user_id=uid limit 1;
  if pid is null then raise exception 'Confirme presença para gravar esta partida.' using errcode='42501'; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(g.live_matchday->'matches','[]'::jsonb)) m where m->>'id'=payload->>'matchId' and not coalesce((m->>'concluded')::boolean,false) and not coalesce((m->>'isBye')::boolean,false)) then raise exception 'Escolha um jogo em andamento.'; end if;
  start_at:=to_timestamp((payload->>'startServerMs')::double precision/1000);
  if start_at<now()-interval '10 seconds' or start_at>now()+interval '2 seconds' or coalesce((payload->>'uncertaintyMs')::numeric,99999)>1500 then raise exception 'Não foi possível sincronizar o horário da câmera.'; end if;
  -- A new recording always has a new session, including on the same device.
  update public.var_sessions set active=false,lease_expires_at=now() where device_id=(payload->>'deviceId')::uuid and operator_user_id=uid and active;
  insert into public.var_sessions(game_id,group_id,match_id,operator_player_id,operator_user_id,device_id,capture_started_at,lease_expires_at)
  values(g.id,g.group_id,payload->>'matchId',pid,uid,(payload->>'deviceId')::uuid,start_at,now()+interval '40 seconds') returning id into sid;
  return jsonb_build_object('sessionId',sid,'playerId',pid,'groupId',g.group_id);
 end if;
 if action in ('beat','poll','stop') then
  select * into s from public.var_sessions where id=(payload->>'sessionId')::uuid and operator_user_id=uid;
  if s.id is null or not private.var_member(s.group_id) then raise exception 'Sessão não autorizada.' using errcode='42501'; end if;
  if action='stop' then update public.var_sessions set active=false,lease_expires_at=now() where id=s.id;return '{}'::jsonb;end if;
  select * into g from public.games where id=s.game_id;
  is_live:=s.active and exists(select 1 from public.var_games v where v.game_id=s.game_id and v.enabled and v.finished_at is null)
   and exists(select 1 from public.attendances a where a.game_id=s.game_id and a.player_id=s.operator_player_id and a.status='confirmed')
   and exists(select 1 from jsonb_array_elements(coalesce(g.live_matchday->'matches','[]'::jsonb)) m where m->>'id'=s.match_id and not coalesce((m->>'concluded')::boolean,false));
  if action='beat' then
   update public.var_sessions set active=is_live,lease_expires_at=case when is_live then now()+interval '40 seconds' else now() end where id=s.id;
   if is_live then
    -- Recover missed notifications only for the same continuous capture and recent buffer.
    insert into public.var_requests(goal_id,session_id)
    select goal.id,s.id from public.var_goals goal where goal.game_id=s.game_id and goal.match_id=s.match_id and not goal.cancelled
     and goal.expires_at>now() and goal.occurred_at>=s.capture_started_at and goal.occurred_at>=now()-interval '45 seconds'
    on conflict(goal_id,session_id) do nothing;
   end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('requestId',r.id,'state',r.state,'goal',jsonb_build_object('version',1,'groupId',goal.group_id,'gameId',goal.game_id,'matchId',goal.match_id,'goalId',goal.id,'scorerPlayerId',goal.scorer_player_id,'sessionId',s.id,'occurredAt',to_char(goal.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'recordedAt',to_char(goal.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'ownGoal',goal.own_goal,'revision',1)) order by r.created_at),'[]'::jsonb) into answer
  from public.var_requests r join public.var_goals goal on goal.id=r.goal_id where r.session_id=s.id and r.state in ('pending','collecting') and not goal.cancelled and goal.expires_at>now();
  return jsonb_build_object('active',is_live,'requests',answer);
 end if;
 if action in ('receipt','reserve','uploaded') then
  select * into r from public.var_requests where id=(payload->>'requestId')::uuid;
  select * into s from public.var_sessions where id=r.session_id and operator_user_id=uid;
  select * into goal from public.var_goals where id=r.goal_id;
  if s.id is null or not private.var_member(s.group_id) then raise exception 'Pedido não autorizado.' using errcode='42501'; end if;
  if action='receipt' then
   if payload->>'state' not in ('collecting','saved_local','expired','failed') then raise exception 'Estado inválido.'; end if;
   if r.state='saved_local' and payload->>'state'<>'saved_local' then return '{}'::jsonb;end if;
   update public.var_requests set state=payload->>'state',local_clip_id=coalesce(payload->>'clipId',local_clip_id),reason=left(payload->>'reason',250) where id=r.id;
   return '{}'::jsonb;
  end if;
  if r.state<>'saved_local' or goal.cancelled or goal.expires_at<=now() then raise exception 'Lance indisponível ou prazo encerrado.'; end if;
  if action='reserve' then
   insert into public.var_cloud_clips(request_id,goal_id,operator_user_id,object_path,expires_at)
   values(r.id,goal.id,uid,goal.game_id::text||'/'||r.id::text||'.mp4',goal.expires_at) on conflict(request_id) do nothing;
   select * into clip from public.var_cloud_clips where request_id=r.id;
   return jsonb_build_object('id',clip.id,'path',clip.object_path,'state',clip.state,'scorerPlayerId',goal.scorer_player_id,'operatorPlayerId',s.operator_player_id);
  end if;
  select * into clip from public.var_cloud_clips where request_id=r.id;
  if clip.id is null or not exists(select 1 from storage.objects o where o.bucket_id='pitch-var' and o.name=clip.object_path and (o.metadata->>'size')::bigint between 1 and 25165824 and o.metadata->>'mimetype'='video/mp4') then raise exception 'Upload ainda não foi confirmado.'; end if;
  update public.var_cloud_clips c set state='available',uploaded_at=now(),bytes=(select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id='pitch-var' and o.name=c.object_path) where c.id=clip.id;
  return jsonb_build_object('available',true);
 end if;
 if action='my_clips' then
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'path',c.object_path,'expiresAt',goal.expires_at,'occurredAt',goal.occurred_at,'goalId',goal.id,'ownGoal',goal.own_goal,'groupName',gr.name,'angle',c.request_id,'bytes',c.bytes) order by goal.occurred_at desc),'[]'::jsonb) into answer
  from public.var_cloud_clips c join public.var_goals goal on goal.id=c.goal_id join public.players p on p.id=goal.scorer_player_id join public.groups gr on gr.id=goal.group_id
  where c.state='available' and not goal.cancelled and goal.expires_at>now() and p.user_id=uid and private.var_member(goal.group_id);
  return answer;
 end if;
 raise exception 'Ação VAR desconhecida.';
end;
$$;
