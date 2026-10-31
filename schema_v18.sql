-- v18: заказы, у которых спор уже решён, не должны оставаться в статусе «спор»
update orders o set status = case (select d.status from disputes d where d.order_id=o.id order by d.created_at desc limit 1)
  when 'resolved_buyer' then 'cancelled'
  when 'resolved_seller' then 'completed'
  else coalesce((select oe.status from order_events oe where oe.order_id=o.id and oe.status in ('paid','in_progress','completed') order by oe.id desc limit 1),'in_progress') end,
  updated_at=now()
where o.status='dispute'
  and exists(select 1 from disputes d where d.order_id=o.id)
  and not exists(select 1 from disputes d where d.order_id=o.id and d.status in ('open','in_review','awaiting_info'));
