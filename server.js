import express from "express"; import helmet from "helmet"; import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit"; import bcrypt from "bcryptjs"; import jwt from "jsonwebtoken";
import pg from "pg"; import routes2 from "./routes2.js"; import routes3 from "./routes3.js"; import { makeBadges } from "./badges.js"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const { DATABASE_URL, JWT_SECRET, NODE_ENV } = process.env;
if (!DATABASE_URL || !JWT_SECRET) { console.error("DATABASE_URL and JWT_SECRET are required"); process.exit(1); }
const prod = NODE_ENV === "production";
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
const q = (t, p) => pool.query(t, p).then(r => r.rows);
const E = (s, m) => Object.assign(new Error(m), { status: s });
const tx = async f => { const c = await pool.connect(); try { await c.query("begin"); const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); } };
await pool.query(fs.readFileSync(path.join(dir, "schema.sql"), "utf8"));
await pool.query(fs.readFileSync(path.join(dir, "schema_v2.sql"), "utf8"));
await pool.query(fs.readFileSync(path.join(dir, "schema_v3.sql"), "utf8"));
await pool.query("alter table listings add column if not exists after_msg text");

const app = express(); app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], fontSrc: ["https://fonts.gstatic.com"], scriptSrc: ["'self'", "'unsafe-inline'"], scriptSrcAttr: ["'unsafe-inline'"], imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co"], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: "50kb" })); app.use(cookieParser());
app.get("/health", (_, r) => r.send("ok"));
const wrap = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
app.use((req, _r, next) => { try { req.user = jwt.verify(req.cookies.t, JWT_SECRET); } catch {} next(); });
const need = (req, res, next) => req.user ? next() : res.status(401).json({ error: "auth required" });
const admin = wrap(async (req, res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); ["admin", "owner"].includes(u?.role) ? next() : res.status(403).json({ error: "forbidden" }); });
const setCookie = (res, id) => res.cookie("t", jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" }), { httpOnly: true, sameSite: "lax", secure: prod, maxAge: 7 * 864e5 });
const lim = rateLimit({ windowMs: 15 * 60e3, limit: 30 });
const U = "id,public_id,username,email,role,is_seller,avatar_url,bio,seller_verified,avatar_media,cover_media,theme";
const hooks = {}, B = makeBadges(q);
const r2 = routes2(app, { q, pool, tx, E, wrap, need, online, B, hooks });
const r3 = routes3(app, { q, pool, tx, E, wrap, need, pushUser, hooks });

// ---- auth / profile
app.post("/api/auth/register", lim, wrap(async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || "") || !/^[\w.-]{3,24}$/.test(username || "") || (password || "").length < 8) throw E(400, "invalid input");
  try { const [u] = await q(`insert into users(email,username,password_hash) values($1,$2,$3) returning ${U}`, [email.toLowerCase(), username, await bcrypt.hash(password, 10)]); setCookie(res, u.id); res.json(u); }
  catch (e) { if (e.code === "23505") throw E(409, "email or username taken"); throw e; }
}));
app.post("/api/auth/login", lim, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const [u] = await q("select * from users where email=$1", [String(email || "").toLowerCase()]);
  if (u?.blocked_until && new Date(u.blocked_until) > new Date()) throw E(403, "account blocked");
  if (!u || !(await bcrypt.compare(String(password || ""), u.password_hash))) throw E(401, "wrong email or password");
  setCookie(res, u.id); const { password_hash, ...pub } = u; res.json(pub);
}));
app.post("/api/auth/logout", (req, res) => { if (req.user) { subs.get(req.user.id)?.forEach(r => r.end()); subs.delete(req.user.id); lastSeen.delete(req.user.id); } res.clearCookie("t").json({ ok: true }); });
app.get("/api/me", need, wrap(async (req, res) => { const [u] = await q(`select ${U} from users where id=$1`, [req.user.id]); u ? res.json(u) : res.status(401).json({ error: "auth required" }); }));
app.patch("/api/me", need, wrap(async (req, res) => {
  const b = req.body || [];
  const [u] = await q(`update users set username=coalesce($2,username),avatar_url=coalesce($3,avatar_url),bio=coalesce($4,bio),is_seller=coalesce($5,is_seller) where id=$1 returning ${U}`,
    [req.user.id, b.username ?? null, b.avatar_url ?? null, b.bio ?? null, typeof b.is_seller === "boolean" ? b.is_seller : null]);
  res.json(u);
}));

