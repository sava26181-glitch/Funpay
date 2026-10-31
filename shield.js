// Защита от флуда и спама без внешних пакетов (в памяти процесса).
// Работает на уровне приложения: режет частые запросы, банит флудеров на время, ограничивает регистрации, сообщения, обращения,
// проверяет honeypot и (если задано) капчу Cloudflare Turnstile. Объёмные DDoS (L3/L4) нужно гасить на входе: Cloudflare.
const env = () => process.env;
const store = new Map(); // key -> { n, t }
const bans = new Map();  // ip -> until
const strikes = new Map(); // ip -> { n, t }
const MAX_KEYS = 200000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (now > v.t) store.delete(k);
  for (const [k, v] of bans) if (now > v) bans.delete(k);
  for (const [k, v] of strikes) if (now > v.t) strikes.delete(k);
}, 30000).unref();

// счётчик в окне; возвращает {ok, retry} (секунд)
export function hit(key, limit, windowMs) {
  const now = Date.now(); let e = store.get(key);
  if (!e || now > e.t) { if (store.size > MAX_KEYS) store.clear(); e = { n: 0, t: now + windowMs }; store.set(key, e); }
  e.n++;
  return { ok: e.n <= limit, retry: Math.max(1, Math.ceil((e.t - now) / 1000)) };
}
export const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;
function tooMany(res, retry, msg) { res.setHeader("Retry-After", String(retry)); return res.status(429).json({ error: msg || "too many requests", retry }); }

// 1) самый ранний слой: настоящий IP за Cloudflare, бан, общий лимит по IP, длина URL, методы
export function shieldEarly() {
  return (req, res, next) => {
    if (env().CF_PROXY === "1") { const c = String(req.headers["cf-connecting-ip"] || "").trim(); if (IP_RE.test(c)) Object.defineProperty(req, "ip", { value: c, configurable: true }); }
    if (req.url.length > 2000) return res.status(414).end();
    if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(req.method)) return res.status(405).end();
    if (req.path === "/health") return next();
    const ip = String(req.ip || "?"), now = Date.now(), until = bans.get(ip);
    if (until && now < until) return tooMany(res, Math.ceil((until - now) / 1000), "temporarily blocked");
    const api = req.path.startsWith("/api/");
    const lim = api ? +env().SHIELD_API_PER_MIN || 600 : +env().SHIELD_WEB_PER_MIN || 1200;
    const r = hit((api ? "a:" : "w:") + ip, lim, 60e3);
    if (!r.ok) {
      const s = strikes.get(ip) || { n: 0, t: now + 60e3 }; s.n++; strikes.set(ip, s);
      if (s.n >= 30) { bans.set(ip, now + 10 * 60e3); strikes.delete(ip); console.warn("[shield] ban", ip); }
      return tooMany(res, r.retry);
    }
    next();
  };
}

// 2) правила по путям (после разбора JSON и определения пользователя)
const RULES = [
  ["POST", /^\/api\/auth\/register$/, 5, 3600e3, "ip", "too many registrations"],
  ["POST", /^\/api\/auth\/login$/, 25, 600e3, "ip", "too many attempts"],
  ["POST", /^\/api\/auth\/reset\/request$/, 8, 3600e3, "ip", "too many attempts"],
  ["POST", /^\/api\/auth\/reset\/confirm$/, 15, 3600e3, "ip", "too many attempts"],
  ["POST", /^\/api\/conversations\/[^/]+\/messages$/, 40, 60e3, "user", "too many messages"],
  ["POST", /^\/api\/disputes\/[^/]+\/messages$/, 30, 60e3, "user", "too many messages"],
  ["POST", /^\/api\/tickets$/, 6, 3600e3, "user", "too many tickets"],
  ["POST", /^\/api\/tickets\/[^/]+\/messages$/, 20, 60e3, "user", "too many messages"],
  ["POST", /^\/api\/reports$/, 10, 3600e3, "user", "too many reports"],
  ["POST", /^\/api\/listings$/, 30, 86400e3, "user", "too many listings"],
  ["POST", /^\/api\/orders$/, 30, 3600e3, "user", "too many orders"],
  ["POST", /^\/api\/orders\/[^/]+\/(review|dispute)$/, 20, 3600e3, "user", "too many requests"],
];
const BAD_MAIL = new Set("mailinator.com,guerrillamail.com,10minutemail.com,tempmail.com,temp-mail.org,trashmail.com,yopmail.com,sharklasers.com,getnada.com,dispostable.com,maildrop.cc,throwawaymail.com,fakeinbox.com,mintemail.com".split(","));
export function shieldRules() {
  return (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const ip = String(req.ip || "?"), uid = req.user?.id;
    // общий лимит на изменяющие запросы: на пользователя (или IP, если не вошёл)
    const g = hit("wr:" + (uid || ip), uid ? 120 : 60, 60e3); if (!g.ok) return tooMany(res, g.retry);
    for (const [m, re, limit, win, by, msg] of RULES) {
      if (req.method === m && re.test(req.path)) {
        const r = hit(`r:${re.source}:${by === "user" ? (uid || ip) : ip}`, limit, win); if (!r.ok) return tooMany(res, r.retry, msg);
        break;
      }
    }
    // по email: не больше N попыток на один аккаунт, чтобы нельзя было перебирать пароль с разных IP
    const em = String(req.body?.email || "").trim().toLowerCase().slice(0, 120);
    if (em && req.method === "POST") {
      if (req.path === "/api/auth/login") { const r = hit("le:" + em, 12, 15 * 60e3); if (!r.ok) return tooMany(res, r.retry, "too many attempts"); }
      if (req.path === "/api/auth/reset/request") { const r = hit("re:" + em, 4, 3600e3); if (!r.ok) return tooMany(res, r.retry, "too many attempts"); }
    }
    next();
  };
}

// 3) антибот для регистрации и запроса сброса: honeypot, одноразовые почты, Turnstile (если задан TURNSTILE_SECRET)
export async function verifyTurnstile(token, ip) {
  const secret = env().TURNSTILE_SECRET; if (!secret) return true;
  if (!token || typeof token !== "string" || token.length > 2100) return false;
  try {
    const r = await fetch(env().TURNSTILE_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }), signal: AbortSignal.timeout(8000) });
    const d = await r.json(); return d.success === true;
  } catch (e) { console.error("[turnstile]", e.message); return false; }
}
export function antibot({ strictMail = false } = {}) {
  return async (req, res, next) => {
    const b = req.body || {};
    if (b.hp) return res.status(400).json({ error: "invalid input" });          // honeypot: человек это поле не видит
    if (strictMail) { const d = String(b.email || "").split("@")[1]?.toLowerCase(); if (d && BAD_MAIL.has(d)) return res.status(400).json({ error: "disposable email" }); }
    if (!(await verifyTurnstile(b.cf, req.ip))) return res.status(400).json({ error: "captcha" });
    next();
  };
}
export const turnstileSiteKey = () => (env().TURNSTILE_SECRET && env().TURNSTILE_SITEKEY) ? env().TURNSTILE_SITEKEY : "";
