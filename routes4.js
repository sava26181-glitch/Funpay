// v4: новости, час распродажи, кодекс продавца, битвы магазинов, совместная покупка
export const CODE_VERSION = 1;
export const CODE_RULES = [
  { key: "no_scam", title: "Не обманывать", text: "Не брать оплату без выдачи товара и не пропадать после оплаты." },
  { key: "on_time", title: "Выдавать в срок", text: "Выдавать товар в срок, который указан в объявлении." },
  { key: "polite", title: "Отвечать вежливо", text: "Отвечать покупателям уважительно, без грубости и давления." }
];
import bcrypt from "bcryptjs"; import crypto from "crypto"; import rateLimit from "express-rate-limit";
export default function routes4(app, { q, pool, tx, E, wrap, need, pushUser, L, hooks = {}, setCookie }) {
  const ST = ["moderator", "admin", "owner"], AD = ["admin", "owner"];
  const staff = (...r) => wrap(async (req, _res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); if (!u || !r.includes(u.role)) throw E(403, "forbidden"); req.role = u.role; next(); });
  const audit = (a, act, tt, tid, d) => q("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,$3,$4,$5)", [a, act, tt, String(tid ?? ""), d || {}]).catch(() => {});
  const uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
  const codeOk = async uid => { const [c] = await q("select 1 from seller_codes where user_id=$1 and revoked_at is null", [uid]); return !!c; };

  // ---------- новости ----------
  app.get("/api/news", wrap(async (req, res) => {
    const lim = Math.min(30, Math.max(1, +req.query.limit || 10));
    res.json(await q("select n.id,n.title,n.body,n.media_ids,n.created_at,u.username author,(select count(*) from news_comments nc where nc.news_id=n.id)::int comments from news n left join users u on u.id=n.author_id order by n.created_at desc limit $1", [lim]));
  }));
  app.post("/api/admin/news", need, staff(...AD), wrap(async (req, res) => {
    const b = req.body || {}, title = String(b.title || "").trim(), body = String(b.body || "").trim();
    if (title.length < 3 || title.length > 120 || body.length > 4000) throw E(400, "invalid input");
    const ids = [...new Set((Array.isArray(b.media) ? b.media : []).filter(uuid))].slice(0, 6);
    if (ids.length) { const r = await q("select id from media where id=any($1) and owner_id=$2 and kind='news'", [ids, req.user.id]); if (r.length !== ids.length) throw E(400, "bad media"); }
    const [n] = await q("insert into news(author_id,title,body,media_ids) values($1,$2,$3,$4) returning id", [req.user.id, title, body, ids]);
    await audit(req.user.id, "news.create", "news", n.id, { title }); res.status(201).json(n);
  }));
  app.delete("/api/admin/news/:id", need, staff(...AD), wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    await q("delete from news where id=$1", [req.params.id]); await audit(req.user.id, "news.delete", "news", req.params.id); res.json({ ok: true });
  }));

  // ---------- кодекс продавца ----------
  const stateSql = "case when revoked_at is null then 'ok' else coalesce(mark,'violation') end";
  app.get("/api/seller-code", wrap(async (req, res) => {
    let mine = null;
    if (req.user) { const [c] = await q(`select ${stateSql} state,signed_at,revoked_at,reason from seller_codes where user_id=$1`, [req.user.id]); mine = c || null; }
    res.json({ version: CODE_VERSION, rules: CODE_RULES, mine });
  }));
  app.get("/api/seller-code/of/:username", wrap(async (req, res) => {
    const [c] = await q(`select ${stateSql} state,c.signed_at,c.revoked_at,c.reason from seller_codes c join users u on u.id=c.user_id where u.username=$1`, [req.params.username]);
    res.json(c || { state: null });
  }));
  app.post("/api/seller-code/sign", need, wrap(async (req, res) => {
    if (req.body?.agree !== true) throw E(400, "agree required");
    const [old] = await q("select revoked_at from seller_codes where user_id=$1", [req.user.id]);
    if (old?.revoked_at) throw E(409, "code burned");
    await tx(async c => {
      await c.query("insert into seller_codes(user_id,version) values($1,$2) on conflict(user_id) do nothing", [req.user.id, CODE_VERSION]);
      await c.query("update users set is_seller=true where id=$1", [req.user.id]);
    });
    res.json({ ok: true });
  }));
  const withUser = wrap(async (req, _res, next) => { if (!uuid(req.params.id)) throw E(404, "not found"); const [t] = await q("select id,role,username from users where id=$1", [req.params.id]); if (!t) throw E(404, "not found"); if (t.role !== "user" && req.role !== "owner") throw E(403, "cannot mark staff"); req.t = t; next(); });
  app.post("/api/admin/seller-code/:id/burn", need, staff(...ST), withUser, wrap(async (req, res) => {
    const reason = String(req.body?.reason || "").trim(); if (reason.length < 5 || reason.length > 500) throw E(400, "reason 5-500 chars");
    await q("insert into seller_codes(user_id,version,revoked_at,mark,reason,revoked_by) values($1,$2,now(),'violation',$3,$4) on conflict(user_id) do update set revoked_at=now(),mark='violation',reason=$3,revoked_by=$4 where seller_codes.mark is distinct from 'scam'", [req.t.id, CODE_VERSION, reason, req.user.id]);
    await audit(req.user.id, "code.burn", "user", req.t.id, { reason }); res.json({ ok: true });
  }));
  app.post("/api/admin/seller-code/:id/scam", need, staff(...AD), withUser, wrap(async (req, res) => {
    const reason = String(req.body?.reason || "").trim(); if (reason.length < 5 || reason.length > 500) throw E(400, "reason 5-500 chars");
    await tx(async c => {
      await c.query("insert into seller_codes(user_id,version,revoked_at,mark,reason,revoked_by) values($1,$2,now(),'scam',$3,$4) on conflict(user_id) do update set revoked_at=now(),mark='scam',reason=$3,revoked_by=$4", [req.t.id, CODE_VERSION, reason, req.user.id]);
      await c.query("update users set blocked_until=now()+interval '100 years',block_reason=$2 where id=$1", [req.t.id, "Скам: " + reason.slice(0, 200)]);
      await c.query("update listings set status='archived' where seller_id=$1 and status in('active','pending')", [req.t.id]);
      await c.query("update flash_sales set cancelled_at=now() where seller_id=$1 and cancelled_at is null and ends_at>now()", [req.t.id]);
    });
    await audit(req.user.id, "code.scam", "user", req.t.id, { reason }); res.json({ ok: true });
  }));
  app.post("/api/admin/seller-code/:id/restore", need, staff(...AD), withUser, wrap(async (req, res) => {
    const [c] = await q("select mark from seller_codes where user_id=$1", [req.t.id]); if (!c) throw E(404, "no code");
    await tx(async cx => {
      await cx.query("update seller_codes set revoked_at=null,mark=null,reason=null,revoked_by=null where user_id=$1", [req.t.id]);
      if (c.mark === "scam") await cx.query("update users set blocked_until=null,block_reason=null where id=$1 and block_reason like 'Скам:%'", [req.t.id]);
    });
    await audit(req.user.id, "code.restore", "user", req.t.id, {}); res.json({ ok: true });
  }));
  // публиковать лоты можно только с действующим кодексом
  app.post("/api/listings", need, wrap(async (req, _res, next) => { if (!(await codeOk(req.user.id))) throw E(403, "sign seller code first"); next(); }));

  // ---------- час распродажи ----------
  app.get("/api/flash", wrap(async (_req, res) => {
    res.json(await q(`select ${L.LCOLS} ${L.LFROM} where l.status='active' and fs.ends_at is not null order by fs.ends_at asc limit 12`));
  }));
  app.post("/api/flash", need, wrap(async (req, res) => {
    const b = req.body || {}, minutes = +b.minutes, percent = +b.percent;
    if (!uuid(b.listingId) || !Number.isInteger(minutes) || minutes < 30 || minutes > 60 || !Number.isInteger(percent) || percent < 5 || percent > 70) throw E(400, "invalid input");
    if (!(await codeOk(req.user.id))) throw E(403, "sign seller code first");
    const out = await tx(async c => {
      const { rows: [l] } = await c.query("select * from listings where id=$1 and seller_id=$2 for update", [b.listingId, req.user.id]);
      if (!l) throw E(404, "listing not found"); if (l.status !== "active") throw E(409, "listing not active"); if (l.stock < 1) throw E(409, "no stock");
      const { rows: [act] } = await c.query("select 1 from flash_sales where listing_id=$1 and cancelled_at is null and ends_at>now()", [l.id]); if (act) throw E(409, "sale already active");
      const { rows: [cd] } = await c.query("select 1 from flash_sales where listing_id=$1 and created_at>now()-interval '6 hours' and (cancelled_at is not null or ends_at<=now())", [l.id]); if (cd) throw E(429, "cooldown 6h");
      const { rows: [n] } = await c.query("select count(*)::int n from flash_sales where seller_id=$1 and cancelled_at is null and ends_at>now()", [req.user.id]); if (n.n >= 3) throw E(429, "too many active sales");
      const { rows: [s] } = await c.query("insert into flash_sales(listing_id,seller_id,percent,base_cents,ends_at) values($1,$2,$3,$4,now()+($5||' minutes')::interval) returning id,ends_at", [l.id, req.user.id, percent, l.price_cents, String(minutes)]);
      const { rows: w } = await c.query("select user_id from favorites where listing_id=$1 union select user_id from price_watch where listing_id=$1", [l.id]);
      const sale = Math.max(1, Math.floor(l.price_cents * (100 - percent) / 100)), targets = w.map(x => x.user_id).filter(u => u !== req.user.id);
      for (const u of targets) await c.query("insert into notifications(user_id,type,payload) values($1,'flash',$2)", [u, { listing_id: l.id, title: l.title, percent, new: sale, ends_at: s.ends_at }]);
      return { ...s, notified: targets };
    });
    for (const u of out.notified) pushUser?.(u, "notify", { type: "flash" }); delete out.notified;
    res.status(201).json(out);
  }));
  app.delete("/api/flash/:listingId", need, wrap(async (req, res) => {
    if (!uuid(req.params.listingId)) throw E(404, "not found");
    const r = await q("update flash_sales set cancelled_at=now() where listing_id=$1 and seller_id=$2 and cancelled_at is null and ends_at>now() returning id", [req.params.listingId, req.user.id]);
    if (!r.length) throw E(404, "no active sale"); res.json({ ok: true });
  }));
  app.get("/api/my/flash", need, wrap(async (req, res) => res.json(await q("select listing_id,percent,ends_at from flash_sales where seller_id=$1 and cancelled_at is null and ends_at>now()", [req.user.id]))));

  // ---------- битва магазинов ----------
  const score = (c, seller, cat, from, to) => c.query("select count(*)::int n from order_events e join orders o on o.id=e.order_id join listings l on l.id=o.listing_id where e.status='completed' and o.seller_id=$1 and l.category_id=$2 and e.created_at>=$3 and e.created_at<$4", [seller, cat, from, to]).then(r => r.rows[0].n);
  async function ensureWeek() {
    await tx(async c => {
      await c.query("select pg_advisory_xact_lock(424242)");
      const { rows: live } = await c.query("select * from battles where status='live' and week_start+interval '7 days'<=now() for update");
      for (const b of live) {
        const end = new Date(new Date(b.week_start).getTime() + 7 * 864e5), sa = await score(c, b.seller_a, b.category_id, b.created_at, end), sb = await score(c, b.seller_b, b.category_id, b.created_at, end);
        const win = sa > sb ? b.seller_a : sb > sa ? b.seller_b : null;
        await c.query("update battles set status='done',score_a=$2,score_b=$3,winner_id=$4,finished_at=$5 where id=$1", [b.id, sa, sb, win, end]);
      }
      const { rows: [{ w }] } = await c.query("select date_trunc('week',now()) w");
      const { rows: cats } = await c.query("select distinct category_id from battle_optin");
      for (const { category_id } of cats) {
        const { rows: free } = await c.query(`select o.user_id from battle_optin o join users u on u.id=o.user_id join seller_codes sc on sc.user_id=u.id and sc.revoked_at is null
          where o.category_id=$1 and (u.blocked_until is null or u.blocked_until<now())
            and exists(select 1 from listings l where l.seller_id=u.id and l.category_id=$1 and l.status='active')
            and not exists(select 1 from battles b where b.week_start=$2 and b.category_id=$1 and o.user_id in(b.seller_a,b.seller_b))
          order by (select count(*) from orders x join listings y on y.id=x.listing_id where x.seller_id=u.id and x.status='completed' and y.category_id=$1 and x.updated_at>now()-interval '60 days') desc, o.created_at`, [category_id, w]);
        for (let i = 0; i + 1 < free.length; i += 2) await c.query("insert into battles(category_id,week_start,seller_a,seller_b) values($1,$2,$3,$4)", [category_id, w, free[i].user_id, free[i + 1].user_id]);
      }
    });
  }
  app.get("/api/battles", wrap(async (req, res) => {
    await ensureWeek().catch(e => console.error("[battles]", e.message));
    const sc = (side, sellerCol) => `(select count(*) from order_events e join orders o on o.id=e.order_id join listings l on l.id=o.listing_id where e.status='completed' and o.seller_id=b.${sellerCol} and l.category_id=b.category_id and e.created_at>=b.created_at and e.created_at<b.week_start+interval '7 days')::int`;
    const base = `select b.id,b.status,b.category_id,c.name category_name,c.slug category,b.week_start,b.week_start+interval '7 days' week_end,b.seller_a,b.seller_b,ua.username name_a,ub.username name_b,b.winner_id,`
      + `from battles b join categories c on c.id=b.category_id join users ua on ua.id=b.seller_a join users ub on ub.id=b.seller_b`;
    const live = await q(`${base.replace("b.winner_id,from", `b.winner_id,${sc("a", "seller_a")} score_a,${sc("b", "seller_b")} score_b from`)} where b.status='live' order by c.name`);
    const done = await q(`${base.replace("b.winner_id,from", "b.winner_id,b.score_a,b.score_b,b.finished_at from")} where b.status='done' and b.winner_id is not null order by b.finished_at desc limit 12`);
    let mine = [], cats = await q("select c.id,c.slug,c.name from categories c order by c.name");
    if (req.user) mine = (await q("select category_id from battle_optin where user_id=$1", [req.user.id])).map(x => x.category_id);
    res.json({ live, done, categories: cats, mine });
  }));
  app.post("/api/battles/join", need, wrap(async (req, res) => {
    if (!uuid(req.body?.categoryId)) throw E(400, "invalid input");
    if (!(await codeOk(req.user.id))) throw E(403, "sign seller code first");
    const [has] = await q("select 1 from listings where seller_id=$1 and category_id=$2 and status='active' limit 1", [req.user.id, req.body.categoryId]); if (!has) throw E(409, "need active listing in category");
    await q("insert into battle_optin(user_id,category_id) values($1,$2) on conflict do nothing", [req.user.id, req.body.categoryId]);
    await ensureWeek().catch(() => {}); res.json({ ok: true });
  }));
  app.post("/api/battles/leave", need, wrap(async (req, res) => { if (!uuid(req.body?.categoryId)) throw E(400, "invalid input"); await q("delete from battle_optin where user_id=$1 and category_id=$2", [req.user.id, req.body.categoryId]); res.json({ ok: true }); }));

  // ---------- совместная покупка ----------
  const MIN_GROUP = 100000; // от 1000 ₽ за весь заказ
  const saleUnit = async (c, l) => { const { rows: [f] } = await c.query("select greatest(1,floor(base_cents*(100-percent)/100.0))::int p from flash_sales where listing_id=$1 and ends_at>now() and starts_at<=now() and cancelled_at is null and base_cents=$2 order by ends_at desc limit 1", [l.id, l.price_cents]); return f?.p || l.price_cents; };
  const GSEL = "select g.id,g.listing_id,g.qty,g.unit_cents,g.total_cents,g.initiator_pct,g.terms,g.status,g.order_id,g.expires_at,g.created_at,l.title,l.currency,l.seller_id,s.username seller,i.username initiator,p.username partner,g.initiator_id,g.partner_id from group_buys g join listings l on l.id=g.listing_id join users s on s.id=l.seller_id join users i on i.id=g.initiator_id left join users p on p.id=g.partner_id";
  const view = g => { const ic = Math.round(Number(g.total_cents) * g.initiator_pct / 100); return { ...g, total_cents: Number(g.total_cents), initiator_cents: ic, partner_cents: Number(g.total_cents) - ic, expired: g.status === "open" && new Date(g.expires_at) < new Date() }; };
  app.post("/api/groups", need, wrap(async (req, res) => {
    const b = req.body || {}, qty = +(b.qty ?? 1), pct = +(b.pct ?? 50), terms = String(b.terms || "").trim().slice(0, 500);
    if (!uuid(b.listingId) || !Number.isInteger(qty) || qty < 1 || qty > 100 || !Number.isInteger(pct) || pct < 10 || pct > 90) throw E(400, "invalid input");
    const g = await tx(async c => {
      const { rows: [l] } = await c.query("select * from listings where id=$1 and status='active' for update", [b.listingId]);
      if (!l) throw E(404, "listing unavailable"); if (!l.allow_group) throw E(409, "group buy not allowed"); if (l.seller_id === req.user.id) throw E(400, "own listing"); if (l.stock < qty) throw E(409, "not enough stock");
      const unit = await saleUnit(c, l), total = unit * qty; if (total < MIN_GROUP) throw E(409, "total too small for group buy");
      const { rows: [o] } = await c.query("select count(*)::int n from group_buys where initiator_id=$1 and status='open' and expires_at>now()", [req.user.id]); if (o.n >= 5) throw E(429, "too many open invites");
      const { rows: [r] } = await c.query("insert into group_buys(listing_id,initiator_id,qty,unit_cents,total_cents,initiator_pct,terms,expires_at) values($1,$2,$3,$4,$5,$6,$7,now()+interval '24 hours') returning id", [l.id, req.user.id, qty, unit, total, pct, terms]); return r;
    });
    res.status(201).json(g);
  }));
  app.get("/api/groups", need, wrap(async (req, res) => res.json((await q(`${GSEL} where $1 in (g.initiator_id,g.partner_id) order by g.created_at desc limit 50`, [req.user.id])).map(view))));
  app.get("/api/groups/:id", wrap(async (req, res) => { if (!uuid(req.params.id)) throw E(404, "not found"); const [g] = await q(`${GSEL} where g.id=$1`, [req.params.id]); if (!g) throw E(404, "not found"); res.json(view(g)); }));
  app.post("/api/groups/:id/cancel", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const r = await q("update group_buys set status='cancelled' where id=$1 and initiator_id=$2 and status='open' returning id", [req.params.id, req.user.id]); if (!r.length) throw E(409, "not available"); res.json({ ok: true });
  }));
  app.post("/api/groups/:id/join", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const o = await tx(async c => {
      const { rows: [g] } = await c.query("select * from group_buys where id=$1 for update", [req.params.id]); if (!g) throw E(404, "not found");
      if (g.status !== "open") throw E(409, "invite closed"); if (new Date(g.expires_at) < new Date()) { await c.query("update group_buys set status='expired' where id=$1", [g.id]); throw E(409, "invite expired"); }
      if (g.initiator_id === req.user.id) throw E(400, "own invite");
      const { rows: [l] } = await c.query("select * from listings where id=$1 and status='active' for update", [g.listing_id]); if (!l) throw E(404, "listing unavailable"); if (l.seller_id === req.user.id) throw E(400, "own listing"); if (l.stock < g.qty) throw E(409, "not enough stock");
      const ic = Math.round(Number(g.total_cents) * g.initiator_pct / 100), pc = Number(g.total_cents) - ic;
      const { rows: [ord] } = await c.query("insert into orders(listing_id,buyer_id,seller_id,unit_price_cents,quantity,total_cents,currency,partner_id,partner_cents) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [l.id, g.initiator_id, l.seller_id, g.unit_cents, g.qty, g.total_cents, l.currency, req.user.id, pc]);
      await c.query("insert into order_events(order_id,status,actor_id) values($1,'pending_payment',$2)", [ord.id, req.user.id]);
      await c.query("update group_buys set status='ordered',partner_id=$2,order_id=$3 where id=$1", [g.id, req.user.id, ord.id]); return ord;
    });
    res.json({ orderId: o.id });
  }));

  // ---- комментарии к новостям
  app.get("/api/news/:id/comments", wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    res.json(await q("select c.id,c.body,c.created_at,u.username,u.avatar_media,u.theme->>'avatar_preset' avatar_preset,case when u.role in ('moderator','admin','owner') then u.role end role from news_comments c join users u on u.id=c.user_id where c.news_id=$1 order by c.created_at limit 200", [req.params.id]));
  }));
  app.post("/api/news/:id/comments", need, rateLimit({ windowMs: 60e3, limit: 10 }), wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const body = String(req.body?.body || "").trim(); if (!body || body.length > 500) throw E(400, "body 1-500 chars");
    const [n] = await q("select id from news where id=$1", [req.params.id]); if (!n) throw E(404, "not found");
    const [c] = await q("insert into news_comments(news_id,user_id,body) values($1,$2,$3) returning id,body,created_at", [n.id, req.user.id, body]); res.status(201).json(c);
  }));
  app.delete("/api/news/comments/:id", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const [u] = await q("select role from users where id=$1", [req.user.id]);
    const r = await q(`delete from news_comments where id=$1 and (user_id=$2 or $3) returning id`, [req.params.id, req.user.id, ST.includes(u?.role)]); if (!r.length) throw E(404, "not found"); res.json({ ok: true });
  }));

  // ---- кастом карточки лота
  const STY = ["flat", "glow", "gradient", "outline"];
  app.put("/api/listings/:id/card", need, wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found");
    const style = STY.includes(req.body?.style) ? req.body.style : "flat", accent = /^#[0-9a-f]{6}$/i.test(req.body?.accent || "") ? req.body.accent : null;
    const r = await q("update listings set card=$3 where id=$1 and seller_id=$2 returning id", [req.params.id, req.user.id, JSON.stringify(accent ? { style, accent } : {})]);
    if (!r.length) throw E(404, "not found"); res.json({ ok: true });
  }));

  // ---- сброс пароля: код приходит в Telegram (если аккаунт привязан) или выдаётся администратором
  const h = c => crypto.createHash("sha256").update(String(c)).digest("hex");
  const mkCode = () => crypto.randomBytes(5).toString("hex").toUpperCase();
  const rl = rateLimit({ windowMs: 15 * 60e3, limit: 10 });
  app.get("/api/auth/reset/info", wrap(async (_req, res) => res.json({ telegram: !!process.env.TELEGRAM_BOT_TOKEN })));
  app.post("/api/auth/reset/request", rl, wrap(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const [u] = email ? await q("select id,telegram_id from users where email=$1", [email]) : [];
    let sent = false;
    if (u?.telegram_id && process.env.TELEGRAM_BOT_TOKEN && hooks.tgSend) {
      const [last] = await q("select created_at from pw_resets where user_id=$1 and kind='telegram' order by created_at desc limit 1", [u.id]);
      if (!last || Date.now() - new Date(last.created_at).getTime() > 60e3) {
        const code = mkCode(); await q("insert into pw_resets(user_id,code_hash,kind,expires_at) values($1,$2,'telegram',now()+interval '15 minutes')", [u.id, h(code)]);
        try { await hooks.tgSend(u.telegram_id, `Код для сброса пароля DonutPay: ${code}\nДействует 15 минут. Если это были не вы, просто проигнорируйте сообщение.`); sent = true; } catch {}
      }
    }
    res.json({ ok: true }); // ответ одинаковый, чтобы нельзя было перебирать почты
  }));
  app.post("/api/auth/reset/confirm", rl, wrap(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase(), code = String(req.body?.code || "").trim().toUpperCase().replace(/\s/g, ""), pw = String(req.body?.password || "");
    if (pw.length < 8) throw E(400, "password too short");
    const [u] = await q("select id from users where email=$1", [email]); const bad = () => E(400, "invalid or expired code"); if (!u || !code) throw bad();
    const [r] = await q("select id,code_hash,tries from pw_resets where user_id=$1 and used_at is null and expires_at>now() order by created_at desc limit 1", [u.id]); if (!r || r.tries >= 5) throw bad();
    if (r.code_hash !== h(code)) { await q("update pw_resets set tries=tries+1 where id=$1", [r.id]); throw bad(); }
    await q("update users set password_hash=$2 where id=$1", [u.id, await bcrypt.hash(pw, 10)]); await q("update pw_resets set used_at=now() where user_id=$1 and used_at is null", [u.id]);
    audit(u.id, "password_reset", "user", u.id); res.json({ ok: true });
  }));
  app.post("/api/admin/users/:username/reset-code", need, staff(...AD), wrap(async (req, res) => {
    const [t] = await q("select id,role from users where username=$1", [String(req.params.username)]); if (!t) throw E(404, "user not found");
    if (t.role === "owner" && req.role !== "owner") throw E(403, "forbidden");
    const code = mkCode(); await q("insert into pw_resets(user_id,code_hash,kind,expires_at) values($1,$2,'admin',now()+interval '1 hour')", [t.id, h(code)]);
    audit(req.user.id, "password_reset_code", "user", t.id); res.json({ code, expires_minutes: 60 });
  }));

  // ---- публичные настройки: документы и контакты поддержки
  app.get("/api/site-config", (_req, res) => {
    const e = process.env;
    res.json({ privacy_url: e.PRIVACY_URL || "https://telegra.ph/POLITIKA-KONFIDENCIALNOSTI-08-12-99", terms_url: e.TERMS_URL || "https://telegra.ph/PUBLICHNAYA-OFERTA-08-12-15", support_tg: (e.SUPPORT_TG || "").replace(/^@/, "").trim(), support_email: (e.SUPPORT_EMAIL || "").trim() });
  });
}
