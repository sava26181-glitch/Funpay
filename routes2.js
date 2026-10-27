import express from "express"; import crypto from "crypto"; import rateLimit from "express-rate-limit"; import { makeStorage } from "./storage.js";
export default function routes2(app, { q, pool, tx, E, wrap, need, online, B, hooks }) {
  const stor = makeStorage(process.env, process.env.DATABASE_URL);
  stor.ensure().then(r => console.log("[storage]", r)).catch(e => console.error("[storage] ensure failed:", e.message));
  const env = process.env, BOT = env.TELEGRAM_BOT_TOKEN, BN = (env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim(), SITE = (env.SITE_URL || "").replace(/\/$/, ""), WS = env.TELEGRAM_WEBHOOK_SECRET, ACH = env.TELEGRAM_ADMIN_CHAT_ID;
  const cfg = !!(BOT && BN && WS), ST = ["moderator", "admin", "owner"], AD = ["admin", "owner"];
  const audit = (a, act, tt, tid, d) => q("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,$3,$4,$5)", [a, act, tt, String(tid ?? ""), d || {}]);
  const staff = (...r) => wrap(async (req, _res, next) => { const [u] = await q("select role from users where id=$1", [req.user.id]); if (!u || !r.includes(u.role)) throw E(403, "forbidden"); req.role = u.role; next(); });
  const tgCall = async (tok, m, b) => { try { const r = await fetch(`https://api.telegram.org/bot${tok}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); const d = await r.json().catch(() => ({})); if (!d.ok) console.error(`[telegram] ${m} failed:`, d.error_code, d.description); return !!d.ok; } catch (e) { console.error(`[telegram] ${m} error:`, e.message); return false; } };
  const tg = (m, b) => tgCall(BOT, m, b);
  // заблокированные не могут выполнять действия
  app.use("/api", wrap(async (req, _res, next) => { if (req.user && req.method !== "GET") { const [u] = await q("select blocked_until from users where id=$1", [req.user.id]); if (u?.blocked_until && new Date(u.blocked_until) > new Date()) throw E(403, "account blocked"); } next(); }));

  // ---- media (хранится в БД; проверка сигнатуры файла, а не заголовка клиента)
  const mime = b => b.length < 12 ? null : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b.slice(0, 3).toString() === "GIF" ? "image/gif" : b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" ? "image/webp" : null;
  const LIM = { avatar: 1e6, cover: 2e6, listing: 1e6, news: 2e6 };
  app.post("/api/media", need, express.raw({ type: "application/octet-stream", limit: "2mb" }), wrap(async (req, res) => {
    const kind = req.query.kind, b = req.body; if (!LIM[kind] || !Buffer.isBuffer(b)) throw E(400, "bad upload");
    const m = mime(b); if (!m) throw E(400, "only png, jpeg, webp, gif"); if (b.length > LIM[kind]) throw E(400, "file too large"); if (m === "image/gif" && kind !== "cover" && kind !== "news") throw E(400, "gif only for cover");
    if (kind === "news") { const [u] = await q("select role from users where id=$1", [req.user.id]); if (!["admin", "owner"].includes(u?.role)) throw E(403, "forbidden"); }
    const [c] = await q("select count(*)::int n from media where owner_id=$1 and kind<>'news'", [req.user.id]); if (kind !== "news" && c.n >= 40) throw E(429, "media limit reached");
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[m];
    if (stor.on) {
      const path = `${kind}/${req.user.id}/${crypto.randomUUID()}.${ext}`;
      try { await stor.put(stor.PUB, path, b, m); } catch (e) { console.error("[storage]", e.message); throw E(502, "Хранилище недоступно: " + e.message); }
      const [r] = await q("insert into media(owner_id,kind,mime,size,storage_bucket,storage_path) values($1,$2,$3,$4,$5,$6) returning id", [req.user.id, kind, m, b.length, stor.PUB, path]); return res.status(201).json(r);
    }
    const [r] = await q("insert into media(owner_id,kind,mime,size,data) values($1,$2,$3,$4,$5) returning id", [req.user.id, kind, m, b.length, b]); res.status(201).json(r);
  }));
  app.get("/api/media/:id", wrap(async (req, res) => {
    const [m] = await q("select mime,data,storage_bucket,storage_path from media where id=$1", [req.params.id]); if (!m) throw E(404, "not found");
    if (m.storage_path) return res.set("Cache-Control", "public, max-age=3600").redirect(302, stor.publicUrl(m.storage_bucket, m.storage_path));
    res.set({ "Content-Type": m.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "public, max-age=86400" }).send(m.data);
  }));

  const dropMedia = async (uid, kind, keep) => { const old = await q("delete from media where owner_id=$1 and kind=$2 and id<>$3 returning storage_bucket,storage_path", [uid, kind, keep]); for (const o of old) if (o.storage_path) stor.del(o.storage_bucket, o.storage_path); };
  // ---- публичный профиль и оформление
  app.get("/api/users/:username", wrap(async (req, res) => {
    const [u] = await q("select u.id,u.public_id,u.username,u.role,u.bio,u.created_at,u.avatar_media,u.cover_media,u.theme,u.seller_verified,u.is_seller,r.avg rating,coalesce(r.cnt,0)::int reviews from users u left join (select seller_id,round(avg(rating),2) avg,count(*) cnt from reviews group by seller_id) r on r.seller_id=u.id where (u.username=$1 or u.public_id::text=$1) order by (u.username=$1) desc limit 1", [req.params.username]);
    if (!u) throw E(404, "not found"); if (!ST.includes(u.role)) u.role = null; u.is_self = req.user?.id === u.id; u.online = online(u.id); u.badges = (await B.badgesFor([u.id]))[u.id] || []; u.progress = await B.progress(u.id); res.json(u);
  }));
  const hex = /^#[0-9a-fA-F]{6}$/;
  app.patch("/api/me/theme", need, wrap(async (req, res) => {
    const b = req.body || {}, t0 = b.theme || {}, t = {};
    for (const k of ["accent", "bg1", "bg2"]) if (hex.test(t0[k])) t[k] = t0[k];
    if (Number.isInteger(t0.overlay) && t0.overlay >= 0 && t0.overlay <= 80) t.overlay = t0.overlay;
    if (["none", "ring", "double", "dots", "rainbow", "neon"].includes(t0.frame)) t.frame = t0.frame;
    if (["flat", "glass", "outline", "neon"].includes(t0.card)) t.card = t0.card;
    if (["left", "center"].includes(t0.layout)) t.layout = t0.layout;
    if (["plain", "grad", "gold", "neon", "ice", "fire"].includes(t0.nick)) t.nick = t0.nick;
    if (["none", "glow", "shimmer"].includes(t0.anim)) t.anim = t0.anim;
    if (["none", "dots", "grid", "waves"].includes(t0.pattern)) t.pattern = t0.pattern;
    if (["none", "cat", "ghost", "donut"].includes(t0.mascot)) t.mascot = t0.mascot;
    if (typeof t0.sparkles === "boolean") t.sparkles = t0.sparkles;
    if (Array.isArray(t0.badges)) t.badges = [...new Set(t0.badges.filter(x => ["diamond", "bolt", "star", "flame", "heart"].includes(x)))].slice(0, 4);
    if (t0.pos && typeof t0.pos === "object") { const p = {}; for (const k of ["nick", "tag", "id", "status", "avatar"]) { const v = t0.pos[k]; if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) { const x = Math.max(-160, Math.min(160, Math.round(v.x))), y = Math.max(-120, Math.min(120, Math.round(v.y))); if (x || y) p[k] = { x, y }; } } if (Object.keys(p).length) t.pos = p; }
    if (typeof t0.status === "string") t.status = t0.status.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40);
    if ([1, 2, 3].includes(t0.avatar_preset)) t.avatar_preset = t0.avatar_preset;
    if (t0.stf && typeof t0.stf === "object") {
      const [me] = await q("select role from users where id=$1", [req.user.id]);
      if (me && AD.includes(me.role)) { const x = {}, s0 = t0.stf; if (["aurora", "royal", "matrix", "crimson"].includes(s0.nick)) x.nick = s0.nick; if (["staff"].includes(s0.frame)) x.frame = s0.frame; if (hex.test(s0.tagc)) x.tagc = s0.tagc; if (hex.test(s0.tagc2)) x.tagc2 = s0.tagc2; if (s0.crown === true) x.crown = true; if (s0.aura === true) x.aura = true; t.stf = x; }
    }
    const own = async (id, kind) => { if (id == null) return null; const [m] = await q("select id from media where id=$1 and owner_id=$2 and kind=$3", [id, req.user.id, kind]); if (!m) throw E(400, "bad media"); return m.id; };
    if (b.reset) { const [u] = await q("update users set theme='{}',avatar_media=null,cover_media=null where id=$1 returning theme", [req.user.id]); return res.json(u); }
    const a = await own(b.avatar_media, "avatar"), c = await own(b.cover_media, "cover");
    const [u] = await q("update users set theme=case when $5 then $2::jsonb else theme end,avatar_media=case when $6 then null else coalesce($3,avatar_media) end,cover_media=coalesce($4,cover_media) where id=$1 returning theme,avatar_media,cover_media", [req.user.id, t, a, c, !!b.theme, !!b.clear_avatar && !a]);
    if (b.clear_avatar && !a) await dropMedia(req.user.id, "avatar", "00000000-0000-0000-0000-000000000000");
    if (a) await dropMedia(req.user.id, "avatar", a);
    if (c) await dropMedia(req.user.id, "cover", c);
    res.json(u);
  }));

  app.get("/api/presence", wrap(async (req, res) => { const names = String(req.query.names || "").split(",").slice(0, 60); const us = await q("select id,username from users where username=any($1)", [names]); res.json(Object.fromEntries(us.map(u => [u.username, online(u.id)]))); }));
  const linkAtt = async (id, uid, ctx, col, mid, ref, c) => { if (!id) return; const r = await (c || pool).query(`update attachments set ${col}=$3 where id=$1 and owner_id=$2 and context=$4 and message_id is null and ticket_message_id is null and dispute_message_id is null and ($5::text is null or ref_id=$5)`, [id, uid, mid, ctx, ref || null]); if (!r.rowCount) throw E(400, "bad attachment"); };
  const notifyStaff = async text => { if (!abOK) return; const us = await q("select admin_telegram_id from users where role in ('moderator','admin','owner') and admin_telegram_id is not null"); for (const u of us) await abSay(u.admin_telegram_id, text); };
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
  const notifyVerif = (ach, text) => { if (ach) say(ach, text); notifyStaff(text); };
  const say = (id, text, extra) => tg("sendMessage", { chat_id: id, text, ...extra });
  hooks.tgSend = (id, text) => BOT ? say(id, text) : Promise.resolve();
  app.post("/api/telegram/webhook", async (req, res) => {
    if (!cfg || req.get("x-telegram-bot-api-secret-token") !== WS) return res.sendStatus(403);
    res.sendStatus(200);
    try { await verifyHook(req); } catch (e) { console.error("[telegram:verify] handler error:", e.message); const f = req.body?.message?.from?.id; if (f) say(f, "Произошла ошибка на сервере DonutPay. Попробуйте ещё раз позже."); }
  });
  const verifyHook = async req => { const res = { sendStatus() {} };
    if (!cfg || req.get("x-telegram-bot-api-secret-token") !== WS) return res.sendStatus(403); res.sendStatus(200);
    const m = req.body?.message; if (!m || m.chat?.type !== "private") return; const from = m.from.id;
    console.log("[telegram:verify] update:", m.contact ? "contact" : String(m.text || "").split(" ")[0].slice(0, 12));
    if (m.text === "/cancel") { await q("update seller_verifications set status='failed' where telegram_id=$1 and status='awaiting_contact'", [from]); return say(from, "Верификация отменена. Вы можете начать заново на сайте.", { reply_markup: { remove_keyboard: true } }); }
    if (typeof m.text === "string" && m.text.startsWith("/start")) {
      const tok = (m.text.split(" ")[1] || "").slice(0, 80);
      const [v] = tok ? await q("update seller_verifications set telegram_id=$2,status='awaiting_contact' where token_hash=$1 and status='pending' and used_at is null and expires_at>now() returning id", [hash(tok), from]) : [];
      if (!v) return say(from, "Ссылка недействительна или устарела. Вернитесь на сайт DonutPay и начните верификацию заново.");
      return say(from, "Чтобы подтвердить, что этот Telegram принадлежит вам, нажмите кнопку и поделитесь своим контактом. DonutPay сохранит только последние 4 цифры номера, номер не показывается другим пользователям.", { reply_markup: { keyboard: [[{ text: "Поделиться контактом", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
    }
    if (!m.contact) return say(from, "Откройте ссылку из раздела «Верификация продавца» на сайте DonutPay.");
    if (m.contact) {
      if (m.contact.user_id !== from) return say(from, "Отправьте свой собственный контакт кнопкой «Поделиться контактом».");
      const last4 = String(m.contact.phone_number || "").replace(/\D/g, "").slice(-4);
      const r = await tx(async c => {
        const { rows: [v] } = await c.query("select * from seller_verifications where telegram_id=$1 and status='awaiting_contact' and expires_at>now() for update", [from]); if (!v) return null;
        const { rows: ex } = await c.query("select 1 from users where telegram_id=$1 and id<>$2", [from, v.user_id]);
        if (ex.length) { await c.query("update seller_verifications set status='failed' where id=$1", [v.id]); return "taken"; }
        await c.query("update seller_verifications set status='verified',used_at=now(),phone_last4=$2 where id=$1", [v.id, last4]);
        const { rows: [u] } = await c.query("update users set telegram_id=$2,seller_verified=true where id=$1 returning username", [v.user_id, from]);
        await c.query("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,'seller_verified','user',$3,$2)", [v.user_id, { telegram_id: from }, String(v.user_id)]); return u.username;
      });
      const rm = { reply_markup: { remove_keyboard: true } };
      if (!r) return say(from, "Нет активной верификации или время истекло. Начните заново на сайте.", rm);
      if (r === "taken") return say(from, "Этот Telegram уже привязан к другому аккаунту DonutPay.", rm);
      await say(from, "Контакт получен.", rm); await say(from, "Готово. Вернитесь на сайт DonutPay: вы можете создавать объявления.", (SITE || base) ? { reply_markup: { inline_keyboard: [[{ text: "Вернуться на DonutPay", url: (SITE || base) + "/#/sell" }]] } } : undefined);
      notifyVerif(ACH, `Новая верификация продавца: ${r}\nTelegram ID: ${from}\nТелефон: ***${last4}`);
    }
  };

  // ---- полное редактирование объявления (владелец проверяется в SQL)
  const cleanAttrs = a => Object.fromEntries(Object.entries(a || {}).filter(([k, v]) => /^[a-z_]{1,30}$/.test(k) && !/pass|pwd|token|secret|key/i.test(k) && ["string", "number"].includes(typeof v)).slice(0, 12).map(([k, v]) => [k, String(v).slice(0, 200)]));
  app.patch("/api/listings/:id", need, wrap(async (req, res) => {
    const b = req.body || {}, price = Math.round(+b.price * 100), stock = +b.stock;
    if (String(b.title || "").length < 5 || b.title.length > 120 || !(price > 0) || !Number.isInteger(stock) || stock < 0) throw E(400, "invalid input");
    const [l] = await q("select * from listings where id=$1 and (seller_id=$2 or exists(select 1 from users x where x.id=$2 and x.role in ('admin','owner')))", [req.params.id, req.user.id]); if (!l) throw E(404, "not found");
    let cat = l.category_id; if (b.category) { const [c] = await q("select id from categories where slug=$1", [b.category]); if (!c) throw E(400, "unknown category"); cat = c.id; }
    let img = l.image_media; if (b.image === null) img = null; else if (b.image) { const [m] = await q("select id from media where id=$1 and owner_id=$2 and kind='listing'", [b.image, req.user.id]); if (!m) throw E(400, "bad image"); img = m.id; }
    const st = b.status === "archived" ? "archived" : "pending";
    const [gm] = await q("select count(*)::int n, (count(*) filter (where category_id=$2))::int ok from game_categories where game_id=$1", [l.game_id, cat]); if (gm.n > 0 && gm.ok === 0) throw E(400, "category not available for this game");
    let aItems = l.auto_items, aOn = l.auto_delivery, stock2 = stock; if (aOn && aItems) stock2 = aItems.length;
    if (b.auto_items !== undefined) { const ai = hooks.autoClean(b.auto_items); if (ai) { aItems = ai; aOn = true; stock2 = ai.length } else { aItems = null; aOn = false } }
    await q("update listings set auto_items=$15,auto_delivery=$16,title=$2,summary=$3,details=$4,price_cents=$5,stock=$6,delivery_time=$7,category_id=$8,attrs=$9,image_media=$10,status=$11,after_msg=$12,allow_group=$13,deactivate_on_sale=$14,mod_reason=null,updated_at=now() where id=$1", [l.id, b.title, String(b.summary || "").slice(0, 300), String(b.details || "").slice(0, 3000), price, stock2, String(b.delivery_time || "").slice(0, 40), cat, cleanAttrs(b.attrs), img, st, String(b.after_msg || "").slice(0, 2000), b.allow_group === true, b.deactivate_on_sale === true, aItems, aOn]);
    hooks.priceChanged?.(l.id); res.json({ id: l.id, status: st });
  }));

  // ---- отдельный Telegram-бот для администрации
  const AB = env.ADMIN_BOT_TOKEN, ABN = (env.ADMIN_BOT_USERNAME || "").replace(/^@/, "").trim(), ABS = env.ADMIN_BOT_WEBHOOK_SECRET, OWN = (env.OWNER_TELEGRAM_IDS || "").split(",").map(s => s.trim()).filter(Boolean), abOK = !!(AB && ABN && ABS);
  // ADMIN_TG="123456789:ник:owner,987654321:другойник" - Telegram ID : ник / номер профиля / email : роль (необязательно)
  const TGMAP = String(env.ADMIN_TG || env.ADMIN_TG_IDS || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean).map(x => { const [id, who, role] = x.split(":").map(y => y.trim()); return { id, who: who || "", role: ["owner", "admin", "moderator"].includes(role) ? role : null }; }).filter(x => /^\d+$/.test(x.id));
  for (const e of TGMAP) if (!OWN.includes(e.id)) OWN.push(e.id);
  const syncTg = async from => {
    const e = TGMAP.find(x => x.id === String(from)); if (!e || !e.who) return null; const w = e.who.replace(/^@/, "");
    const [u] = await q("select id,username,role from users where lower(username)=lower($1) or public_id::text=$1 or lower(email)=lower($1) limit 1", [w]); if (!u) return { missing: w };
    const role = e.role || (ST.includes(u.role) ? u.role : "admin");
    await q("update users set admin_telegram_id=null where admin_telegram_id=$1 and id<>$2", [from, u.id]);
    await q("update users set admin_telegram_id=$2,role=$3 where id=$1", [u.id, from, role]);
    if (u.role !== role) await audit(u.id, "role_change", "user", u.id, { from: u.role, to: role, via: "ADMIN_TG" });
    return { id: u.id, username: u.username, role };
  };
  setTimeout(() => { for (const e of TGMAP) syncTg(e.id).then(x => console.log("[telegram:admin] ADMIN_TG", e.id, "->", x ? (x.missing ? "аккаунт не найден: " + x.missing : x.username + " (" + x.role + ")") : "без привязки к аккаунту")).catch(er => console.error("[telegram:admin] ADMIN_TG:", er.message)); }, 4000);
  const abSay = (id, text) => tgCall(AB, "sendMessage", { chat_id: id, text });
  app.post("/api/admin-bot/link", need, staff(...ST), rateLimit({ windowMs: 3600e3, limit: 10 }), wrap(async (req, res) => {
    if (!abOK) return res.status(503).json({ error: "admin bot unavailable", missing: [["ADMIN_BOT_TOKEN", AB], ["ADMIN_BOT_USERNAME", ABN], ["ADMIN_BOT_WEBHOOK_SECRET", ABS]].filter(x => !x[1]).map(x => x[0]) });
    const tok = crypto.randomBytes(24).toString("base64url");
    await q("insert into admin_link_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '10 minutes')", [req.user.id, hash(tok)]);
    res.json({ url: `https://t.me/${ABN}?start=${tok}` });
  }));
  app.post("/api/admin-bot/webhook", async (req, res) => {
    if (!abOK || req.get("x-telegram-bot-api-secret-token") !== ABS) return res.sendStatus(403);
    res.sendStatus(200);
    try { await adminHook(req); } catch (e) { console.error("[telegram:admin] handler error:", e.message); const f = req.body?.message?.from?.id; if (f) abSay(f, "Произошла ошибка на сервере DonutPay. Попробуйте ещё раз позже."); }
  });
  const adminHook = async req => { const res = { sendStatus() {} };
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
    if (cmd === "/id") return abSay(from, `Ваш Telegram ID: ${from}`);
    const sy = await syncTg(from); if (sy?.missing) return abSay(from, `Аккаунт «${sy.missing}» из ADMIN_TG не найден на сайте. Зарегистрируйтесь с этим ником или почтой и отправьте /start ещё раз.`);
    const [me] = await q("select id,username,role from users where admin_telegram_id=$1", [from]);
    if (!me || !ST.includes(me.role) || (me.role === "owner" && OWN.length && !OWN.includes(String(from)))) return abSay(from, `Нет доступа. Ваш Telegram ID: ${from}.\nДобавьте его в переменную ADMIN_TG на Render в формате ID:ник (например ${from}:Sava228), либо привяжите аккаунт через админ-панель сайта.`);
    console.log("[telegram:admin] command:", String(cmd).slice(0, 12), "role:", me.role);
    if (cmd === "/me") return abSay(from, `${me.username}: ${me.role}`);
    if (cmd === "/pending") { const [x] = await q("select (select count(*) from tickets where status in ('new','awaiting_user'))::int tk,(select count(*) from disputes where status in ('open','in_review','awaiting_info'))::int ds,(select count(*) from listings where status='pending')::int ls"); return abSay(from, `Обращения: ${x.tk}\nСпоры: ${x.ds}\nОбъявления на модерации: ${x.ls}`); }
    if (cmd === "/audit") { if (!AD.includes(me.role)) return abSay(from, "Недостаточно прав."); const a = await q("select a.action,a.target_id,a.created_at,u.username from audit_log a left join users u on u.id=a.actor_id order by a.id desc limit 10"); return abSay(from, a.map(x => `${new Date(x.created_at).toISOString().slice(0, 16)} ${x.username || "-"} ${x.action} ${String(x.target_id).slice(0, 8)}`).join("\n") || "Пусто"); }
    if (cmd === "/grant" || cmd === "/revoke") {
      const role = cmd === "/revoke" ? "user" : a2; if (!a1 || !["user", "moderator", "admin"].includes(role)) return abSay(from, "Формат: /grant ник moderator|admin, /revoke ник");
      if (!AD.includes(me.role)) return abSay(from, "Недостаточно прав.");
      const [t] = await q("select id,role from users where username=$1", [a1]); if (!t || t.id === me.id || t.role === "owner") return abSay(from, "Нельзя изменить этого пользователя.");
      if ((role === "admin" || t.role === "admin") && me.role !== "owner") return abSay(from, "Администраторов назначает и снимает только главный администратор.");
      await q("update users set role=$2 where id=$1", [t.id, role]); await audit(me.id, "role_change", "user", t.id, { from: t.role, to: role, via: "telegram" }); return abSay(from, `${a1}: ${t.role} -> ${role}`);
    }
    return abSay(from, `Роль: ${me.role}\nКоманды: /me, /pending` + (AD.includes(me.role) ? ", /grant ник moderator" + (me.role === "owner" ? "|admin" : "") + ", /revoke ник, /audit" : ""));
  };

  const base = (env.SITE_URL || env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  const setHook = async (token, path, secret, label) => { try { const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: base + path, secret_token: secret, allowed_updates: ["message"] }) }); const d = await r.json(); console.log(`[telegram:${label}] setWebhook ->`, d.ok ? "ok" : d.description); return d; } catch (e) { console.error(`[telegram:${label}] setWebhook error:`, e.message); } };
  if (base.startsWith("https://")) { if (cfg) setHook(BOT, "/api/telegram/webhook", WS, "verify"); if (abOK) setHook(AB, "/api/admin-bot/webhook", ABS, "admin"); } else if (cfg || abOK) console.warn("[telegram] нет https SITE_URL/RENDER_EXTERNAL_URL: webhook не зарегистрирован");
  const tgInfo = async (token, uname, path) => { if (!token) return { configured: false }; try { const [me, wh] = await Promise.all([fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json()), fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then(r => r.json())]); return { configured: true, token_valid: !!me.ok, bot_username: me.result?.username || null, username_matches: me.ok ? me.result.username.toLowerCase() === String(uname || "").toLowerCase() : null, webhook_url: wh.result?.url || "", expected_url: base + path, webhook_ok: !!wh.result?.url && wh.result.url === base + path, pending_updates: wh.result?.pending_update_count ?? null, last_error: wh.result?.last_error_message || null }; } catch (e) { return { configured: true, error: e.message }; } };
  app.get("/api/admin/telegram", need, staff(...AD), wrap(async (_req, res) => res.json({ site_url: base || null, verify_bot: await tgInfo(BOT, BN, "/api/telegram/webhook"), admin_bot: await tgInfo(AB, ABN, "/api/admin-bot/webhook"), storage: { configured: stor.on, host: stor.url ? new URL(stor.url).host : null, service_key_set: !!env.SUPABASE_SERVICE_ROLE_KEY } })));
  app.post("/api/admin/telegram/webhook", need, staff(...AD), wrap(async (req, res) => { if (!base.startsWith("https://")) throw E(400, "SITE_URL must be https"); const out = {}; if (cfg) out.verify = !!(await setHook(BOT, "/api/telegram/webhook", WS, "verify"))?.ok; if (abOK) out.admin = !!(await setHook(AB, "/api/admin-bot/webhook", ABS, "admin"))?.ok; await audit(req.user.id, "telegram_webhook_set", "system", "telegram", out); res.json(out); }));
  app.post("/api/admin/storage/test", need, staff(...AD), wrap(async (_req, res) => {
    if (stor.keyErr) return res.json({ ok: false, host: stor.url ? new URL(stor.url).host : "", key_kind: "повреждён", steps: [{ step: "ключ", ok: false, info: stor.keyErr }] });
    if (!stor.on) return res.json({ ok: false, steps: [{ step: "config", ok: false, info: "нет SB_KEY или не определён SUPABASE_URL" }] });
    const steps = [], step = async (n, f) => { try { steps.push({ step: n, ok: true, info: (await f()) ?? null }); return true; } catch (e) { steps.push({ step: n, ok: false, info: e.message }); return false; } };
    const buf = Buffer.from("iVBORw0KGgo=", "base64"), p = `healthcheck/${crypto.randomUUID()}.png`;
    await step("бакеты", () => stor.ensure());
    if (await step("загрузка в публичный бакет", () => stor.put(stor.PUB, p, buf, "image/png"))) {
      await step("чтение по публичной ссылке", async () => { if (!(await stor.verify(stor.PUB, p, buf.length))) throw new Error("файл не читается по публичной ссылке (бакет не публичный?)"); });
      await step("приватный бакет и подписанная ссылка", async () => { await stor.put(stor.PRIV, p, buf, "image/png"); await stor.signed(stor.PRIV, p, 30); await stor.del(stor.PRIV, p); });
      await stor.del(stor.PUB, p);
    }
    const kk = String(stor.key || ""); let kind = "неизвестный формат", role = "";
    if (kk.startsWith("sb_secret_")) kind = "sb_secret_* (подходит)"; else if (kk.startsWith("sb_publishable_")) kind = "sb_publishable_* (НЕ подходит: нужен secret или service_role)"; else if (kk.split(".").length === 3) { try { role = JSON.parse(Buffer.from(kk.split(".")[1], "base64url").toString()).role || ""; } catch {} kind = "JWT " + (role || "?") + (role && role !== "service_role" ? " (НЕ подходит: нужна роль service_role)" : ""); } else if (kk) kind = "ключ неполный или повреждён (длина " + kk.length + ")";
    if (steps.some(x => /Invalid Compact JWS|Invalid JWT|JWSError/i.test(String(x.info)))) steps.push({ step: "подсказка", ok: false, info: "Supabase не принимает ключ: он скопирован не целиком или с лишними символами. Проще всего: Supabase → Project Settings → API Keys → Secret keys → создать ключ sb_secret_... и вставить его целиком в SB_KEY (без кавычек и пробелов)." });
    res.json({ ok: steps.every(x => x.ok), host: new URL(stor.url).host, key_kind: kind, steps });
  }));
  // ---- поддержка
  const TC = ["order", "payment", "account", "listing", "other"];
  app.post("/api/tickets", need, wrap(async (req, res) => {
    const { category, subject, body, orderId, attachmentId } = req.body || {}; if (!TC.includes(category) || String(subject || "").length < 3 || String(body || "").length < 5) throw E(400, "invalid input");
    if (orderId) { const [o] = await q("select 1 from orders where id=$1 and $2 in (buyer_id,seller_id)", [orderId, req.user.id]); if (!o) throw E(400, "bad order"); }
    res.status(201).json(await tx(async c => { const { rows: [t] } = await c.query("insert into tickets(user_id,order_id,category,subject) values($1,$2,$3,$4) returning id", [req.user.id, orderId || null, category, String(subject).slice(0, 120)]); const { rows: [tm] } = await c.query("insert into ticket_messages(ticket_id,author_id,body) values($1,$2,$3) returning id", [t.id, req.user.id, String(body).slice(0, 3000)]); await linkAtt(attachmentId, req.user.id, "ticket", "ticket_message_id", tm.id, null, c); notifyStaff("Новое обращение в поддержку: " + String(subject).slice(0, 80)); return t; }));
  }));
  app.get("/api/tickets", need, wrap(async (req, res) => res.json(await q("select id,subject,category,status,order_id,updated_at from tickets where user_id=$1 order by updated_at desc", [req.user.id]))));
  const tk = async (id, u) => { const [t] = await q("select t.*,(select role from users where id=$2) role from tickets t where t.id=$1", [id, u]); if (!t) throw E(404, "not found"); const s = ST.includes(t.role); if (t.user_id !== u && !s) throw E(404, "not found"); t.staff = s; return t; };
  app.get("/api/tickets/:id", need, wrap(async (req, res) => { const t = await tk(req.params.id, req.user.id); t.messages = await q("select m.id,m.body,m.internal,m.created_at,u.username author,(m.author_id=t.user_id) is_user,(select json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size)) from attachments a where a.ticket_message_id=m.id) atts from ticket_messages m join tickets t on t.id=m.ticket_id left join users u on u.id=m.author_id where m.ticket_id=$1 and ($2 or not m.internal) order by m.id", [t.id, t.staff]); res.json(t); }));
  app.post("/api/tickets/:id/messages", need, wrap(async (req, res) => {
    const t = await tk(req.params.id, req.user.id), body = String(req.body?.body || "").trim() || (req.body?.attachmentId ? "[вложение]" : ""); if (!body || body.length > 3000) throw E(400, "body 1-3000 chars");
    const internal = t.staff && !!req.body.internal; if (t.status === "closed") throw E(409, "ticket closed");
    await tx(async c => { const { rows: [tm] } = await c.query("insert into ticket_messages(ticket_id,author_id,body,internal) values($1,$2,$3,$4) returning id", [t.id, req.user.id, body, internal]); await linkAtt(req.body?.attachmentId, req.user.id, "ticket", "ticket_message_id", tm.id, null, c); });
    await q("update tickets set updated_at=now(),status=case when $2 and not $3 then 'awaiting_user' when not $2 then 'new' else status end where id=$1", [t.id, t.staff && t.user_id !== req.user.id, internal]); res.json({ ok: true });
  }));
  app.get("/api/admin/tickets", need, staff(...ST), wrap(async (req, res) => res.json(await q("select t.id,t.subject,t.category,t.status,t.updated_at,u.username from tickets t join users u on u.id=t.user_id where ($1::text is null or t.status=$1) order by t.updated_at desc limit 100", [req.query.status || null]))));
  app.post("/api/admin/tickets/:id/status", need, staff(...ST), wrap(async (req, res) => { if (!["new", "in_review", "awaiting_user", "resolved", "closed"].includes(req.body?.status)) throw E(400, "bad status"); await q("update tickets set status=$2,updated_at=now() where id=$1", [req.params.id, req.body.status]); await audit(req.user.id, "ticket_status", "ticket", req.params.id, { status: req.body.status }); res.json({ ok: true }); }));

  // ---- споры: участники и сотрудники
  const dpart = async (id, uid) => { const [d] = await q("select d.*,o.buyer_id,o.seller_id,o.listing_id,o.total_cents,o.status order_status from disputes d join orders o on o.id=d.order_id where d.id=$1", [id]); const [u] = await q("select role from users where id=$1", [uid]); if (!d || !([d.buyer_id, d.seller_id].includes(uid) || ST.includes(u?.role))) throw E(404, "not found"); d.staff = ST.includes(u?.role); return d; };
  app.get("/api/my/disputes", need, wrap(async (req, res) => res.json(await q("select d.id,d.status,d.reason,d.created_at from disputes d join orders o on o.id=d.order_id where $1 in (o.buyer_id,o.seller_id) order by d.created_at desc", [req.user.id]))));
  app.get("/api/disputes/:id", need, wrap(async (req, res) => { const d = await dpart(req.params.id, req.user.id); d.messages = await q("select m.id,m.body,m.internal,m.created_at,u.username author,(select json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size)) from attachments a where a.dispute_message_id=m.id) atts from dispute_messages m left join users u on u.id=m.author_id where m.dispute_id=$1 and ($2 or not m.internal) order by m.id", [d.id, d.staff]);
    if (d.staff) d.chat = await q("select m.id,m.body,m.created_at,u.username,(select json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size)) from attachments a where a.message_id=m.id) atts from conversations c join messages m on m.conversation_id=c.id join users u on u.id=m.sender_id where least(c.buyer_id,c.seller_id)=least($1::uuid,$2::uuid) and greatest(c.buyer_id,c.seller_id)=greatest($1::uuid,$2::uuid) order by m.created_at limit 200", [d.buyer_id, d.seller_id]);
    if (d.staff) d.history = await q("select a.action,a.details,a.created_at,u.username from audit_log a left join users u on u.id=a.actor_id where a.target_type='dispute' and a.target_id=$1 order by a.id desc", [d.id]);
    if (d.staff) d.videos = await q("select id,created_at,size,mime from attachments where context='delivery' and ref_id=$1 order by created_at", [d.order_id]); res.json(d); }));
  app.post("/api/disputes/:id/messages", need, wrap(async (req, res) => {
    const d = await dpart(req.params.id, req.user.id), body = String(req.body?.body || "").trim() || (req.body?.attachmentId ? "[вложение]" : ""); if (!body || body.length > 3000) throw E(400, "body 1-3000 chars");
    if (!["open", "in_review", "awaiting_info"].includes(d.status)) throw E(409, "dispute closed");
    await tx(async c => { const { rows: [dm] } = await c.query("insert into dispute_messages(dispute_id,author_id,body,internal) values($1,$2,$3,$4) returning id", [d.id, req.user.id, body, d.staff && !!req.body.internal]); await linkAtt(req.body?.attachmentId, req.user.id, "dispute", "dispute_message_id", dm.id, d.id, c); });
    if (!d.staff && d.status === "awaiting_info") await q("update disputes set status='in_review' where id=$1", [d.id]); res.json({ ok: true });
  }));
  app.post("/api/admin/disputes/:id/status", need, staff(...ST), wrap(async (req, res) => { if (!["open", "in_review", "awaiting_info"].includes(req.body?.status)) throw E(400, "bad status"); const r = await pool.query("update disputes set status=$2 where id=$1 and status in ('open','in_review','awaiting_info')", [req.params.id, req.body.status]); if (!r.rowCount) throw E(409, "dispute closed"); await audit(req.user.id, "dispute_status", "dispute", req.params.id, { status: req.body.status }); res.json({ ok: true }); }));
  app.post("/api/admin/disputes/:id/resolve", need, staff(...ST), wrap(async (req, res) => {
    const { status, resolution } = req.body || {}; if (!["resolved_buyer", "resolved_seller", "closed"].includes(status) || String(resolution || "").length < 5) throw E(400, "status and reason required");
    await q("update disputes set status=$2,resolution=$3,resolved_by=$4 where id=$1", [req.params.id, status, String(resolution).slice(0, 2000), req.user.id]); await audit(req.user.id, "dispute_resolve", "dispute", req.params.id, { status });
    if (status !== "closed" && hooks.settleOrder) await tx(async c => { const { rows: [o] } = await c.query("select o.* from disputes d join orders o on o.id=d.order_id where d.id=$1 for update of o", [req.params.id]); if (o) await hooks.settleOrder(c, o, status === "resolved_buyer" ? "buyer" : "seller"); });
    await tx(async c => { const { rows: [d] } = await c.query("select order_id from disputes where id=$1", [req.params.id]); if (d) hooks.pushSys?.(await hooks.sysMsg?.(c, d.order_id, status, req.user.id)); });
    res.json({ ok: true });
  }));
  // модератор пишет прямо в общий чат сторон спора: оба участника видят сообщение в обычном чате и на странице заказа
  app.post("/api/admin/disputes/:id/chat", need, staff(...ST), wrap(async (req, res) => {
    const body = String(req.body?.body || "").trim(); if (!body || body.length > 2000) throw E(400, "body 1-2000 chars");
    const [d] = await q("select d.id,d.status,o.id order_id,o.buyer_id,o.seller_id,o.number from disputes d join orders o on o.id=d.order_id where d.id=$1", [req.params.id]); if (!d) throw E(404, "not found");
    if (!["open", "in_review", "awaiting_info"].includes(d.status)) throw E(409, "dispute closed");
    const m = await tx(async c => {
      let { rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [d.buyer_id, d.seller_id]);
      if (!cv) { await c.query("insert into conversations(listing_id,buyer_id,seller_id) values(null,$1,$2) on conflict do nothing", [d.buyer_id, d.seller_id]); ({ rows: [cv] } = await c.query("select id from conversations where least(buyer_id,seller_id)=least($1::uuid,$2::uuid) and greatest(buyer_id,seller_id)=greatest($1::uuid,$2::uuid) limit 1", [d.buyer_id, d.seller_id])); }
      const { rows: [x] } = await c.query("insert into messages(conversation_id,sender_id,body,kind,order_id) values($1,$2,$3,'staff',$4) returning id,conversation_id,sender_id,body,created_at,listing_id,kind,order_id", [cv.id, req.user.id, body, d.order_id]);
      const { rows: [u] } = await c.query("select username,role from users where id=$1", [req.user.id]); x.sender_name = u.username; x.sender_role = u.role; x._to = [d.buyer_id, d.seller_id]; return x;
    });
    hooks.pushSys?.(m); await audit(req.user.id, "dispute_chat", "dispute", d.id, {}); res.json({ ok: true });
  }));

  // ---- вложения (приватный бакет Supabase Storage, доступ только по короткоживущим ссылкам)
  const amime = b => mime(b) || (b.slice(0, 5).toString() === "%PDF-" ? "application/pdf" : null);
  app.post("/api/attachments", need, express.raw({ type: "application/octet-stream", limit: "6mb" }), wrap(async (req, res) => {
    const ctx = req.query.context, ref = String(req.query.ref || ""), b = req.body; if (!["chat", "ticket", "dispute"].includes(ctx) || !Buffer.isBuffer(b)) throw E(400, "bad upload");
    const m = amime(b); if (!m) throw E(400, "allowed: png, jpeg, webp, gif, pdf"); if (b.length > 5e6) throw E(400, "file too large (max 5 MB)");
    if (ctx === "chat") { const [c] = await q("select id from conversations where id=$1 and $2 in (buyer_id,seller_id)", [ref, req.user.id]); if (!c) throw E(404, "not found"); }
    if (ctx === "dispute") await dpart(ref, req.user.id);
    const [n] = await q("select count(*)::int n from attachments where owner_id=$1 and created_at>now()-interval '1 hour'", [req.user.id]); if (n.n >= 30) throw E(429, "too many uploads");
    const path = `${ctx}/${req.user.id}/${crypto.randomUUID()}`; if (stor.on) { try { await stor.put(stor.PRIV, path, b, m); } catch (e) { console.error("[storage]", e.message); throw E(502, "Хранилище недоступно: " + e.message); } }
    const [a] = await q("insert into attachments(owner_id,context,ref_id,bucket,path,mime,size,name) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,mime,size,name", [req.user.id, ctx, ref || null, stor.on ? stor.PRIV : "db", path, m, b.length, String(req.query.name || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 80)]);
    if (!stor.on) { try { await q("insert into attachment_blobs(attachment_id,data) values($1,$2)", [a.id, b]); } catch (e) { await q("delete from attachments where id=$1", [a.id]); throw e; } }
    res.status(201).json(a);
  }));
  const attAccess = async (id, uid) => {
    const [a] = await q("select * from attachments where id=$1", [id]); if (!a) throw E(404, "not found");
    const [u] = await q("select role from users where id=$1", [uid]), sf = ST.includes(u.role); let ok = a.owner_id === uid;
    if (!ok && a.message_id) { const [c] = await q("select c.* from messages m join conversations c on c.id=m.conversation_id where m.id=$1", [a.message_id]); ok = !!c && ([c.buyer_id, c.seller_id].includes(uid) || (sf && !!(await q("select 1 from disputes d join orders o on o.id=d.order_id where least(o.buyer_id,o.seller_id)=least($1::uuid,$2::uuid) and greatest(o.buyer_id,o.seller_id)=greatest($1::uuid,$2::uuid) limit 1", [c.buyer_id, c.seller_id]))[0])); }
    if (!ok && a.ticket_message_id) { const [t] = await q("select t.user_id,m.internal from ticket_messages m join tickets t on t.id=m.ticket_id where m.id=$1", [a.ticket_message_id]); ok = !!t && (sf || (t.user_id === uid && !t.internal)); }
    if (!ok && a.dispute_message_id) { const [d] = await q("select o.buyer_id,o.seller_id,m.internal from dispute_messages m join disputes d on d.id=m.dispute_id join orders o on o.id=d.order_id where m.id=$1", [a.dispute_message_id]); ok = !!d && (sf || ([d.buyer_id, d.seller_id].includes(uid) && !d.internal)); }
    if (!ok && a.context === "delivery") { const [o] = await q("select buyer_id,seller_id from orders where id=$1", [a.ref_id]); ok = !!o && ([o.buyer_id, o.seller_id].includes(uid) || sf); }
    if (!ok) throw E(404, "not found"); return a;
  };
  app.get("/api/attachments/:id/url", need, wrap(async (req, res) => {
    const a = await attAccess(req.params.id, req.user.id);
    if (a.bucket === "db") return res.json({ url: `/api/attachments/${a.id}/file`, name: a.name, mime: a.mime });
    res.json({ url: await stor.signed(a.bucket, a.path, 60), name: a.name, mime: a.mime });
  }));
  app.get("/api/attachments/:id/file", need, wrap(async (req, res) => {
    const a = await attAccess(req.params.id, req.user.id); if (a.bucket !== "db") throw E(404, "not found");
    const [f] = await q("select data from attachment_blobs where attachment_id=$1", [a.id]); if (!f) throw E(404, "not found");
    res.set({ "Content-Type": a.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300", "Content-Disposition": "inline" }).send(f.data);
  }));
  // ---- админка: пользователи, объявления, заказы, аудит
  app.get("/api/admin/users", need, staff(...ST), wrap(async (req, res) => res.json(await q("select id,public_id,username,email,role,is_seller,seller_verified,blocked_until,block_reason,created_at from users where ($1::text is null or username ilike $1 or email ilike $1 or public_id::text=$2) order by created_at desc limit 100", [req.query.q ? "%" + String(req.query.q).trim().replace(/[%_\\]/g, "") + "%" : null, String(req.query.q || "").trim().replace(/^#/, "")]))));
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
    await q("insert into moderation_events(listing_id,actor_id,status,reason) values($1,$2,$3,$4)", [req.params.id, req.user.id, status, reason || null]); await audit(req.user.id, "listing_moderate", "listing", req.params.id, { status, reason }); hooks.priceChanged?.(req.params.id); res.json({ ok: true });
  }));
  app.get("/api/admin/orders", need, staff(...ST), wrap(async (req, res) => {
    const st = String(req.query.status || ""), qs = String(req.query.q || "").trim().replace(/^#/, "").slice(0, 40), w = [], p = [];
    if (st) { p.push(st); w.push(`o.status=$${p.length}`); }
    if (qs) { p.push("%" + qs.replace(/[%_\\]/g, "\\$&") + "%"); w.push(`(o.number ilike $${p.length} or o.id::text ilike $${p.length} or exists(select 1 from users x where x.id in (o.buyer_id,o.seller_id) and x.username ilike $${p.length}))`); }
    const os = await q(`select o.id,o.number,o.status,o.total_cents,o.payment_status,o.created_at,o.listing_id,o.buyer_id,o.seller_id from orders o ${w.length ? "where " + w.join(" and ") : ""} order by o.created_at desc limit 100`, p);
    if (!os.length) return res.json([]);
    const ids = os.map(o => o.id), [ls, us, evs, ds] = await Promise.all([
      q("select id,title from listings where id=any($1::uuid[])", [os.map(o => o.listing_id)]),
      q("select id,username from users where id=any($1::uuid[])", [[...new Set(os.flatMap(o => [o.buyer_id, o.seller_id]))]]),
      q("select order_id,status,created_at from order_events where order_id=any($1::uuid[]) order by id", [ids]),
      q("select order_id,id from disputes where order_id=any($1::uuid[]) order by created_at", [ids])]);
    const L = new Map(ls.map(x => [x.id, x.title])), U = new Map(us.map(x => [x.id, x.username]));
    res.json(os.map(o => ({ id: o.id, number: o.number, status: o.status, total_cents: o.total_cents, payment_status: o.payment_status, created_at: o.created_at, title: L.get(o.listing_id) || "(объявление удалено)", buyer: U.get(o.buyer_id) || "?", seller: U.get(o.seller_id) || "?", events: evs.filter(e => e.order_id === o.id).map(e => ({ status: e.status, at: e.created_at })), dispute_id: ds.filter(d => d.order_id === o.id).pop()?.id || null })));
  }));
  app.get("/api/admin/audit", need, staff(...AD), wrap(async (_, res) => res.json(await q("select a.action,a.target_type,a.target_id,a.details,a.created_at,u.username from audit_log a left join users u on u.id=a.actor_id order by a.id desc limit 100"))));
  return { notifyStaff, linkAtt };
}
