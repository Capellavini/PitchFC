-- One-off data fix, at Vinicius's request (2026-10-28): the admin account
-- (capella.vinicius@gmail.com) is not reachable, so the pending pilot request
-- of vini@pitch-fc.com is approved here instead of in the review screen.
-- Same effect as review_league_access(..., 'approve'); touches only that
-- person's pending request and does nothing if there is none. Idempotent.
do $$
declare v_id uuid;
begin
  select r.id into v_id
    from public.league_access_requests r
    join public.players p on p.id = r.requester_player_id
    join auth.users u on u.id = p.user_id
   where lower(u.email) = 'vini@pitch-fc.com' and r.status = 'pending'
   order by r.created_at desc
   limit 1;
  if v_id is null then
    raise notice 'No pending pilot request for vini@pitch-fc.com: nothing to approve.';
    return;
  end if;
  update public.league_access_requests
     set status = 'approved', reviewed_at = now(), updated_at = now(),
         review_note = 'Aprovado a pedido do Vinicius (conta de admin inacessível).'
   where id = v_id;
  insert into public.league_audit_log (league_id, action, payload)
  values (null, 'access_approved', jsonb_build_object('request_id', v_id, 'via', 'migration'));
end $$;