// ---- catalog
app.get("/api/games", wrap(async (_, res) => res.json(await q("select g.slug,g.name,g.platform,coalesce((select json_agg(json_build_object('slug',c.slug,'label',coalesce(gc.label,c.name),'verified',gc.source='funpay') order by gc.sort) from game_categories gc join categories c on c.id=gc.category_id where gc.game_id=g.id),'[]'::json) cats from games g where g.is_active order by g.name"))));
app.get("/api/categories", wrap(async (_, res) => res.json(await q("select slug,name from categories order by name"))));
const LCOLS = "l.id,l.seller_id,l.title,l.summary,l.price_cents,l.currency,l.stock,l.delivery_time,l.image_media,l.created_at,g.slug game,g.name game_name,c.slug category,c.name category_name,u.username seller,u.avatar_url,u.avatar_media,u.theme->>'avatar_preset' avatar_preset,u.seller_verified,case when u.role in ('moderator','admin','owner') then u.role end seller_role,case when u.role in ('admin','owner') then u.theme #>> '{stf,tagc}' end tag_c1,case when u.role in ('admin','owner') then u.theme #>> '{stf,tagc2}' end tag_c2,r.avg rating,coalesce(r.cnt,0)::int reviews";
const LFROM = "from listings l join games g on g.id=l.game_id join categories c on c.id=l.category_id join users u on u.id=l.seller_id left join (select seller_id,round(avg(rating),2) avg,count(*) cnt from reviews group by seller_id) r on r.seller_id=l.seller_id";
app.get("/api/listings", wrap(async (req, res) => {
  const { game, category, min, max, q: s, seller, sort, offset } = req.query, w = ["l.status='active'"], p = [];
  const add = (c, v) => { p.push(v); w.push(c.replaceAll("?", "$" + p.length)); };
  if (game) add("g.slug=?", game); if (category) add("c.slug=?", category); if (seller) add("u.username=?", seller);
  if (+min > 0) add("l.price_cents>=?", Math.round(+min * 100)); if (+max > 0) add("l.price_cents<=?", Math.round(+max * 100));
  if (s) add("(l.title ilike ? or l.summary ilike ?)", "%" + s + "%");
  if (+req.query.rating > 0) add("coalesce(r.avg,0)>=?", +req.query.rating);
  const ord = { cheap: "l.price_cents asc", expensive: "l.price_cents desc", rating: "coalesce(r.avg,0) desc", new: "l.created_at desc" }[sort] || "l.created_at desc";
  { const rows = await q(`select ${LCOLS} ${LFROM} where ${w.join(" and ")} order by ${ord} limit 50 offset ${Math.max(0, +offset || 0)}`, p); const bm = await B.badgesFor(rows.map(r => r.seller_id)); res.json(rows.map(r => ({ ...r, online: online(r.seller_id), badges: bm[r.seller_id] || [] }))); }
}));
app.get("/api/listings/:id", wrap(async (req, res) => {
  const [l] = await q(`select ${LCOLS},l.details,l.attrs,l.image_media,l.seller_id,l.status,case when l.seller_id=$2 then l.after_msg end after_msg ${LFROM} where l.id=$1 and (l.status='active' or l.seller_id=$2 or exists(select 1 from users x where x.id=$2 and x.role in ('moderator','admin','owner')))`, [req.params.id, req.user?.id || null]);
  if (!l) throw E(404, "not found"); res.json({ ...l, online: online(l.seller_id), badges: (await B.badgesFor([l.seller_id]))[l.seller_id] || [] });
}));
app.get("/api/my/listings", need, wrap(async (req, res) => res.json(await q(`select ${LCOLS},l.status ${LFROM} where l.seller_id=$1 order by l.created_at desc`, [req.user.id]))));
const lbody = b => {
  const price = Math.round(+b.price * 100), stock = +b.stock || 1;
  if (String(b.title || "").length < 5 || b.title.length > 120 || !(price > 0) || !Number.isInteger(stock) || stock < 1) throw E(400, "invalid input");
  return [b.title, (b.summary || "").slice(0, 300), (b.details || "").slice(0, 3000), price, stock, (b.delivery_time || "").slice(0, 40)];
};
app.post("/api/listings", need, wrap(async (req, res) => {
  const [me] = await q("select is_seller,seller_verified from users where id=$1", [req.user.id]); if (!me?.is_seller) throw E(403, "become a seller first");
  if (process.env.REQUIRE_SELLER_VERIFICATION !== "false" && !me.seller_verified) throw E(403, "seller verification required");
  const [g] = await q("select id from games where slug=$1", [req.body.game]), [c] = await q("select id from categories where slug=$1", [req.body.category]);
  if (!g || !c) throw E(400, "unknown game or category");
  const [gm] = await q("select count(*)::int n, (count(*) filter (where category_id=$2))::int ok from game_categories where game_id=$1", [g.id, c.id]); if (gm.n > 0 && gm.ok === 0) throw E(400, "category not available for this game");
  const attrs = Object.fromEntries(Object.entries(req.body.attrs || {}).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && !/pass|pwd|token|secret|key/i.test(k) && ["string", "number"].includes(typeof v)).slice(0, 12).map(([k, v]) => [k, String(v).slice(0, 200)]));
  let img = null; if (req.body.image) { const [m] = await q("select id from media where id=$1 and owner_id=$2 and kind='listing'", [req.body.image, req.user.id]); if (!m) throw E(400, "bad image"); img = m.id; }
  const [l] = await q("insert into listings(seller_id,game_id,category_id,title,summary,details,price_cents,stock,delivery_time,status,attrs,image_media,after_msg) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12) returning id,status", [req.user.id, g.id, c.id, ...lbody(req.body), attrs, img, String(req.body.after_msg || "").slice(0, 2000)]);
  res.status(201).json(l);
}));
app.patch("/api/listings/:id", need, wrap(async (req, res) => {
  const [l] = await q("update listings set title=$3,summary=$4,details=$5,price_cents=$6,stock=$7,delivery_time=$8,status='pending',updated_at=now() where id=$1 and seller_id=$2 returning id,status", [req.params.id, req.user.id, ...lbody(req.body)]);
  if (!l) throw E(404, "not found"); res.json(l);
}));
app.delete("/api/listings/:id", need, wrap(async (req, res) => { const r = await pool.query("update listings set status='archived' where id=$1 and seller_id=$2", [req.params.id, req.user.id]); if (!r.rowCount) throw E(404, "not found"); res.json({ ok: true }); }));
app.get("/api/favorites", need, wrap(async (req, res) => res.json(await q(`select ${LCOLS},f.created_at fav_at,(select h.price_cents from price_history h where h.listing_id=l.id and h.created_at<=f.created_at order by h.created_at desc limit 1) price_at_add,exists(select 1 from price_watch w where w.user_id=f.user_id and w.listing_id=l.id) watched ${LFROM} join favorites f on f.listing_id=l.id where f.user_id=$1 and l.status='active'`, [req.user.id]))));
app.put("/api/favorites/:id", need, wrap(async (req, res) => { await q("insert into favorites(user_id,listing_id) values($1,$2) on conflict do nothing", [req.user.id, req.params.id]); res.json({ ok: true }); }));
app.delete("/api/favorites/:id", need, wrap(async (req, res) => { await q("delete from favorites where user_id=$1 and listing_id=$2", [req.user.id, req.params.id]); res.json({ ok: true }); }));

