// v17: последний визит, блокировка с экраном причины, статусы заказов (отмена, подтверждение при споре), счётчики для персонала, поиск соперника в дуэлях
import wf from "./wordfilter.js";
export default function routes8(app, { q, pool, tx, E, wrap, need, hooks, pushUser, online, notifyStaff }) {
  const uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
  const seenAt = new Map(), blk = new Map();

  // ---- последний визит (раз в минуту) и блокировка аккаунта: заблокированный видит только экран с причиной
  const OPEN = new Set(["/api/me", "/api/auth/logout", "/api/auth/login", "/api/site-config", "/api/stream"]);
  app.use("/api", wrap(async (req, res, next) => {
    if (!req.user) return next();
    const now = Date.now();
    if (now - (seenAt.get(req.user.id) || 0) > 60000) { seenAt.set(req.user.id, now); if (seenAt.size > 20000) seenAt.clear(); pool.query("update users set last_seen=now() where id=$1", [req.user.id]).catch(() => { }); }
    if (OPEN.has(req.path === "/" ? "/api" : "/api" + req.path)) return next();
    let b = blk.get(req.user.id); if (!b || now - b.t > 15000) { const [u] = await q("select username,blocked_until,block_reason,block_hours from users where id=$1", [req.user.id]); b = { t: now, u }; blk.set(req.user.id, b); if (blk.size > 5000) blk.clear(); }
    if (b.u?.blocked_until && new Date(b.u.blocked_until) > new Date()) return res.status(403).json({ error: "account blocked", blocked_until: b.u.blocked_until, block_reason: b.u.block_reason, block_hours: b.u.block_hours, username: b.u.username });
    next();
  }));
  app.post("/api/admin/users/:id/block", (req, _res, next) => { blk.clear(); next(); });
  app.post("/api/admin/users/:id/unblock", (req, _res, next) => { blk.clear(); next(); });

  app.get("/api/lastseen", wrap(async (req, res) => {
    const names = String(req.query.names || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 60);
    const us = await q("select id,username,last_seen from users where username=any($1)", [names]);
    res.json(Object.fromEntries(us.map(u => [u.username, { on: online(u.id), at: u.last_seen }])));
  }));

  // ---- статусы заказа
  app.post("/api/orders/:id/status", need, wrap(async (req, res) => {
    const to = req.body?.status; if (!["cancelled", "in_progress", "completed"].includes(to)) throw E(400, "status not allowed");
    if (!uuid(req.params.id)) throw E(404, "not found");
    res.json(await tx(async c => {
      const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]); const uid = req.user.id;
      if (!o || ![o.buyer_id, o.seller_id, o.partner_id].includes(uid)) throw E(404, "not found");
      const isBuyer = uid === o.buyer_id, isSeller = uid === o.seller_id;
      let refund = false, closeDispute = false;
      if (to === "in_progress") { if (!isSeller || o.status !== "paid") throw E(409, "transition not allowed"); }
      else if (to === "completed") { if (!isBuyer || !["paid", "in_progress", "dispute"].includes(o.status)) throw E(409, "transition not allowed"); closeDispute = o.status === "dispute"; }
      else { // cancelled
        if (o.status === "pending_payment") { /* отменить может любой участник */ }
        else if (["paid", "in_progress"].includes(o.status) && isSeller) refund = true;
        else throw E(409, "transition not allowed");
      }
      await c.query("update orders set status=$2,updated_at=now() where id=$1", [o.id, to]);
      await c.query("insert into order_events(order_id,status,actor_id) values($1,$2,$3)", [o.id, to, uid]);
      if (closeDispute) await c.query("update disputes set status='closed',resolution=$2 where order_id=$1 and status in ('open','in_review','awaiting_info')", [o.id, "Покупатель подтвердил выполнение заказа, спор закрыт"]);
      if (closeDispute) await hooks.releaseHold?.(c, o.id);
      if (to === "completed") await hooks.settleOrder?.(c, o, "seller");
      if (refund) await hooks.settleOrder?.(c, o, "buyer");
      hooks.pushSys?.(await hooks.sysMsg?.(c, o.id, to, uid));
      return { ok: true };
    }));
  }));

  app.get("/api/orders/by-number/:n", need, wrap(async (req, res) => {
    const n = String(req.params.n || "").replace(/^#/, "").slice(0, 16);
    const [o] = await q("select id from orders where upper(number)=upper($1) and $2 in (buyer_id,seller_id,partner_id)", [n, req.user.id]); if (!o) throw E(404, "not found"); res.json({ id: o.id });
  }));

  // ---- показ ачивок в профиле (по желанию владельца)
  app.patch("/api/me/badges", need, wrap(async (req, res) => { await q("update users set show_badges=$2 where id=$1", [req.user.id, req.body?.show !== false]); res.json({ ok: true, show_badges: req.body?.show !== false }); }));

  // ---- что сейчас смотрит собеседник: видно только продавцу и только его лоты
  const viewing = new Map();
  app.post("/api/viewing", need, wrap(async (req, res) => {
    const id = req.body?.listingId; if (!id) { viewing.delete(req.user.id); return res.json({ ok: true }); } if (!uuid(id)) throw E(400, "invalid input");
    const [l] = await q("select id,title,seller_id from listings where id=$1", [id]); if (l) viewing.set(req.user.id, { id: l.id, title: l.title, seller: l.seller_id, at: Date.now() }); if (viewing.size > 20000) viewing.clear();
    res.json({ ok: true });
  }));
  app.get("/api/viewing", need, wrap(async (req, res) => {
    const [o] = await q("select id from users where username=$1", [String(req.query.username || "")]); if (!o) return res.json({ live: null, last: null });
    const [cv] = await q("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [req.user.id, o.id]); if (!cv) return res.json({ live: null, last: null });
    const v = viewing.get(o.id), live = v && Date.now() - v.at < 90000 && v.seller === req.user.id ? { id: v.id, title: v.title } : null;
    const [last] = await q("select l.id,l.title from messages m join listings l on l.id=m.listing_id where m.conversation_id=$1 and m.listing_id is not null and l.seller_id=$2 order by m.created_at desc limit 1", [cv.id, req.user.id]);
    res.json({ live, last: last || null });
  }));

  // ---- счётчики «сколько проверить» для персонала
  app.get("/api/admin/counts", need, wrap(async (req, res) => {
    const [me] = await q("select role from users where id=$1", [req.user.id]); if (!["moderator", "admin", "owner"].includes(me?.role)) throw E(403, "forbidden");
    const adm = ["admin", "owner"].includes(me.role);
    const [r] = await q(`select
      (select count(*) from listings where status='pending')::int listings,
      (select count(*) from disputes where status in ('open','in_review','awaiting_info'))::int disputes,
      (select count(*) from tickets where status in ('new','in_review'))::int tickets,
      (select count(*) from orders where status='dispute')::int orders,
      ${adm ? "(select count(*) from withdrawals where status in ('pending','processing'))::int" : "0"} withdrawals`);
    res.json(r);
  }));

  // ---- дуэли: кто ищет соперника и прямое присоединение
  const busyQ = "select 1 from duels d where $1 in(d.seller_a,d.seller_b) and (d.status='live' or d.starts_at>now()-interval '24 hours')";
  app.get("/api/duels/queue", wrap(async (req, res) => {
    const uid = req.user?.id || null;
    const rows = await q(`select dq.user_id,u.username,u.avatar_media,dq.game_id,g.name game_name,dq.category_id,c.name category_name,dq.joined_at,coalesce(r.rating,1000) rating,
      (u.blocked_until is null or u.blocked_until<now()) ok,
      case when $1::uuid is null then false else exists(select 1 from listings l where l.seller_id=$1 and l.category_id=dq.category_id and l.game_id=dq.game_id and l.status='active' and l.stock>0) end can_lot
      from duel_queue dq join users u on u.id=dq.user_id join games g on g.id=dq.game_id join categories c on c.id=dq.category_id left join duel_rating r on r.user_id=dq.user_id
      where dq.game_id is not null and dq.joined_at>now()-interval '12 hours' order by dq.joined_at limit 40`, [uid]);
    let myBusy = false, seller = false; if (uid) { myBusy = !!(await q(busyQ, [uid])).length; seller = !!(await q("select 1 from users u join seller_codes sc on sc.user_id=u.id and sc.revoked_at is null where u.id=$1 and u.is_seller", [uid])).length; }
    res.json(rows.filter(x => x.ok).map(x => ({ user_id: x.user_id, username: x.username, avatar_media: x.avatar_media, game_id: x.game_id, game_name: x.game_name, category_id: x.category_id, category_name: x.category_name, since: x.joined_at, rating: x.rating, mine: x.user_id === uid, can_join: !!uid && seller && !myBusy && x.user_id !== uid && x.can_lot })));
  }));
  app.post("/api/duels/join", need, wrap(async (req, res) => {
    const target = req.body?.userId; if (!uuid(target) || target === req.user.id) throw E(400, "invalid input");
    const out = await tx(async c => {
      await c.query("select pg_advisory_xact_lock(515151)");
      const { rows: [t] } = await c.query("select * from duel_queue where user_id=$1 and game_id is not null for update", [target]); if (!t) throw E(404, "Соперник уже не ищет дуэль");
      const { rows: [s] } = await c.query("select 1 from users u join seller_codes sc on sc.user_id=u.id and sc.revoked_at is null where u.id=$1 and u.is_seller", [req.user.id]); if (!s) throw E(403, "sign seller code first");
      const { rows: [has] } = await c.query("select 1 from listings where seller_id=$1 and category_id=$2 and game_id=$3 and status='active' and stock>0 limit 1", [req.user.id, t.category_id, t.game_id]); if (!has) throw E(409, "need active listing in this game and category");
      for (const u of [req.user.id, target]) { const { rows: [b] } = await c.query(busyQ, [u]); if (b) throw E(409, "duel limit: one per 24h"); }
      const { rows: rs } = await c.query("select user_id,rating from duel_rating where user_id in($1,$2)", [req.user.id, target]); const rt = id => rs.find(x => x.user_id === id)?.rating ?? 1000;
      const { rows: [d] } = await c.query("insert into duels(game_id,category_id,seller_a,seller_b,ends_at,rating_a,rating_b) values($1,$2,$3,$4,now()+interval '24 hours',$5,$6) returning id", [t.game_id, t.category_id, target, req.user.id, rt(target), rt(req.user.id)]);
      await c.query("delete from duel_queue where user_id in($1,$2)", [req.user.id, target]);
      return d;
    });
    for (const u of [req.user.id, target]) { try { pushUser?.(u, "notify", { type: "duel_start" }) } catch { } }
    res.json({ ok: true, id: out.id });
  }));

  // ---- автопроверка лотов: ранее «на модерации» лоты без запрещённых слов публикуются, помеченные остаются у модератора
  (async () => {
    try {
      const rows = await q("select id,title,summary,details,attrs from listings where status='pending'");
      let ok = 0;
      for (const l of rows) { const f = wf(l.title, l.summary, l.details, Object.values(l.attrs || {})); if (f) await q("update listings set mod_reason=coalesce(mod_reason,$2) where id=$1", [l.id, "Автопроверка: " + f]); else { await q("update listings set status='active' where id=$1", [l.id]); ok++; } }
      if (rows.length) console.log("[v17] лотов опубликовано автоматически:", ok, "оставлено модератору:", rows.length - ok);
    } catch (e) { console.error("[v17] автопроверка:", e.message); }
  })();
}
