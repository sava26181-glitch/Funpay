// отзывы: создание, правка, удаление, ответ продавца. Каждое действие даёт системное сообщение в общий чат и уведомление второй стороне.
export default function routes7(app, { q, tx, E, wrap, need, hooks, pushUser }) {
  const uuid = s => /^[0-9a-f-]{36}$/i.test(String(s));
  const clean = v => String(v ?? "").trim().slice(0, 1000);
  const note = async (c, uid, type, payload) => (await c.query("insert into notifications(user_id,type,payload) values($1,$2,$3) returning id,payload", [uid, type, payload])).rows[0];
  const fin = async (c, o, evName, actor, to, type, extra = {}) => {
    const msg = await hooks.sysMsg?.(c, o.id, evName, actor);
    const n = await note(c, to, type, { order_id: o.id, number: o.number, title: o.title || "", ...extra });
    return { msg, n, to, type, extra };
  };
  const push = r => { try { pushUser?.(r.to, "notify", { id: r.n.id, type: r.type, ...r.n.payload }); } catch {} try { hooks.pushSys?.(r.msg); } catch {} };
  const loadOrder = async (c, id) => (await c.query("select o.*,l.title from orders o join listings l on l.id=o.listing_id where o.id=$1 for update of o", [id])).rows[0];
  const buyerOrd = async (c, id, uid) => { if (!uuid(id)) throw E(404, "not found"); const o = await loadOrder(c, id); if (!o || o.buyer_id !== uid) throw E(404, "not found"); return o };
  const rating = v => { const r = +v; if (!Number.isInteger(r) || r < 1 || r > 5) throw E(400, "Оценка от 1 до 5"); return r };
  app.post("/api/orders/:id/review", need, wrap(async (req, res) => {
    const r = rating(req.body?.rating), out = await tx(async c => {
      const o = await buyerOrd(c, req.params.id, req.user.id); if (o.status !== "completed") throw E(409, "Отзыв можно оставить после завершения заказа");
      if ((await c.query("select 1 from reviews where order_id=$1", [o.id])).rows.length) throw E(409, "Вы уже оставили отзыв");
      await c.query("insert into reviews(order_id,reviewer_id,seller_id,rating,body) values($1,$2,$3,$4,$5)", [o.id, req.user.id, o.seller_id, r, clean(req.body?.body)]);
      return fin(c, o, "review", req.user.id, o.seller_id, "review", { rating: r });
    });
    push(out); res.status(201).json({ ok: true });
  }));
  app.patch("/api/orders/:id/review", need, wrap(async (req, res) => {
    const r = rating(req.body?.rating), out = await tx(async c => {
      const o = await buyerOrd(c, req.params.id, req.user.id);
      const u = await c.query("update reviews set rating=$2,body=$3,edited_at=now() where order_id=$1 returning id", [o.id, r, clean(req.body?.body)]); if (!u.rows.length) throw E(404, "Отзыва нет");
      return fin(c, o, "review_edit", req.user.id, o.seller_id, "review_edit", { rating: r });
    });
    push(out); res.json({ ok: true });
  }));
  app.delete("/api/orders/:id/review", need, wrap(async (req, res) => {
    const out = await tx(async c => {
      const o = await buyerOrd(c, req.params.id, req.user.id);
      const d = await c.query("delete from reviews where order_id=$1 returning id", [o.id]); if (!d.rows.length) throw E(404, "Отзыва нет");
      return fin(c, o, "review_delete", req.user.id, o.seller_id, "review_delete");
    });
    push(out); res.json({ ok: true });
  }));
  const sellerOrd = async (c, id, uid) => { if (!uuid(id)) throw E(404, "not found"); const o = await loadOrder(c, id); if (!o || o.seller_id !== uid) throw E(404, "not found"); return o };
  app.post("/api/orders/:id/review/reply", need, wrap(async (req, res) => {
    const body = clean(req.body?.body); if (body.length < 2) throw E(400, "Напишите ответ");
    const out = await tx(async c => {
      const o = await sellerOrd(c, req.params.id, req.user.id);
      const { rows: [r] } = await c.query("select reply from reviews where order_id=$1 for update", [o.id]); if (!r) throw E(404, "Отзыва нет");
      await c.query("update reviews set reply=$2,reply_at=now() where order_id=$1", [o.id, body]);
      return fin(c, o, r.reply ? "review_reply_edit" : "review_reply", req.user.id, o.buyer_id, "review_reply");
    });
    push(out); res.json({ ok: true });
  }));
  app.delete("/api/orders/:id/review/reply", need, wrap(async (req, res) => {
    const out = await tx(async c => {
      const o = await sellerOrd(c, req.params.id, req.user.id);
      const u = await c.query("update reviews set reply=null,reply_at=null where order_id=$1 and reply is not null returning id", [o.id]); if (!u.rows.length) throw E(404, "Ответа нет");
      return fin(c, o, "review_reply_delete", req.user.id, o.buyer_id, "review_reply_delete");
    });
    push(out); res.json({ ok: true });
  }));
}