// ---- orders (цена и права только на сервере; статус "paid" ставит только платёжный webhook)
const ev = (c, id, st, actor) => c.query("insert into order_events(order_id,status,actor_id) values($1,$2,$3)", [id, st, actor]);
app.post("/api/orders", need, wrap(async (req, res) => {
  const n = +(req.body?.qty ?? 1); if (!Number.isInteger(n) || n < 1 || n > 1000) throw E(400, "bad quantity");
  res.status(201).json(await tx(async c => {
    const { rows: [l] } = await c.query("select * from listings where id=$1 and status='active' for update", [req.body?.listingId]);
    if (!l) throw E(404, "listing unavailable"); if (l.seller_id === req.user.id) throw E(400, "own listing"); if (l.stock < n) throw E(409, "not enough stock");
    const { rows: [o] } = await c.query("insert into orders(listing_id,buyer_id,seller_id,unit_price_cents,quantity,total_cents,currency) values($1,$2,$3,$4,$5,$6,$7) returning *", [l.id, req.user.id, l.seller_id, l.price_cents, n, l.price_cents * n, l.currency]);
    await ev(c, o.id, "pending_payment", req.user.id); return o;
  }));
}));
app.get("/api/orders", need, wrap(async (req, res) => res.json(await q("select o.*,l.title,case when o.status in ('paid','in_progress','completed') then l.after_msg end after_msg from orders o join listings l on l.id=o.listing_id where $1 in (o.buyer_id,o.seller_id) order by o.created_at desc", [req.user.id]))));
app.get("/api/orders/:id", need, wrap(async (req, res) => {
  const [o] = await q("select o.*,l.title,case when o.status in ('paid','in_progress','completed') then l.after_msg end after_msg from orders o join listings l on l.id=o.listing_id where o.id=$1 and $2 in (o.buyer_id,o.seller_id)", [req.params.id, req.user.id]);
  if (!o) throw E(404, "not found"); o.events = await q("select status,created_at from order_events where order_id=$1 order by id", [o.id]); res.json(o);
}));
const T = { cancelled: ["pending_payment", o => [o.buyer_id, o.seller_id]], in_progress: ["paid", o => [o.seller_id]], completed: ["in_progress", o => [o.buyer_id]] };
app.post("/api/orders/:id/status", need, wrap(async (req, res) => {
  const t = T[req.body?.status]; if (!t) throw E(400, "status not allowed");
  res.json(await tx(async c => {
    const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]);
    if (!o || !t[1](o).includes(req.user.id)) throw E(404, "not found"); if (o.status !== t[0]) throw E(409, "transition not allowed");
    await c.query("update orders set status=$2,updated_at=now() where id=$1", [o.id, req.body.status]); await ev(c, o.id, req.body.status, req.user.id); return { ok: true };
  }));
}));
app.post("/api/orders/:id/dispute", need, wrap(async (req, res) => {
  const reason = String(req.body?.reason || ""); if (reason.length < 10 || reason.length > 2000) throw E(400, "reason 10-2000 chars");
  res.json(await tx(async c => {
    const { rows: [o] } = await c.query("select * from orders where id=$1 for update", [req.params.id]);
    if (!o || ![o.buyer_id, o.seller_id].includes(req.user.id)) throw E(404, "not found"); if (!["paid", "in_progress", "completed"].includes(o.status)) throw E(409, "dispute not available");
    await c.query("insert into disputes(order_id,opened_by,reason) values($1,$2,$3)", [o.id, req.user.id, reason]);
    await c.query("update orders set status='dispute',updated_at=now() where id=$1", [o.id]); await ev(c, o.id, "dispute", req.user.id); r2.notifyStaff("Новый спор по заказу " + o.id.slice(0, 8) + ". Откройте админ-панель сайта."); return { ok: true };
  }));
}));
app.post("/api/orders/:id/review", need, wrap(async (req, res) => {
  const r = +req.body?.rating; if (!Number.isInteger(r) || r < 1 || r > 5) throw E(400, "rating 1-5");
  const [o] = await q("select * from orders where id=$1 and buyer_id=$2 and status='completed'", [req.params.id, req.user.id]); if (!o) throw E(404, "not found");
  try { await q("insert into reviews(order_id,reviewer_id,seller_id,rating,body) values($1,$2,$3,$4,$5)", [o.id, req.user.id, o.seller_id, r, String(req.body.body || "").slice(0, 1000)]); } catch (e) { if (e.code === "23505") throw E(409, "already reviewed"); throw e; }
  res.status(201).json({ ok: true });
}));
app.get("/api/sellers/:username/reviews", wrap(async (req, res) => res.json(await q("select r.rating,r.body,r.created_at,b.username reviewer from reviews r join users s on s.id=r.seller_id join users b on b.id=r.reviewer_id where s.username=$1 order by r.created_at desc limit 50", [req.params.username]))));
app.post("/api/payments/webhook", (_, res) => res.status(501).json({ error: "payment provider not configured" }));

