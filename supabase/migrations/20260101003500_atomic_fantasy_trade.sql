-- ─────────────────────────────────────────────────────────
-- Migration 35 — Atomic Pitch Manager trade acceptance
--
-- Bug found 2026-08-03 (Vini): accepting a trade updated BOTH squads via
-- two independent client-side UPDATEs (see respondTradeOffer in
-- useCloud.js). "fs update" RLS only allows participant_id =
-- my_player_id(), so the accepter's own client can update their OWN
-- squad but the OTHER participant's squad update is silently filtered
-- to 0 rows by RLS (no error surfaced) — the trade half-applies: the
-- accepter's squad gets the incoming player appended (sometimes
-- duplicated, since there was also no "already owns it" check) while
-- the counterparty never actually loses/gains anything.
--
-- Fix: apply both sides of an accepted trade inside one security-definer
-- function — atomic (one transaction), authorized by re-checking the
-- caller is the offer's to_participant and the offer is still pending
-- (claimed via a single UPDATE ... WHERE status = 'pending', so two
-- concurrent accepts can't both apply), and defensively de-duplicated
-- regardless of what the client computed.
-- ─────────────────────────────────────────────────────────

create or replace function public.accept_fantasy_trade(
  p_offer_id uuid,
  p_buyer_player_ids uuid[],
  p_buyer_budget_adjustment numeric,
  p_buyer_prices_paid jsonb,
  p_seller_player_ids uuid[],
  p_seller_budget_adjustment numeric,
  p_seller_prices_paid jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.fantasy_trade_offers;
  v_buyer_squad public.fantasy_squads;
  v_seller_squad public.fantasy_squads;
  v_buyer_ids uuid[];
  v_seller_ids uuid[];
begin
  -- Atomically claim the offer: only while pending, only by the
  -- participant it was sent to. 0 rows back means someone else already
  -- resolved it (or the caller isn't the recipient) — abort either way.
  update public.fantasy_trade_offers
  set status = 'accepted', resolved_at = now()
  where id = p_offer_id
    and status = 'pending'
    and to_participant_id = public.my_player_id()
  returning * into v_offer;

  if v_offer.id is null then
    raise exception 'Esta oferta já não está disponível.';
  end if;

  select * into v_buyer_squad from public.fantasy_squads
    where league_id = v_offer.league_id and participant_id = v_offer.from_participant_id;
  select * into v_seller_squad from public.fantasy_squads
    where league_id = v_offer.league_id and participant_id = v_offer.to_participant_id;

  if v_buyer_squad.id is null or v_seller_squad.id is null then
    raise exception 'Escalação não encontrada.';
  end if;

  select coalesce(array_agg(distinct id), '{}') into v_buyer_ids from unnest(p_buyer_player_ids) id;
  select coalesce(array_agg(distinct id), '{}') into v_seller_ids from unnest(p_seller_player_ids) id;

  update public.fantasy_squads set
    player_ids = v_buyer_ids,
    budget_adjustment = p_buyer_budget_adjustment,
    prices_paid = p_buyer_prices_paid,
    updated_at = now()
  where id = v_buyer_squad.id;

  update public.fantasy_squads set
    player_ids = v_seller_ids,
    budget_adjustment = p_seller_budget_adjustment,
    prices_paid = p_seller_prices_paid,
    updated_at = now()
  where id = v_seller_squad.id;
end;
$$;

grant execute on function public.accept_fantasy_trade(uuid, uuid[], numeric, jsonb, uuid[], numeric, jsonb) to authenticated;
