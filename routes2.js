import express from "express"; import crypto from "crypto"; import rateLimit from "express-rate-limit";
export default function routes2(app, { q, pool, tx, E, wrap, need }) {
  const env = process.env, BOT = env.TELEGRAM_BOT_TOKEN, BN = (env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim(), SITE = (env.SITE_URL || "").replace(/\/$/, ""), WS = env.TELEGRAM_WEBHOOK_SECRET, ACH = env.TELEGRAM_ADMIN_CHAT_ID;
  const cfg = !!(BOT && BN && WS), ST = ["moderator", "admin", "owner"], AD = ["admin", "owner"];
  const audit = (a, act, tt, tid, d) => q("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,$3,$4,$5)", [a, act, tt, String(tid ?? ""), d || {}]);
  const staff = (...r) => wrap(async (req, _res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); if (!u || !r.includes(u.role)) throw E(403, "forbidden"); req.role = u.role; next(); });
  const tg = (m, b) => fetch(`https://api.telegram.org/bot${BOT}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).catch(() => {});
  // заблокированные не могут выполнять действия
  app.use("/api", wrap(async (req, _res, next) => { if (req.user && req.method !== "GET") { const [u] = await q("select blocked_until from users where id=$1", [req.user.id]); if (u?.blocked_until && new Date(u.blocked_until) > new Date()) throw E(403, "account blocked"); } next(); }));

  // ---- media (хранится в БД; проверка сигнатуры файла, а не заголовка клиента)
  const mime = b => b.length < 12 ? null : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b.slice(0, 3).toString() === "GIF" ? "image/gif" : b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" ? "image/webp" : null;
  const LIM = { avatar: 1e6, cover: 2e6, listing: 1e6 };
  app.post("/api/media", need, express.raw({ type: "application/octet-stream", limit: "2mb" }), wrap(async (req, res) => {
    const kind = req.query.kind, b = req.body; if (!LIM[kind] || !Buffer.isBuffer(b)) throw E(400, "bad upload");
    const m = mime(b); if (!m) throw E(400, "only png, jpeg, webp, gif"); if (b.length > LIM[kind]) throw E(400, "file too large"); if (m === "image/gif" && kind !== "cover") throw E(400, "gif only for cover");
    const [c] = await q("select count(*)::int n from media where owner_id=$1", [req.user.id]); if (c.n >= 40) throw E(429, "media limit reached");
    const [r] = await q("insert into media(owner_id,kind,mime,size,data) values($1,$2,$3,$4,$5) returning id", [req.user.id, kind, m, b.length, b]); res.status(201).json(r);
  }));
  app.get("/api/media/:id", wrap(async (req, res) => {
    const [m] = await q("select mime,data from media where id=$1", [req.params.id]); if (!m) throw E(404, "not found");
    res.set({ "Content-Type": m.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "public, max-age=86400" }).send(m.data);
  }));

  // ---- публичный профиль и оформление
  app.get("/api/users/:username", wrap(async (req, res) => {
    const [u] = await q("select u.id,u.public_id,u.username,u.bio,u.created_at,u.avatar_media,u.cover_media,u.theme,u.seller_verified,u.is_seller,r.avg rating,coalesce(r.cnt,0)::int reviews from users u left join (select seller_id,round(avg(rating),2) avg,count(*) cnt from reviews group by seller_id) r on r.seller_id=u.id where (u.username=$1 or u.public_id::text=$1) order by (u.username=$1) desc limit 1", [req.params.username]);
    if (!u) throw E(404, "not found"); u.is_self = req.user?.id === u.id; res.json(u);
  }));
  const hex = /^#[0-9a-fA-F]{6}$/;
  app.patch("/api/me/theme", need, wrap(async (req, res) => {
    const b = req.body || {}, t0 = b.theme || {}, t = {};
    for (const k of ["accent", "bg1", "bg2"]) if (hex.test(t0[k])) t[k] = t0[k];
    if (Number.isInteger(t0.overlay) && t0.overlay >= 0 && t0.overlay <= 80) t.overlay = t0.overlay;
    if (["none", "ring", "double", "dots"].includes(t0.frame)) t.frame = t0.frame;
    if (["flat", "glass", "outline"].includes(t0.card)) t.card = t0.card;
    if (["left", "center"].includes(t0.layout)) t.layout = t0.layout;
    const own = async (id, kind) => { if (id == null) return null; const [m] = await q("select id from media where id=$1 and owner_id=$2 and kind=$3", [id, req.user.id, kind]); if (!m) throw E(400, "bad media"); return m.id; };
    if (b.reset) { const [u] = await q("update users set theme='{}',avatar_media=null,cover_media=null where id=$1 returning theme", [req.user.id]); return res.json(u); }
    const a = await own(b.avatar_media, "avatar"), c = await own(b.cover_media, "cover");
    const [u] = await q("update users set theme=case when $5 then $2::jsonb else theme end,avatar_media=coalesce($3,avatar_media),cover_media=coalesce($4,cover_media) where id=$1 returning theme,avatar_media,cover_media", [req.user.id, t, a, c, !!b.theme]);
    if (a) await q("delete from media where owner_id=$1 and kind='avatar' and id<>$2", [req.user.id, a]);
    if (c) await q("delete from media where owner_id=$1 and kind='cover' and id<>$2", [req.user.id, c]);
    res.json(u);
  }));

  // ---- верификация продавца через Telegram
  app.get("/api/verify/status", need, wrap(async (req, res) => { const [u] = await q("select seller_verified from users where id=$1", [req.user.id]); res.json({ configured: cfg, required: env.REQUIRE_SELLER_VERIFICATION !== "false", verified: u.seller_verified, missing: [["TELEGRAM_BOT_TOKEN", BOT], ["TELEGRAM_BOT_USERNAME", BN], ["TELEGRAM_WEBHOOK_SECRET", WS]].filter(x => !x[1]).map(x => x[0]) }); }));
  const hash = t => crypto.createHash("sha256").update(t).digest("hex");
  app.post("/api/verify/start", need, rateLimit({ windowMs: 3600e3, limit: 8 }), wrap(async (req, res) => {
    if (!cfg) throw E(503, "verification unavailable");
    const tok = crypto.randomBytes(24).toString("base64url");
    await q("delete from seller_verifications where user_id=$1 and status in ('pending','awaiting_contact')", [req.user.id]);
    await q("insert into seller_verifications(user_id,token_hash,expires_at) values($1,$2,now()+interval '15 minutes')", [req.user.id, hash(tok)]);
    res.json({ url: `https://t.me/${BN}?start=${tok}`, expires_in_min: 15 });
  }));
  const say = (id, text, extra) => tg("sendMessage", { chat_id: id, text, ...extra });
  app.post("/api/telegram/webhook", wrap(async (req, res) => {
    if (!cfg || req.get("x-telegram-bot-api-secret-token") !== WS) return res.sendStatus(403); res.sendStatus(200);
    const m = req.body?.message; if (!m || m.chat?.type !== "private") return; const from = m.from.id;
    if (typeof m.text === "string" && m.text.startsWith("/start")) {
      const tok = (m.text.split(" ")[1] || "").slice(0, 80);
      const [v] = tok ? await q("update seller_verifications set telegram_id=$2,status='awaiting_contact' where token_hash=$1 and status='pending' and used_at is null and expires_at>now() returning id", [hash(tok), from]) : [];
      if (!v) return say(from, "Ссылка недействительна или устарела. Вернитесь на сайт DonutPay и начните верификацию заново.");
      return say(from, "Чтобы подтвердить, что этот Telegram принадлежит вам, нажмите кнопку и поделитесь своим контактом. DonutPay сохранит только последние 4 цифры номера, номер не показывается другим пользователям.", { reply_markup: { keyboard: [[{ text: "Поделиться контактом", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
    }
    if (m.contact) {
      if (m.contact.user_id !== from) return say(from, "Отправьте свой собственный контакт кнопкой «Поделиться контактом».");
      const last4 = String(m.contact.phone_number || "").replace(/\D/g, "").slice(-4);
      const r = await tx(async c => {
        const { rows: [v] } = await c.query("select * from seller_verifications where telegram_id=$1 and status='awaiting_contact' and expires_at>now() for update", [from]); if (!v) return null;
        const { rows: ex } = await c.query("select 1 from users where telegram_id=$1 and id<>$2", [from, v.user_id]);
        if (ex.length) { await c.query("update seller_verifications set status='failed' where id=$1", [v.id]); return "taken"; }
        await c.query("update seller_verifications set status='verified',used_at=now(),phone_last4=$2 where id=$1", [v.id, last4]);
        const { rows: [u] } = await c.query("update users set telegram_id=$2,seller_verified=true where id=$1 returning username", [v.user_id, from]);
        await c.query("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,'seller_verified','user',$1,$2)", [v.user_id, { telegram_id: from }]); return u.username;
      });
      const rm = { reply_markup: { remove_keyboard: true } };
      if (!r) return say(from, "Нет активной верификации или время истекло. Начните заново на сайте.", rm);
      if (r === "taken") return say(from, "Этот Telegram уже привязан к другому аккаунту DonutPay.", rm);
      await say(from, "Контакт получен.", rm); await say(from, "Готово. Вернитесь на сайт DonutPay: вы можете создавать объявления.", SITE ? { reply_markup: { inline_keyboard: [[{ text: "Вернуться на DonutPay", url: SITE + "/#/sell" }]] } } : undefined);
      if (ACH) say(ACH, `Новая верификация продавца: ${r}\nTelegram ID: ${from}\nТелефон: ***${last4}`);
    }
  }));

  // ---- полное редактирование объявления (владелец проверяется в SQL)
  const cleanAttrs = a => Object.fromEntries(Object.entries(a || {}).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && !/pass|pwd|token|secret|key/i.test(k) && ["string", "number"].includes(typeof v)).slice(0, 12).map(([k, v]) => [k, String(v).slice(0, 200)]));
  app.patch("/api/listings/:id", need, wrap(async (req, res) => {
    const b = req.body || {}, price = Math.round(+b.price * 100), stock = +b.stock;
    if (String(b.title || "").length < 5 || b.title.length > 120 || !(price > 0) || !Number.isInteger(stock) || stock < 0) throw E(400, "invalid input");
    const [l] = await q("select * from listings where id=$1 and seller_id=$2", [req.params.id, req.user.id]); if (!l) throw E(404, "not found");
    let cat = l.category_id; if (b.category) { const [c] = await q("select id from categories where slug=$1", [b.category]); if (!c) throw E(400, "unknown category"); cat = c.id; }
    let img = l.image_media; if (b.image === null) img = null; else if (b.image) { const [m] = await q("select id from media where id=$1 and owner_id=$2 and kind='listing'", [b.image, req.user.id]); if (!m) throw E(400, "bad image"); img = m.id; }
    const st = b.status === "archived" ? "archived" : "pending";
    await q("update listings set title=$2,summary=$3,details=$4,price_cents=$5,stock=$6,delivery_time=$7,category_id=$8,attrs=$9,image_media=$10,status=$11,mod_reason=null,updated_at=now() where id=$1", [l.id, b.title, String(b.summary || "").slice(0, 300), String(b.details || "").slice(0, 3000), price, stock, String(b.delivery_time || "").slice(0, 40), cat, cleanAttrs(b.attrs), img, st]);
    res.json({ id: l.id, status: st });
  }));

  // ---- отдельный Telegram-бот для администрации
  const AB = env.ADMIN_BOT_TOKEN, ABN = (env.ADMIN_BOT_USERNAME || "").replace(/^@/, "").trim(), ABS = env.ADMIN_BOT_WEBHOOK_SECRET, OWN = (env.OWNER_TELEGRAM_IDS || "").split(",").map(s => s.trim()).filter(Boolean), abOK = !!(AB && ABN && ABS);
  const abSay = (id, text) => fetch(`https://api.telegram.org/bot${AB}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: id, text }) }).catch(() => {});
  app.post("/api/admin-bot/link", need, staff(...ST), rateLimit({ windowMs: 3600e3, limit: 10 }), wrap(async (req, res) => {
    if (!abOK) return res.status(503).json({ error: "admin bot unavailable", missing: [["ADMIN_BOT_TOKEN", AB], ["ADMIN_BOT_USERNAME", ABN], ["ADMIN_BOT_WEBHOOK_SECRET", ABS]].filter(x => !x[1]).map(x => x[0]) });
    const tok = crypto.randomBytes(24).toString("base64url");
    await q("insert into admin_link_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '10 minutes')", [req.user.id, hash(tok)]);
    res.json({ url: `https://t.me/${ABN}?start=${tok}` });
  }));
  app.post("/api/admin-bot/webhook", wrap(async (req, res) => {
    if (!abOK || req.get("x-telegram-bot-api-secret-token") !== ABS) return res.sendStatus(403); res.sendStatus(200);
    const m = req.body?.message; if (!m?.text || m.chat?.type !== "private") return; const from = m.from.id, [cmd, a1, a2] = m.text.trim().split(/\s+/);
    if (cmd === "/start" && a1) {
      const [t] = await q("update admin_link_tokens set used_at=now() where token_hash=$1 and used_at is null and expires_at>now() returning user_id", [hash(a1)]);
      if (!t) return abSay(from, "Ссылка недействительна или устарела. Создайте новую в админ-панели сайта.");
      const [u] = await q("select username,role from users where id=$1", [t.user_id]);
      if (!u || !ST.includes(u.role)) return abSay(from, "У аккаунта нет административной роли.");
      if (u.role === "owner" && OWN.length && !OWN.includes(String(from))) return abSay(from, "Этот Telegram не входит в список главных администраторов.");
      try { await q("update users set admin_telegram_id=$2 where id=$1", [t.user_id, from]); } catch { return abSay(from, "Этот Telegram уже привязан к другому аккаунту."); }
      await audit(t.user_id, "admin_bot_link", "user", t.user_id, { telegram_id: from }); return abSay(from, `Привязано: ${u.username} (${u.role}). Команды: /me /grant /revoke /audit`);
    }
    const [me] = await q("select id,username,role from users where admin_telegram_id=$1", [from]);
    if (!me || !ST.includes(me.role) || (me.role === "owner" && OWN.length && !OWN.includes(String(from)))) return abSay(from, "Нет доступа. Привяжите аккаунт через админ-панель сайта.");
    if (cmd === "/me") return abSay(from, `${me.username}: ${me.role}`);
    if (cmd === "/audit") { if (!AD.includes(me.role)) return abSay(from, "Недостаточно прав."); const a = await q("select a.action,a.target_id,a.created_at,u.username from audit_log a left join users u on u.id=a.actor_id order by a.id desc limit 10"); return abSay(from, a.map(x => `${new Date(x.created_at).toISOString().slice(0, 16)} ${x.username || "-"} ${x.action} ${String(x.target_id).slice(0, 8)}`).join("\n") || "Пусто"); }
    if (cmd === "/grant" || cmd === "/revoke") {
      const role = cmd === "/revoke" ? "user" : a2; if (!a1 || !["user", "moderator", "admin"].includes(role)) return abSay(from, "Формат: /grant ник moderator|admin, /revoke ник");
      if (!AD.includes(me.role)) return abSay(from, "Недостаточно прав.");
      const [t] = await q("select id,role from users where username=$1", [a1]); if (!t || t.id === me.id || t.role === "owner") return abSay(from, "Нельзя изменить этого пользователя.");
      if ((role === "admin" || t.role === "admin") && me.role !== "owner") return abSay(from, "Администраторов назначает и снимает только главный администратор.");
      await q("update users set role=$2 where id=$1", [t.id, role]); await audit(me.id, "role_change", "user", t.id, { from: t.role, to: role, via: "telegram" }); return abSay(from, `${a1}: ${t.role} -> ${role}`);
    }
    return abSay(from, "Команды: /me, /grant ник moderator|admin, /revoke ник, /audit");
  }));

  // ---- поддержка
  const TC = ["order", "payment", "account", "listing", "other"];
  app.post("/api/tickets", need, wrap(async (req, res) => {
    const { category, subject, body, orderId } = req.body || {}; if (!TC.includes(category) || String(subject || "").length < 3 || String(body || "").length < 5) throw E(400, "invalid input");
    if (orderId) { const [o] = await q("select 1 from orders where id=$1 and $2 in (buyer_id,seller_id)", [orderId, req.user.id]); if (!o) throw E(400, "bad order"); }
    res.status(201).json(await tx(async c => { const { rows: [t] } = await c.query("insert into tickets(user_id,order_id,category,subject) values($1,$2,$3,$4) returning id", [req.user.id, orderId || null, category, String(subject).slice(0, 120)]); await c.query("insert into ticket_messages(ticket_id,author_id,body) values($1,$2,$3)", [t.id, req.user.id, String(body).slice(0, 3000)]); return t; }));
  }));
  app.get("/api/tickets", need, wrap(async (req, res) => res.json(await q("select id,subject,category,status,order_id,updated_at from tickets where user_id=$1 order by updated_at desc", [req.user.id]))));
  const tk = async (id, u) => { const [t] = await q("select t.*,(select role from users where id=$2) role from tickets t where t.id=$1", [id, u]); if (!t) throw E(404, "not found"); const s = ST.includes(t.role); if (t.user_id !== u && !s) throw E(404, "not found"); t.staff = s; return t; };
  app.get("/api/tickets/:id", need, wrap(async (req, res) => { const t = await tk(req.params.id, req.user.id); t.messages = await q("select m.id,m.body,m.internal,m.created_at,u.username author,(m.author_id=t.user_id) is_user from ticket_messages m join tickets t on t.id=m.ticket_id left join users u on u.id=m.author_id where m.ticket_id=$1 and ($2 or not m.internal) order by m.id", [t.id, t.staff]); res.json(t); }));
  app.post("/api/tickets/:id/messages", need, wrap(async (req, res) => {
    const t = await tk(req.params.id, req.user.id), body = String(req.body?.body || "").trim(); if (!body || body.length > 3000) throw E(400, "body 1-3000 chars");
    const internal = t.staff && !!req.body.internal; if (t.status === "closed") throw E(409, "ticket closed");
    await q("insert into ticket_messages(ticket_id,author_id,body,internal) values($1,$2,$3,$4)", [t.id, req.user.id, body, internal]);
    await q("update tickets set updated_at=now(),status=case when $2 and not $3 then 'awaiting_user' when not $2 then 'new' else status end where id=$1", [t.id, t.staff && t.user_id !== req.user.id, internal]); res.json({ ok: true });
  }));
  app.get("/api/admin/tickets", need, staff(...ST), wrap(async (req, res) => res.json(await q("select t.id,t.subject,t.category,t.status,t.updated_at,u.username from tickets t join users u on u.id=t.user_id where ($1::text is null or t.status=$1) order by t.updated_at desc limit 100", [req.query.status || null]))));
  app.post("/api/admin/tickets/:id/status", need, staff(...ST), wrap(async (req, res) => { if (!["new", "in_review", "awaiting_user", "resolved", "closed"].includes(req.body?.status)) throw E(400, "bad status"); await q("update tickets set status=$2,updated_at=now() where id=$1", [req.params.id, req.body.status]); await audit(req.user.id, "ticket_status", "ticket", req.params.id, { status: req.body.status }); res.json({ ok: true }); }));

  // ---- споры: участники и сотрудники
  const dpart = async (id, uid) => { const [d] = await q("select d.*,o.buyer_id,o.seller_id,o.listing_id,o.total_cents,o.status order_status from disputes d join orders o on o.id=d.order_id where d.id=$1", [id]); const [u] = await q("select role from users where id=$1", [uid]); if (!d || !([d.buyer_id, d.seller_id].includes(uid) || ST.includes(u?.role))) throw E(404, "not found"); d.staff = ST.includes(u?.role); return d; };
  app.get("/api/my/disputes", need, wrap(async (req, res) => res.json(await q("select d.id,d.status,d.reason,d.created_at from disputes d join orders o on o.id=d.order_id where $1 in (o.buyer_id,o.seller_id) order by d.created_at desc", [req.user.id]))));
  app.get("/api/disputes/:id", need, wrap(async (req, res) => { const d = await dpart(req.params.id, req.user.id); d.messages = await q("select m.id,m.body,m.internal,m.created_at,u.username author from dispute_messages m left join users u on u.id=m.author_id where m.dispute_id=$1 and ($2 or not m.internal) order by m.id", [d.id, d.staff]);
    if (d.staff) d.chat = await q("select m.body,m.created_at,u.username from conversations c join messages m on m.conversation_id=c.id join users u on u.id=m.sender_id where c.listing_id=$1 and c.buyer_id=$2 order by m.created_at limit 200", [d.listing_id, d.buyer_id]); res.json(d); }));
  app.post("/api/disputes/:id/messages", need, wrap(async (req, res) => { const d = await dpart(req.params.id, req.user.id), body = String(req.body?.body || "").trim(); if (!body || body.length > 3000) throw E(400, "body 1-3000 chars"); if (d.status !== "open") throw E(409, "dispute closed"); await q("insert into dispute_messages(dispute_id,author_id,body,internal) values($1,$2,$3,$4)", [d.id, req.user.id, body, d.staff && !!req.body.internal]); res.json({ ok: true }); }));
  app.post("/api/admin/disputes/:id/resolve", need, staff(...ST), wrap(async (req, res) => {
    const { status, resolution } = req.body || {}; if (!["resolved_buyer", "resolved_seller", "closed"].includes(status) || String(resolution || "").length < 5) throw E(400, "status and reason required");
    await q("update disputes set status=$2,resolution=$3,resolved_by=$4 where id=$1", [req.params.id, status, String(resolution).slice(0, 2000), req.user.id]); await audit(req.user.id, "dispute_resolve", "dispute", req.params.id, { status }); res.json({ ok: true });
  }));

  // ---- админка: пользователи, объявления, заказы, аудит
  app.get("/api/admin/users", need, staff(...ST), wrap(async (req, res) => res.json(await q("select id,username,email,role,is_seller,seller_verified,blocked_until,block_reason,created_at from users where ($1::text is null or username ilike $1 or email ilike $1) order by created_at desc limit 100", [req.query.q ? "%" + req.query.q + "%" : null]))));
  app.post("/api/admin/users/:id/block", need, staff(...ST), wrap(async (req, res) => {
    const h = +req.body?.hours, reason = String(req.body?.reason || ""); if (!(h >= 1 && h <= 8760) || reason.length < 3) throw E(400, "hours and reason required");
    const [t] = await q("select role from users where id=$1", [req.params.id]); if (!t || req.params.id === req.user.id || t.role === "owner" || (t.role !== "user" && req.role !== "owner")) throw E(403, "forbidden");
    await q("update users set blocked_until=now()+($2||' hours')::interval,block_reason=$3 where id=$1", [req.params.id, String(Math.floor(h)), reason.slice(0, 500)]); await audit(req.user.id, "user_block", "user", req.params.id, { hours: h, reason }); res.json({ ok: true });
  }));
  app.post("/api/admin/users/:id/unblock", need, staff(...ST), wrap(async (req, res) => { await q("update users set blocked_until=null,block_reason=null where id=$1", [req.params.id]); await audit(req.user.id, "user_unblock", "user", req.params.id); res.json({ ok: true }); }));
  app.post("/api/admin/users/:id/role", need, staff(...AD), wrap(async (req, res) => {
    const r = req.body?.role; if (!["user", "moderator", "admin"].includes(r) || req.params.id === req.user.id) throw E(400, "bad role");
    const [t] = await q("select role from users where id=$1", [req.params.id]); if (!t || t.role === "owner") throw E(403, "forbidden"); if ((r === "admin" || t.role === "admin") && req.role !== "owner") throw E(403, "only owner can manage admins");
    await q("update users set role=$2 where id=$1", [req.params.id, r]); await audit(req.user.id, "role_change", "user", req.params.id, { from: t.role, to: r }); res.json({ ok: true });
  }));
  app.get("/api/admin/listings/all", need, staff(...ST), wrap(async (req, res) => res.json(await q("select l.id,l.title,l.status,l.mod_reason,l.price_cents,l.created_at,u.username seller from listings l join users u on u.id=l.seller_id where ($1::text is null or l.status=$1) and ($2::text is null or l.title ilike $2 or u.username ilike $2) order by l.created_at desc limit 100", [req.query.status || null, req.query.q ? "%" + req.query.q + "%" : null]))));
  app.get("/api/admin/listings/:id/history", need, staff(...ST), wrap(async (req, res) => res.json(await q("select e.status,e.reason,e.created_at,u.username from moderation_events e left join users u on u.id=e.actor_id where e.listing_id=$1 order by e.id desc", [req.params.id]))));
  app.post("/api/admin/listings/:id/moderate", need, staff(...ST), wrap(async (req, res) => {
    const { status, reason } = req.body || {}; if (!["active", "rejected", "archived"].includes(status) || (status !== "active" && String(reason || "").length < 3)) throw E(400, "status and reason required");
    const r = await pool.query("update listings set status=$2,mod_reason=$3 where id=$1", [req.params.id, status, reason || null]); if (!r.rowCount) throw E(404, "not found");
    await q("insert into moderation_events(listing_id,actor_id,status,reason) values($1,$2,$3,$4)", [req.params.id, req.user.id, status, reason || null]); await audit(req.user.id, "listing_moderate", "listing", req.params.id, { status, reason }); res.json({ ok: true });
  }));
  app.get("/api/admin/orders", need, staff(...ST), wrap(async (req, res) => res.json(await q("select o.id,o.status,o.total_cents,o.payment_status,o.created_at,l.title,b.username buyer,s.username seller,(select json_agg(json_build_object('status',e.status,'at',e.created_at) order by e.id) from order_events e where e.order_id=o.id) events,(select d.id from disputes d where d.order_id=o.id order by d.created_at desc limit 1) dispute_id from orders o join listings l on l.id=o.listing_id join users b on b.id=o.buyer_id join users s on s.id=o.seller_id where ($1::text is null or o.status=$1) order by o.created_at desc limit 100", [req.query.status || null]))));
  app.get("/api/admin/audit", need, staff(...AD), wrap(async (_, res) => res.json(await q("select a.action,a.target_type,a.target_id,a.details,a.created_at,u.username from audit_log a left join users u on u.id=a.actor_id order by a.id desc limit 100"))));
}