// ---- chat (+ SSE для обновления без перезагрузки)
const subs = new Map(), lastSeen = new Map();
function pushUser(uid, ev, d) { subs.get(uid)?.forEach(r => r.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`)); }
function online(uid) { const s = subs.get(uid); return !!(s && s.size) || (lastSeen.get(uid) || 0) > Date.now() - 20000; }
app.get("/api/stream", need, (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); res.flushHeaders();
  const s = subs.get(req.user.id) || new Set(); s.add(res); subs.set(req.user.id, s);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000); req.on("close", () => { clearInterval(ping); s.delete(res); lastSeen.set(req.user.id, Date.now()); });
});
const push = (uid, d) => subs.get(uid)?.forEach(r => r.write(`event: message\ndata: ${JSON.stringify(d)}\n\n`));
app.post("/api/conversations", need, wrap(async (req, res) => {
  const [l] = await q("select id,seller_id from listings where id=$1 and status='active'", [req.body?.listingId]); if (!l) throw E(404, "listing unavailable"); if (l.seller_id === req.user.id) throw E(400, "own listing");
  const [c] = await q("insert into conversations(listing_id,buyer_id,seller_id) values($1,$2,$3) on conflict(listing_id,buyer_id) do update set listing_id=excluded.listing_id returning id", [l.id, req.user.id, l.seller_id]); res.json(c);
}));
app.get("/api/conversations", need, wrap(async (req, res) => res.json(await q(
  "select c.id,c.listing_id,u.username other,lm.body last,lm.created_at last_at,(select count(*) from messages m where m.conversation_id=c.id and m.sender_id<>$1 and m.read_at is null)::int unread from conversations c join users u on u.id=case when c.buyer_id=$1 then c.seller_id else c.buyer_id end left join lateral (select body,created_at from messages m where m.conversation_id=c.id order by created_at desc limit 1) lm on true where $1 in (c.buyer_id,c.seller_id) order by lm.created_at desc nulls last", [req.user.id]))));
const part = async (id, uid) => { const [c] = await q("select * from conversations where id=$1 and $2 in (buyer_id,seller_id)", [id, uid]); if (!c) throw E(404, "not found"); return c; };
app.get("/api/conversations/:id/messages", need, wrap(async (req, res) => {
  await part(req.params.id, req.user.id);
  await q("update messages set read_at=now() where conversation_id=$1 and sender_id<>$2 and read_at is null", [req.params.id, req.user.id]);
  res.json(await q("select m.id,m.sender_id,m.body,m.created_at,m.read_at,(select json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size)) from attachments a where a.message_id=m.id) atts from messages m where m.conversation_id=$1 order by m.created_at limit 500", [req.params.id]));
}));
app.post("/api/conversations/:id/messages", need, wrap(async (req, res) => {
  const body = String(req.body?.body || "").trim() || (req.body?.attachmentId ? "[вложение]" : ""); if (!body || body.length > 2000) throw E(400, "body 1-2000 chars");
  const c = await part(req.params.id, req.user.id);
  const [m] = await q("insert into messages(conversation_id,sender_id,body) values($1,$2,$3) returning id,conversation_id,sender_id,body,created_at", [c.id, req.user.id, body]);
  if (req.body?.attachmentId) { try { await r2.linkAtt(req.body.attachmentId, req.user.id, "chat", "message_id", m.id, c.id); } catch (e) { await q("delete from messages where id=$1", [m.id]); throw e; } m.atts = await q("select id,name,mime,size from attachments where message_id=$1", [m.id]); }
  push(c.buyer_id, m); push(c.seller_id, m); res.status(201).json(m);
}));
app.post("/api/reports", need, wrap(async (req, res) => {
  const { targetType, targetId, reason } = req.body || {}; if (String(reason || "").length < 5) throw E(400, "reason too short");
  await q("insert into reports(reporter_id,target_type,target_id,reason) values($1,$2,$3,$4)", [req.user.id, targetType, targetId, String(reason).slice(0, 1000)]); res.status(201).json({ ok: true });
}));

// ---- admin (роль проверяется в БД на каждый запрос)
app.get("/api/admin/listings", need, admin, wrap(async (req, res) => res.json(await q(`select ${LCOLS},l.status ${LFROM} where l.status=$1 order by l.created_at`, [req.query.status || "pending"]))));
app.post("/api/admin/listings/:id/status", need, admin, wrap(async (req, res) => { if (!["active", "rejected", "archived"].includes(req.body?.status)) throw E(400, "bad status"); await q("update listings set status=$2 where id=$1", [req.params.id, req.body.status]); res.json({ ok: true }); }));
app.get("/api/admin/disputes", need, admin, wrap(async (_, res) => res.json(await q("select * from disputes order by created_at desc limit 100"))));
app.post("/api/admin/disputes/:id/resolve", need, admin, wrap(async (req, res) => { if (!["resolved_buyer", "resolved_seller", "closed"].includes(req.body?.status)) throw E(400, "bad status"); await q("update disputes set status=$2,resolution=$3,resolved_by=$4 where id=$1", [req.params.id, req.body.status, String(req.body.resolution || "").slice(0, 2000), req.user.id]); res.json({ ok: true }); }));
app.get("/api/admin/reports", need, admin, wrap(async (_, res) => res.json(await q("select * from reports where status='open' order by created_at desc limit 100"))));
app.get("/api/admin/users", need, admin, wrap(async (_, res) => res.json(await q("select id,username,email,role,is_seller,created_at from users order by created_at desc limit 200"))));
app.post("/api/admin/games", need, admin, wrap(async (req, res) => { const { slug, name, platform } = req.body || {}; if (!slug || !name) throw E(400, "slug and name required"); await q("insert into games(slug,name,platform) values($1,$2,$3)", [slug, name, platform || null]); res.status(201).json({ ok: true }); }));
app.post("/api/admin/categories", need, admin, wrap(async (req, res) => { const { slug, name } = req.body || {}; if (!slug || !name) throw E(400, "slug and name required"); await q("insert into categories(slug,name) values($1,$2)", [slug, name]); res.status(201).json({ ok: true }); }));

app.use(express.static(path.join(dir, "public")));
app.use("/api", (_, res) => res.status(404).json({ error: "not found" }));
app.use((e, _req, res, _next) => {
  if (res.headersSent) { console.error("handler error after response:", e.message); return; }
  if (e.code === "22P02") e = E(400, "invalid id"); if (e.code === "23505") e = E(409, "already exists");
  if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : "server error", ...(!e.status && e.code && String(req.path).startsWith("/api/admin") ? { code: e.code, detail: String(e.message).slice(0, 200) } : {}), ...(!e.status && e.code ? { ref: e.code } : {}) });
});
app.listen(process.env.PORT || 3000, "0.0.0.0", () => console.log("DonutPay on", process.env.PORT || 3000));
