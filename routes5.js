// v8: финансы. ВАЖНО: пока это тестовый баланс без реальных платежей.
export default function routes5(app, { q, pool, tx, E, wrap, need, hooks, pushUser }) {
  const AD = ["admin", "owner"], TEST = () => String(process.env.TEST_BALANCE || "on").toLowerCase() !== "off";
  const uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
  const money = v => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) ? n : NaN };
  const adm = wrap(async (req, _res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); if (!u || !AD.includes(u.role)) throw E(403, "forbidden"); req.role = u.role; next(); });
  // проводка: запись в журнал + изменение баланса. Журнал только дописывается.
  const move = async (c, uid, kind, amount, refType, refId, evid) => {
    await c.query("insert into wallets(user_id) values($1) on conflict do nothing", [uid]);
    const { rows: [l] } = await c.query("insert into ledger_entries(user_id,kind,amount,ref_type,ref_id,provider_event_id) values($1,$2,$3,$4,$5,$6) on conflict(provider_event_id) do nothing returning id", [uid, kind, amount, refType || null, refId || null, evid || null]);
    if (!l) return false;
    try { await c.query("update wallets set balance=balance+$2 where user_id=$1", [uid, amount]); } catch (e) { if (e.code === "23514" || /check constraint/.test(e.message)) throw E(409, "not enough funds"); throw e; }
    return true;
  };
  hooks.settleOrder = async (c, o, to) => { // выплата продавцу или возврат покупателю, один раз на заказ
    if (!o || o.payment_status !== "confirmed") return false;
    const amt = o.total_cents / 100, key = "settle:" + o.id;
    const done = to === "buyer" ? await move(c, o.buyer_id, "refund", amt, "order", o.id, key) : await move(c, o.seller_id, "order_payout", amt, "order", o.id, key);
    if (done && to === "buyer") await c.query("update orders set payment_status='refunded',updated_at=now() where id=$1", [o.id]);
    if (done) await c.query("insert into notifications(user_id,type,payload) values($1,$2,$3)", [to === "buyer" ? o.buyer_id : o.seller_id, to === "buyer" ? "order_refund" : "order_payout", { order_id: o.id, number: o.number, amount: amt }]);
    return done;
  };
  app.get("/api/finance", need, wrap(async (req, res) => {
    const type = String(req.query.type || "all"), [w] = await q("select balance from wallets where user_id=$1", [req.user.id]);
    const f = { in: "l.amount>0", out: "l.amount<0 and l.kind<>'withdraw'", withdraw: "l.kind in ('withdraw','withdraw_refund')", all: "true" }[type] || "true";
    const ops = await q(`select l.id,l.kind,l.amount,l.created_at,l.ref_type,l.ref_id,o.number order_number,w.status w_status from ledger_entries l left join orders o on l.ref_type='order' and o.id::text=l.ref_id left join withdrawals w on l.ref_type='withdrawal' and w.id::text=l.ref_id where l.user_id=$1 and ${f} order by l.id desc limit 100`, [req.user.id]);
    res.json({ balance: Number(w?.balance || 0), test_mode: TEST(), ops: ops.map(x => ({ ...x, amount: Number(x.amount) })) });
  }));
  app.post("/api/finance/topup", need, wrap(async (req, res) => {
    if (!TEST()) throw E(403, "test top-up disabled");
    const a = money(req.body?.amount); if (!(a >= 10 && a <= 50000)) throw E(400, "amount 10-50000");
    const [n] = await q("select count(*)::int n from ledger_entries where user_id=$1 and kind='test_topup' and created_at>now()-interval '1 hour'", [req.user.id]); if (n.n >= 20) throw E(429, "too many top-ups");
    await tx(c => move(c, req.user.id, "test_topup", a, "test", null, null)); res.status(201).json({ ok: true });
  }));
  app.post("/api/finance/withdraw", need, wrap(async (req, res) => {
    const a = money(req.body?.amount), method = String(req.body?.method || ""), det = String(req.body?.details || "").replace(/[\u0000-\u001f<>]/g, "").trim();
    if (!(a >= 10 && a <= 500000)) throw E(400, "amount 10-500000"); if (!["card", "sbp", "crypto", "other"].includes(method)) throw E(400, "bad method"); if (det.length < 3 || det.length > 200) throw E(400, "details 3-200 chars");
    const r = await tx(async c => {
      const { rows: [w] } = await c.query("insert into withdrawals(user_id,amount,method,details) values($1,$2,$3,$4) returning id", [req.user.id, a, method, det]);
      await move(c, req.user.id, "withdraw", -a, "withdrawal", w.id, null); return w;
    });
    res.status(201).json({ id: r.id });
  }));
  app.post("/api/orders/:id/pay-balance", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const paid = await tx(async c => {
      const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]);
      if (!o || o.buyer_id !== req.user.id) throw E(404, "not found"); if (o.status !== "pending_payment") throw E(409, "order is not awaiting payment"); if (o.partner_id) throw E(409, "balance payment is not available for group orders yet");
      await move(c, o.buyer_id, "order_payment", -(o.total_cents / 100), "order", o.id, "pay:" + o.id);
      await c.query("update orders set status='paid',payment_status='confirmed',updated_at=now() where id=$1", [o.id]);
      await c.query("insert into order_events(order_id,status,actor_id) values($1,'paid',$2)", [o.id, req.user.id]);
      const { rows: [l] } = await c.query("update listings set status=case when deactivate_on_sale and seller_id<>$2 then 'archived' else status end where id=$1 returning title", [o.listing_id, o.buyer_id]);
      const { rows: [n] } = await c.query("insert into notifications(user_id,type,payload) values($1,'order_paid',$2) returning id,payload", [o.seller_id, { order_id: o.id, number: o.number, title: l?.title || "", amount: o.total_cents / 100 }]);
      let { rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [o.buyer_id, o.seller_id]);
      if (!cv) { await c.query("insert into conversations(listing_id,buyer_id,seller_id) values(null,$1,$2) on conflict do nothing", [o.buyer_id, o.seller_id]); ({ rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [o.buyer_id, o.seller_id])); }
      const txt = `Заказ #${o.number} оплачен: ${l?.title || "лот"}${o.quantity > 1 ? " × " + o.quantity : ""}, ${(o.total_cents / 100).toLocaleString("ru-RU")} ₽. Деньги зарезервированы на сайте и перейдут вам после подтверждения получения. Жду выдачу товара.`;
      const { rows: [msg] } = await c.query("insert into messages(conversation_id,sender_id,body,listing_id) values($1,$2,$3,$4) returning id,conversation_id,sender_id,body,created_at,listing_id", [cv.id, o.buyer_id, txt, o.listing_id]); msg.lot_title = l?.title || "";
      return { seller: o.seller_id, buyer: o.buyer_id, n, number: o.number, conv: cv.id, msg };
    });
    try { pushUser?.(paid.seller, "notify", { id: paid.n.id, type: "order_paid", ...paid.n.payload }); } catch {}
    try { pushUser?.(paid.seller, "message", paid.msg); pushUser?.(paid.buyer, "message", paid.msg); } catch {}
    res.json({ ok: true, number: paid.number, conversation: paid.conv });
  }));
  // выплаты: заявки обрабатывает администратор вручную
  app.get("/api/admin/withdrawals", need, adm, wrap(async (_req, res) => res.json(await q("select w.id,w.amount,w.method,w.details,w.status,w.note,w.created_at,u.username from withdrawals w join users u on u.id=w.user_id order by (w.status='pending') desc, w.created_at desc limit 100"))));
  app.post("/api/admin/withdrawals/:id", need, adm, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found"); const act = req.body?.action, note = String(req.body?.note || "").slice(0, 300);
    if (!["paid", "reject"].includes(act)) throw E(400, "bad action");
    await tx(async c => {
      const { rows: [w] } = await c.query("select * from withdrawals where id=$1 for update", [req.params.id]); if (!w) throw E(404, "not found"); if (w.status !== "pending") throw E(409, "already processed");
      await c.query("update withdrawals set status=$2,note=$3,resolved_at=now(),resolved_by=$4 where id=$1", [w.id, act === "paid" ? "paid" : "rejected", note, req.user.id]);
      if (act === "reject") await move(c, w.user_id, "withdraw_refund", Number(w.amount), "withdrawal", w.id, "wdr:" + w.id);
      await c.query("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,'withdrawal',$3,$4)", [req.user.id, "withdrawal_" + act, w.id, { amount: w.amount }]);
    });
    res.json({ ok: true });
  }));
}
