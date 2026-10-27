export default function sysmsg(hooks, push) {
// системное сообщение о заказе в общий чат пары (чтобы история заказа и чата была единой)
hooks.sysMsg = async (c, orderId, evName, actorId) => {
  const { rows: [o] } = await c.query("select o.id,o.number,o.buyer_id,o.seller_id,o.listing_id,l.title,b.username bn,s.username sn from orders o join listings l on l.id=o.listing_id join users b on b.id=o.buyer_id join users s on s.id=o.seller_id where o.id=$1", [orderId]); if (!o) return null;
  const T = {
    paid: `Заказ #${o.number} оплачен покупателем ${o.bn}. ${o.title}. ${o.sn}, выдайте товар. ${o.bn}, после получения нажмите «Подтвердить выполнение заказа».`,
    in_progress: `Продавец ${o.sn} приступил к выполнению заказа #${o.number}.`,
    completed: `${o.bn} подтвердил выполнение заказа #${o.number}. Деньги переведены продавцу ${o.sn}.`,
    cancelled: `Заказ #${o.number} отменён.`,
    dispute: `По заказу #${o.number} открыт спор. Модератор подключится и увидит переписку в этом чате.`,
    resolved_buyer: `Спор по заказу #${o.number} решён в пользу покупателя ${o.bn}. Деньги возвращены на его баланс.`,
    resolved_seller: `Спор по заказу #${o.number} решён в пользу продавца ${o.sn}. Деньги переведены продавцу.`,
    closed: `Спор по заказу #${o.number} закрыт модератором.`,
  }[evName]; if (!T) return null;
  let { rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [o.buyer_id, o.seller_id]);
  if (!cv) { await c.query("insert into conversations(listing_id,buyer_id,seller_id) values(null,$1,$2) on conflict do nothing", [o.buyer_id, o.seller_id]); ({ rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [o.buyer_id, o.seller_id])); }
  const { rows: [m] } = await c.query("insert into messages(conversation_id,sender_id,body,listing_id,kind,order_id,ev) values($1,$2,$3,$4,'system',$5,$6) returning id,conversation_id,sender_id,body,created_at,listing_id,kind,order_id", [cv.id, actorId || o.buyer_id, T, o.listing_id, o.id, evName]);
  m.lot_title = o.title; m.sender_name = "Система"; m._to = [o.buyer_id, o.seller_id]; return m;
};
hooks.pushSys = m => { if (m) for (const u of m._to) push(u, { ...m, _to: undefined }); };
}
