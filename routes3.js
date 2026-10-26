import express from "express"; import crypto from "crypto"; import rateLimit from "express-rate-limit"; import { makeStorage } from "./storage.js";
export default function routes3(app, { q, pool, tx, E, wrap, need, pushUser, hooks }) {
  const env = process.env, stor = makeStorage(env, env.DATABASE_URL), ST = ["moderator", "admin", "owner"];

  // ---------- перевод сообщений чата (читающая сторона выбирает язык) ----------
  const LANGS = ["ru", "en", "de", "es", "fr", "it", "pt", "tr", "uk", "pl", "zh", "ja", "ko", "ar"], DL = { en: "EN-US", pt: "PT-BR" };
  const prov = () => env.DEEPL_API_KEY ? "deepl" : env.GOOGLE_TRANSLATE_API_KEY ? "google" : env.LIBRETRANSLATE_URL ? "libre" : null;
  const translate = async (text, target) => {
    const p = prov(), J = { "Content-Type": "application/json" };
    if (p === "deepl") { const key = env.DEEPL_API_KEY, host = (env.DEEPL_API_URL || (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com")).replace(/\/$/, ""); const r = await fetch(host + "/v2/translate", { method: "POST", headers: { ...J, Authorization: "DeepL-Auth-Key " + key }, body: JSON.stringify({ text: [text], target_lang: DL[target] || target.toUpperCase() }) }); if (!r.ok) throw new Error("deepl HTTP " + r.status); const t = (await r.json()).translations[0]; return { text: t.text, detected: String(t.detected_source_language || "").toLowerCase() }; }
    if (p === "google") { const r = await fetch("https://translation.googleapis.com/language/translate/v2?key=" + encodeURIComponent(env.GOOGLE_TRANSLATE_API_KEY), { method: "POST", headers: J, body: JSON.stringify({ q: text, target, format: "text" }) }); if (!r.ok) throw new Error("google HTTP " + r.status); const t = (await r.json()).data.translations[0]; return { text: t.translatedText, detected: String(t.detectedSourceLanguage || "").toLowerCase() }; }
    if (p === "libre") { const r = await fetch(env.LIBRETRANSLATE_URL.replace(/\/$/, "") + "/translate", { method: "POST", headers: J, body: JSON.stringify({ q: text, source: "auto", target, format: "text", api_key: env.LIBRETRANSLATE_API_KEY || undefined }) }); if (!r.ok) throw new Error("libre HTTP " + r.status); const d = await r.json(); return { text: d.translatedText, detected: String(d.detectedLanguage?.language || "").toLowerCase() }; }
    throw new Error("no provider");
  };
  app.get("/api/translate/status", wrap(async (_req, res) => res.json({ configured: !!prov(), provider: prov(), languages: LANGS, missing: prov() ? [] : ["DEEPL_API_KEY или GOOGLE_TRANSLATE_API_KEY или LIBRETRANSLATE_URL"] })));
  app.post("/api/messages/:id/translate", need, rateLimit({ windowMs: 600e3, limit: 200 }), wrap(async (req, res) => {
    const target = String(req.body?.target || ""); if (!LANGS.includes(target)) throw E(400, "bad language");
    if (!prov()) return res.status(503).json({ error: "translation unavailable" });
    const [m] = await q("select m.body from messages m join conversations c on c.id=m.conversation_id where m.id=$1 and $2 in (c.buyer_id,c.seller_id)", [req.params.id, req.user.id]); if (!m) throw E(404, "not found");
    if (m.body === "[вложение]") return res.json({ same: true });
    const h = crypto.createHash("sha256").update(m.body).digest("hex"); let [r] = await q("select translated,detected from translations where hash=$1 and target=$2", [h, target]);
    if (!r) { let t; try { t = await translate(m.body, target); } catch (e) { console.error("[translate]", e.message); throw E(502, "translation failed"); } r = { translated: t.text, detected: t.detected || null }; await q("insert into translations(hash,target,translated,detected) values($1,$2,$3,$4) on conflict do nothing", [h, target, r.translated, r.detected]); }
    res.json({ translated: r.translated, detected: r.detected, same: (!!r.detected && r.detected === target) || r.translated.trim() === m.body.trim() });
  }));

  // ---------- история цены и отслеживание ----------
  app.get("/api/listings/:id/price-history", wrap(async (req, res) => {
    const [l] = await q("select id from listings where id=$1 and (status='active' or seller_id=$2)", [req.params.id, req.user?.id || null]); if (!l) throw E(404, "not found");
    res.json(await q("select price_cents,created_at from price_history where listing_id=$1 order by created_at", [l.id]));
  }));
  app.get("/api/listings/:id/watch", need, wrap(async (req, res) => { const [w] = await q("select target_cents from price_watch where user_id=$1 and listing_id=$2", [req.user.id, req.params.id]); res.json({ watching: !!w, target_cents: w?.target_cents ?? null }); }));
  app.put("/api/watch/:id", need, wrap(async (req, res) => {
    const [l] = await q("select id,price_cents,seller_id from listings where id=$1 and status='active'", [req.params.id]); if (!l) throw E(404, "listing unavailable"); if (l.seller_id === req.user.id) throw E(400, "own listing");
    const t = req.body?.target == null || req.body.target === "" ? null : Math.round(+req.body.target * 100); if (t !== null && !(t > 0)) throw E(400, "bad target");
    await q("insert into price_watch(user_id,listing_id,last_seen_cents,target_cents) values($1,$2,$3,$4) on conflict (user_id,listing_id) do update set target_cents=excluded.target_cents", [req.user.id, l.id, l.price_cents, t]); res.json({ ok: true });
  }));
  app.delete("/api/watch/:id", need, wrap(async (req, res) => { await q("delete from price_watch where user_id=$1 and listing_id=$2", [req.user.id, req.params.id]); res.json({ ok: true }); }));
  app.get("/api/watch", need, wrap(async (req, res) => res.json(await q(`select l.id,l.title,l.price_cents,l.image_media,g.name game_name,u.username seller,w.target_cents,w.created_at watch_since,
    (select price_cents from price_history h where h.listing_id=l.id order by h.created_at limit 1) first_cents,
    (select min(price_cents) from price_history h where h.listing_id=l.id) min_cents,(select max(price_cents) from price_history h where h.listing_id=l.id) max_cents,
    (select price_cents from price_history h where h.listing_id=l.id and h.created_at<=w.created_at order by h.created_at desc limit 1) price_at_watch,
    (select coalesce(json_agg(json_build_object('p',x.price_cents,'t',x.created_at) order by x.created_at),'[]'::json) from (select price_cents,created_at from price_history where listing_id=l.id order by created_at desc limit 40) x) spark
    from price_watch w join listings l on l.id=w.listing_id join games g on g.id=l.game_id join users u on u.id=l.seller_id where w.user_id=$1 and l.status='active' order by w.created_at desc`, [req.user.id]))));
  hooks.priceChanged = async listingId => { const ns = await q("select id,user_id,payload from notifications where type='price_drop' and payload->>'listing_id'=$1 and read_at is null and created_at>now()-interval '15 seconds'", [String(listingId)]); for (const n of ns) pushUser(n.user_id, "notify", { id: n.id, type: "price_drop", ...n.payload }); };

  // ---------- уведомления ----------
  app.get("/api/notifications", need, wrap(async (req, res) => res.json(await q("select id,type,payload,read_at,created_at from notifications where user_id=$1 order by created_at desc limit 60", [req.user.id]))));
  app.get("/api/notifications/count", need, wrap(async (req, res) => { const [r] = await q("select count(*)::int n from notifications where user_id=$1 and read_at is null", [req.user.id]); res.json(r); }));
  app.post("/api/notifications/read", need, wrap(async (req, res) => { await q("update notifications set read_at=now() where user_id=$1 and read_at is null", [req.user.id]); res.json({ ok: true }); }));

  // ---------- видео-подтверждение выдачи ----------
  const sniff = b => { if (b.length < 16) return null; if (b.slice(4, 8).toString() === "ftyp") return b.slice(8, 12).toString() === "qt  " ? "video/quicktime" : "video/mp4"; if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm"; return null; };
  const mp4dur = b => { const i = b.indexOf("mvhd"); if (i < 0 || i + 32 > b.length) return null; const v = b[i + 4]; if (v === 0) { const ts = b.readUInt32BE(i + 16); return ts ? b.readUInt32BE(i + 20) / ts : null; } if (v === 1) { const ts = b.readUInt32BE(i + 24); return ts ? Number(b.readBigUInt64BE(i + 28)) / ts : null; } return null; };
  app.post("/api/orders/:id/delivery-video", need, express.raw({ type: "application/octet-stream", limit: "32mb" }), wrap(async (req, res) => {
    if (!stor.on) return res.status(503).json({ error: "storage not configured", missing: ["SUPABASE_SERVICE_ROLE_KEY"] });
    const [o] = await q("select id,buyer_id,seller_id,status from orders where id=$1", [req.params.id]); if (!o || o.seller_id !== req.user.id) throw E(404, "not found"); if (o.status === "cancelled") throw E(409, "order cancelled");
    const b = req.body; if (!Buffer.isBuffer(b)) throw E(400, "bad upload"); const m = sniff(b); if (!m) throw E(400, "Допустимы видео MP4, MOV, WebM");
    if (b.length > 30e6 || (m === "video/webm" && b.length > 15e6)) throw E(400, "Видео слишком большое (до 30 МБ)");
    if (m !== "video/webm") { const d = mp4dur(b); if (d == null) throw E(400, "Не удалось определить длительность видео"); if (d < 2 || d > 20) throw E(400, `Длительность видео должна быть 2–20 секунд (сейчас ${Math.round(d)} с)`); }
    const [c] = await q("select count(*)::int n from attachments where context='delivery' and ref_id=$1", [o.id]); if (c.n >= 3) throw E(409, "Не больше 3 видео на заказ");
    const path = `delivery/${o.id}/${crypto.randomUUID()}.${m === "video/webm" ? "webm" : m === "video/quicktime" ? "mov" : "mp4"}`;
    try { await stor.put(stor.PRIV, path, b, m); } catch (e) { console.error("[storage]", e.message); throw E(502, "Хранилище недоступно: " + e.message); }
    const [a] = await q("insert into attachments(owner_id,context,ref_id,bucket,path,mime,size,name) values($1,'delivery',$2,$3,$4,$5,$6,'delivery-video') returning id,mime,size,created_at", [req.user.id, o.id, stor.PRIV, path, m, b.length]);
    const [n] = await q("insert into notifications(user_id,type,payload) values($1,'delivery_video',$2) returning id,payload", [o.buyer_id, { order_id: o.id }]); pushUser(o.buyer_id, "notify", { id: n.id, type: "delivery_video", ...n.payload });
    res.status(201).json(a);
  }));
  app.get("/api/orders/:id/videos", need, wrap(async (req, res) => {
    const [o] = await q("select buyer_id,seller_id from orders where id=$1", [req.params.id]); const [u] = await q("select role from users where id=$1", [req.user.id]);
    if (!o || !([o.buyer_id, o.seller_id].includes(req.user.id) || ST.includes(u?.role))) throw E(404, "not found");
    res.json(await q("select id,mime,size,created_at from attachments where context='delivery' and ref_id=$1 order by created_at", [req.params.id]));
  }));
  return { translate, sniff, mp4dur };
}
