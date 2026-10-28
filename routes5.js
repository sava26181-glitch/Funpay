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
  hooks.move = move;
  // ТЕСТОВЫЕ комиссии (пока баланс тестовый): с продажи и при выводе. Меняются переменными окружения.
  const FEE_SALE = () => Math.min(50, Math.max(0, +(process.env.SALE_FEE_PCT ?? 7.5))), FEE_WD = () => Math.min(50, Math.max(0, +(process.env.WITHDRAW_FEE_PCT ?? 3))), FEE_DISC = 3;
  const salePct = async (c, uid) => { const { rows: [d] } = await c.query("select fee_until from duel_boosts where user_id=$1 and fee_until>now()", [uid]); return { pct: Math.max(0, FEE_SALE() - (d ? FEE_DISC : 0)), until: d?.fee_until || null } };
  // ---- промокоды: создаёт владелец, скидку оплачивает площадка (продавец получает полную сумму минус комиссию)
  const OWN = wrap(async (req, _res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); if (u?.role !== "owner") throw E(403, "owner only"); next(); });
  async function promoCheck(c, pid, uid, orderId, gross) {
    const { rows: [p] } = await c.query("select * from promo_codes where id=$1 for update", [pid]); if (!p || !p.active) return "inactive";
    if (p.expires_at && new Date(p.expires_at) < new Date()) return "expired"; if (p.max_uses != null && p.uses >= p.max_uses) return "limit";
    const { rows: [n] } = await c.query("select count(*)::int n from promo_uses where promo_id=$1 and user_id=$2 and order_id<>$3", [pid, uid, orderId]); if (n.n >= p.per_user) return "used";
    if (gross < Number(p.min_order_cents)) return "min_order"; if (p.max_order_cents != null && gross > Number(p.max_order_cents)) return "max_order"; return null;
  }
  const discOf = (p, gross) => { let d = p.kind === "percent" ? Math.floor(gross * Number(p.value) / 100) : Math.round(Number(p.value) * 100); if (p.max_discount_cents != null) d = Math.min(d, Number(p.max_discount_cents)); return Math.max(0, Math.min(d, gross - 100 >= 100 ? gross - 100 : gross - 1)) };
  const PERR = { inactive: "Промокод не найден или отключён", expired: "Срок промокода истёк", limit: "Промокод уже использован максимальное число раз", used: "Вы уже использовали этот промокод", min_order: "Сумма заказа меньше минимальной для этого промокода", max_order: "Сумма заказа больше допустимой для этого промокода" };
  app.post("/api/orders/:id/promo", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found"); const code = String(req.body?.code || "").trim().toUpperCase();
    const out = await tx(async c => {
      const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]); if (!o || o.buyer_id !== req.user.id) throw E(404, "not found");
      if (o.status !== "pending_payment") throw E(409, "order is not awaiting payment"); if (o.partner_id) throw E(409, "promo is not available for group orders");
      const gross = Number(o.unit_price_cents) * o.quantity;
      if (!code) { await c.query("update orders set total_cents=$2,discount_cents=0,promo_id=null where id=$1", [o.id, gross]); return { discount_cents: 0 }; }
      const { rows: [p] } = await c.query("select * from promo_codes where code=$1", [code]); if (!p) throw E(404, PERR.inactive);
      const bad = await promoCheck(c, p.id, req.user.id, o.id, gross); if (bad) throw E(409, PERR[bad]);
      const d = discOf(p, gross); if (d <= 0) throw E(409, "Скидка по этому промокоду для заказа равна нулю");
      await c.query("update orders set total_cents=$2,discount_cents=$3,promo_id=$4 where id=$1", [o.id, gross - d, d, p.id]); return { discount_cents: d, code };
    });
    res.json(out);
  }));
  app.get("/api/admin/promos", need, OWN, wrap(async (_req, res) => res.json(await q("select id,code,kind,value::float value,max_discount_cents::float max_discount_cents,min_order_cents::float min_order_cents,max_order_cents::float max_order_cents,max_uses,uses,per_user,expires_at,active,created_at from promo_codes order by created_at desc limit 100"))));
  app.post("/api/admin/promos", need, OWN, wrap(async (req, res) => {
    const b = req.body || {}, code = String(b.code || "").trim().toUpperCase(), kind = b.kind === "fixed" ? "fixed" : "percent", val = money(b.value);
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw E(400, "Код: 3–32 символа, латиница, цифры, - и _"); if (!(val > 0) || (kind === "percent" && val > 100)) throw E(400, "Размер скидки указан неверно");
    const cents = v => v === "" || v == null ? null : Math.round(Number(v) * 100), mx = cents(b.max_discount), mn = cents(b.min_order) ?? 0, mo = cents(b.max_order), uses = b.max_uses === "" || b.max_uses == null ? null : Math.floor(+b.max_uses), per = Math.max(1, Math.floor(+b.per_user || 1)), days = +b.days > 0 ? +b.days : null;
    for (const v of [mx, mo]) if (v != null && !(v > 0)) throw E(400, "Лимиты должны быть больше нуля"); if (uses != null && !(uses > 0)) throw E(400, "Лимит использований должен быть больше нуля");
    try { const [p] = await q("insert into promo_codes(code,kind,value,max_discount_cents,min_order_cents,max_order_cents,max_uses,per_user,expires_at,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,case when $9::float is null then null else now()+($9::float||' days')::interval end,$10) returning id", [code, kind, val, mx, mn, mo, uses, per, days, req.user.id]); res.status(201).json(p); }
    catch (e) { if (e.code === "23505" || /unique/i.test(e.message)) throw E(409, "Такой промокод уже есть"); throw e; }
  }));
  app.patch("/api/admin/promos/:id", need, OWN, wrap(async (req, res) => { if (!uuid(req.params.id)) throw E(404, "not found"); await q("update promo_codes set active=$2 where id=$1", [req.params.id, req.body?.active === true]); res.json({ ok: true }); }));
  app.delete("/api/admin/promos/:id", need, OWN, wrap(async (req, res) => { if (!uuid(req.params.id)) throw E(404, "not found"); await q("delete from promo_codes where id=$1", [req.params.id]); res.json({ ok: true }); }));
  app.get("/api/fees", wrap(async (req, res) => {
    const base = FEE_SALE(); let my = base, until = null; if (req.user) { const r = await salePct({ query: pool.query.bind(pool) }, req.user.id); my = r.pct; until = r.until }
    res.json({ sale_pct: base, my_sale_pct: my, discount_until: until, withdraw_pct: FEE_WD(), test: TEST() });
  }));
  hooks.settleOrder = async (c, o, to) => { // выплата продавцу или возврат покупателю, один раз на заказ
    if (!o || o.payment_status !== "confirmed") return false;
    const key = "settle:" + o.id; let fee = 0;
    const gross = Number(o.total_cents) + Number(o.discount_cents || 0); // скидку по промокоду оплачивает площадка
    if (to !== "buyer") { const { pct } = await salePct(c, o.seller_id); fee = Math.round(gross * pct / 100) }
    const amt = (gross - fee) / 100, ref = o.total_cents / 100;
    const done = to === "buyer" ? await move(c, o.buyer_id, "refund", ref, "order", o.id, key) : await move(c, o.seller_id, "order_payout", amt, "order", o.id, key);
    if (done && to === "buyer") await c.query("update orders set payment_status='refunded',updated_at=now() where id=$1", [o.id]);
    if (done && to !== "buyer") await c.query("update orders set fee_cents=$2 where id=$1", [o.id, fee]);
    if (done) await c.query("insert into notifications(user_id,type,payload) values($1,$2,$3)", [to === "buyer" ? o.buyer_id : o.seller_id, to === "buyer" ? "order_refund" : "order_payout", { order_id: o.id, number: o.number, amount: to === "buyer" ? ref : amt, fee: fee / 100 }]);
    return done;
  };
  app.get("/api/finance", need, wrap(async (req, res) => {
    const type = String(req.query.type || "all"), [w] = await q("select balance from wallets where user_id=$1", [req.user.id]);
    const f = { in: "l.amount>0", out: "l.amount<0 and l.kind<>'withdraw'", withdraw: "l.kind in ('withdraw','withdraw_refund')", all: "true" }[type] || "true";
    const ops = await q(`select l.id,l.kind,l.amount,l.created_at,l.ref_type,l.ref_id,o.number order_number,w.status w_status from ledger_entries l left join orders o on l.ref_type='order' and o.id::text=l.ref_id left join withdrawals w on l.ref_type='withdrawal' and w.id::text=l.ref_id where l.user_id=$1 and ${f} order by l.id desc limit 100`, [req.user.id]);
    const [tt] = await q("select coalesce(sum(amount) filter (where amount>0),0) inn,coalesce(-sum(amount) filter (where amount<0 and kind<>'withdraw'),0) outt from ledger_entries where user_id=$1", [req.user.id]), [pw] = await q("select coalesce(sum(amount),0) s from withdrawals where user_id=$1 and status='pending'", [req.user.id]);
    res.json({ totals: { in: Number(tt.inn), out: Number(tt.outt), pending: Number(pw.s) }, balance: Number(w?.balance || 0), test_mode: TEST(), ops: ops.map(x => ({ ...x, amount: Number(x.amount) })) });
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
      const fee = Math.round(a * FEE_WD()) / 100, { rows: [w] } = await c.query("insert into withdrawals(user_id,amount,method,details,fee) values($1,$2,$3,$4,$5) returning id", [req.user.id, a, method, det, fee]);
      await move(c, req.user.id, "withdraw", -a, "withdrawal", w.id, null); return w;
    });
    res.status(201).json({ id: r.id });
  }));
  app.post("/api/orders/:id/pay-balance", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const paid = await tx(async c => {
      const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]);
      if (!o || o.buyer_id !== req.user.id) throw E(404, "not found"); if (o.status !== "pending_payment") throw E(409, "order is not awaiting payment"); if (o.partner_id) throw E(409, "balance payment is not available for group orders yet");
      if (o.promo_id) { const bad = await promoCheck(c, o.promo_id, o.buyer_id, o.id, Number(o.total_cents) + Number(o.discount_cents)); if (bad) throw E(409, "Промокод больше не действует: " + PERR[bad] + ". Уберите его и оплатите снова"); await c.query("insert into promo_uses(promo_id,user_id,order_id,discount_cents) values($1,$2,$3,$4) on conflict do nothing", [o.promo_id, o.buyer_id, o.id, o.discount_cents]); await c.query("update promo_codes set uses=uses+1 where id=$1", [o.promo_id]); }
      const { rows: [al] } = await c.query("select auto_delivery,auto_items from listings where id=$1 for update", [o.listing_id]);
      if (al?.auto_delivery && (al.auto_items || []).length < o.quantity) throw E(409, "Товар закончился: продавец ещё не пополнил автовыдачу");
      await move(c, o.buyer_id, "order_payment", -(o.total_cents / 100), "order", o.id, "pay:" + o.id);
      await c.query("update orders set status='paid',payment_status='confirmed',updated_at=now() where id=$1", [o.id]);
      await c.query("insert into order_events(order_id,status,actor_id) values($1,'paid',$2)", [o.id, req.user.id]);
      const { rows: [l] } = await c.query("update listings set status=case when deactivate_on_sale and seller_id<>$2 then 'archived' else status end where id=$1 returning title", [o.listing_id, o.buyer_id]);
      const { rows: [n] } = await c.query("insert into notifications(user_id,type,payload) values($1,'order_paid',$2) returning id,payload", [o.seller_id, { order_id: o.id, number: o.number, title: l?.title || "", amount: o.total_cents / 100 }]);
      const msg = await hooks.sysMsg(c, o.id, "paid", o.buyer_id);
      let auto = null;
      if (al?.auto_delivery) {
        const take = al.auto_items.slice(0, o.quantity), rest = al.auto_items.slice(o.quantity);
        await c.query("update listings set auto_items=$2,stock=$3 where id=$1", [o.listing_id, rest.length ? rest : null, rest.length]);
        await c.query("update orders set delivered=$2 where id=$1", [o.id, take.join("\n")]);
        auto = await hooks.autoMsg(c, o.id, msg?.conversation_id, `Автовыдача, заказ #${o.number}\n` + take.join("\n"));
      }
      return { seller: o.seller_id, buyer: o.buyer_id, n, number: o.number, conv: msg?.conversation_id, msg, auto };
    });
    try { pushUser?.(paid.seller, "notify", { id: paid.n.id, type: "order_paid", ...paid.n.payload }); } catch {}
    try { hooks.pushSys?.(paid.msg); hooks.pushSys?.(paid.auto); } catch {}
    res.json({ ok: true, number: paid.number, conversation: paid.conv });
  }));
  // выплаты: заявки обрабатывает администратор вручную
  app.get("/api/admin/withdrawals", need, adm, wrap(async (_req, res) => res.json(await q("select w.id,w.amount,w.fee,w.method,w.details,w.status,w.note,w.created_at,u.username from withdrawals w join users u on u.id=w.user_id order by (w.status='pending') desc, w.created_at desc limit 100"))));
  app.post("/api/admin/withdrawals/:id", need, adm, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found"); const act = req.body?.action, note = String(req.body?.note || "").slice(0, 300);
    if (!["paid", "reject", "processing"].includes(act)) throw E(400, "bad action");
    await tx(async c => {
      const { rows: [w] } = await c.query("select * from withdrawals where id=$1 for update", [req.params.id]); if (!w) throw E(404, "not found"); if (!["pending", "processing"].includes(w.status)) throw E(409, "already processed");
      if (act === "processing") { await c.query("update withdrawals set status='processing' where id=$1", [w.id]); await c.query("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,'withdrawal',$3,$4)", [req.user.id, "withdrawal_processing", w.id, { amount: w.amount }]); return; }
      await c.query("update withdrawals set status=$2,note=$3,resolved_at=now(),resolved_by=(select id from users where id=$4) where id=$1", [w.id, act === "paid" ? "paid" : "rejected", note, req.user.id]);
      if (act === "reject") await move(c, w.user_id, "withdraw_refund", Number(w.amount), "withdrawal", w.id, "wdr:" + w.id);
      await c.query("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,'withdrawal',$3,$4)", [req.user.id, "withdrawal_" + act, w.id, { amount: w.amount }]);
    });
    res.json({ ok: true });
  }));
}
