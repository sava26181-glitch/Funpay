// DonutPay Mail Relay: маленький сервис, который сам отправляет письма через Яндекс (SMTP).
// Запускать там, где открыты исходящие SMTP-порты (свой ПК, VPS, Oracle/Hetzner и т.п.), НЕ на бесплатном Render.
// Сайт шлёт сюда HTTPS-запрос, relay отправляет письмо через smtp.yandex.ru.
import http from "node:http";
import crypto from "node:crypto";
import { sendMail, mailErr } from "./mailer.js";

const SECRET = process.env.RELAY_SECRET || "";
const PORT = +process.env.PORT || 8787;
if (SECRET.length < 16) { console.error("Задайте RELAY_SECRET (минимум 16 символов)"); process.exit(1) }
for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) if (!process.env[k]) { console.error("Не задано " + k); process.exit(1) }
// чтобы mailer.js в relay использовал только SMTP
for (const k of ["RESEND_API_KEY", "BREVO_API_KEY", "SMTP2GO_API_KEY", "MAILJET_API_KEY", "MAIL_RELAY_URL"]) delete process.env[k];

const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y) };
const hits = new Map(); // простой лимит: 30 писем в минуту
const limited = () => { const m = Math.floor(Date.now() / 60000); for (const k of hits.keys()) if (k !== m) hits.delete(k); const n = (hits.get(m) || 0) + 1; hits.set(m, n); return n > 30 };
const json = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)) };
const mailRe = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") return json(res, 200, { ok: true, service: "donutpay-mail-relay" });
  if (req.method !== "POST" || req.url !== "/send") return json(res, 404, { error: "not found" });
  if (!eq(req.headers["x-relay-secret"] || "", SECRET)) return json(res, 401, { error: "bad secret" });
  let body = "", big = false;
  req.on("data", d => { body += d; if (body.length > 20000) { big = true; req.destroy() } });
  req.on("end", async () => {
    if (big) return;
    let o; try { o = JSON.parse(body) } catch { return json(res, 400, { error: "bad json" }) }
    const { to, subject, text } = o || {};
    if (!mailRe.test(String(to || "")) || !subject || !text) return json(res, 400, { error: "bad fields" });
    if (limited()) return json(res, 429, { error: "rate limit" });
    try { await sendMail({ to, subject: String(subject).slice(0, 200), text: String(text).slice(0, 5000) }); json(res, 200, { ok: true }) }
    catch (e) { console.error("send fail:", mailErr(e)); json(res, 502, { error: mailErr(e) }) }
  });
}).listen(PORT, () => console.log("mail relay on :" + PORT));
