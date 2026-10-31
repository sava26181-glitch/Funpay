// Отправка писем без внешних пакетов.
// Вариант 1: Resend (RESEND_API_KEY + MAIL_FROM). Вариант 2: SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
import net from "node:net"; import tls from "node:tls";
const env = () => process.env;
export const mailConfigured = () => !!(env().MAIL_RELAY_URL && env().MAIL_RELAY_SECRET) || !!((env().RESEND_API_KEY || env().BREVO_API_KEY || env().SMTP2GO_API_KEY || (env().MAILJET_API_KEY && env().MAILJET_SECRET_KEY) || env().SMTP_HOST) && env().MAIL_FROM);
// понятный текст причины вместо "AggregateError"
export const mailErr = e => { const parts = []; const add = x => { if (!x) return; const c = x.code || x.cause?.code; const m = x.message && x.message !== "fetch failed" ? x.message : ""; parts.push([c, m || (x.address && x.port ? x.address + ":" + x.port : "")].filter(Boolean).join(" ")) }; if (Array.isArray(e?.errors) && e.errors.length) e.errors.forEach(add); else if (e?.cause?.errors?.length) e.cause.errors.forEach(add); else { add(e?.cause); if (!parts.length) add(e) } const t = [...new Set(parts.filter(Boolean))].join("; ") || String(e?.message || e); return /ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/.test(t) ? t + " (сервер не может подключиться к почтовому серверу: на бесплатном Render SMTP-порты закрыты, используйте API-способ: Brevo, Mailjet, SMTP2GO или Resend)" : t };
const addr = s => (/<([^>]+)>/.exec(s) || [null, s])[1].trim();
const b64 = s => Buffer.from(s, "utf8").toString("base64");
const clean = s => String(s).replace(/[\r\n]+/g, " ");

async function viaResend({ to, subject, text }) {
  const r = await fetch(env().RESEND_URL || "https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env().RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env().MAIL_FROM, to: [to], subject, text }) });
  if (!r.ok) { let d = ""; try { d = (await r.json()).message || "" } catch { } throw new Error("Resend " + r.status + (d ? ": " + d : "")) }
}

const fromParts = () => { const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(env().MAIL_FROM); return m ? { name: (m[1] || "DonutPay").trim() || "DonutPay", email: m[2].trim() } : { name: "DonutPay", email: env().MAIL_FROM.trim() } };
async function viaSmtp2go({ to, subject, text }) {
  const f = fromParts();
  const r = await fetch(env().SMTP2GO_URL || "https://api.smtp2go.com/v3/email/send", { method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ api_key: env().SMTP2GO_API_KEY, sender: `${f.name} <${f.email}>`, to: [to], subject, text_body: text }) });
  let d = {}; try { d = await r.json() } catch { }
  if (!r.ok || (d.data && d.data.error)) throw new Error("SMTP2GO " + r.status + (d.data?.error ? ": " + d.data.error : ""));
}
async function viaMailjet({ to, subject, text }) {
  const f = fromParts();
  const r = await fetch(env().MAILJET_URL || "https://api.mailjet.com/v3.1/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(env().MAILJET_API_KEY + ":" + env().MAILJET_SECRET_KEY).toString("base64") }, body: JSON.stringify({ Messages: [{ From: { Email: f.email, Name: f.name }, To: [{ Email: to }], Subject: subject, TextPart: text }] }) });
  let d = {}; try { d = await r.json() } catch { }
  if (!r.ok) throw new Error("Mailjet " + r.status + (d.ErrorMessage ? ": " + d.ErrorMessage : d.Messages?.[0]?.Errors?.[0]?.ErrorMessage ? ": " + d.Messages[0].Errors[0].ErrorMessage : ""));
}
async function viaBrevo({ to, subject, text }) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(env().MAIL_FROM), sender = m ? { name: (m[1] || "DonutPay").trim() || "DonutPay", email: m[2].trim() } : { name: "DonutPay", email: env().MAIL_FROM.trim() };
  const r = await fetch(env().BREVO_URL || "https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": env().BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text }) });
  if (!r.ok) { let d = ""; try { d = (await r.json()).message || "" } catch { } throw new Error("Brevo " + r.status + (d ? ": " + d : "")) }
}

function viaSmtp({ to, subject, text }) {
  const host = env().SMTP_HOST, port = +env().SMTP_PORT || 465, implicit = port === 465;
  return new Promise((resolve, reject) => {
    let sock, buf = "", step = 0, done = false, secured = implicit, hasTls = false;
    const fail = e => { if (!done) { done = true; try { sock.destroy() } catch { } reject(e) } };
    const timer = setTimeout(() => fail(new Error("smtp timeout")), 20000);
    const send = l => sock.write(l + "\r\n");
    const from = addr(env().MAIL_FROM);
    const msg = ["From: " + clean(env().MAIL_FROM), "To: " + clean(to), "Subject: =?UTF-8?B?" + b64(subject) + "?=", "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(text).replace(/(.{76})/g, "$1\r\n")].join("\r\n");
    const auth = env().SMTP_USER ? ["AUTH LOGIN", b64(env().SMTP_USER), b64(env().SMTP_PASS || "")] : [];
    const script = () => [...auth, "MAIL FROM:<" + from + ">", "RCPT TO:<" + addr(to) + ">", "DATA", null, "QUIT"];
    let queue = null;
    const onLine = line => {
      const code = +line.slice(0, 3);
      if (step === 0) { if (code !== 220) return fail(new Error("smtp greet " + code)); step = 1; return send("EHLO donutpay") }
      if (step === 1) { if (code !== 250) return fail(new Error("smtp ehlo " + code));
        if (!secured && !implicit && !hasTls && env().SMTP_ALLOW_PLAIN !== "1") return fail(new Error("smtp: server has no STARTTLS"));
        if (!secured && !implicit && hasTls) { step = 2; return send("STARTTLS") }
        queue = script(); step = 4; return next() }
      if (step === 2) { if (code !== 220) return fail(new Error("smtp starttls " + code)); sock = tls.connect({ socket: sock, servername: host }, () => { secured = true; step = 3; send("EHLO donutpay") }); sock.on("data", onData); sock.on("error", fail); buf = ""; return }
      if (step === 3) { if (code !== 250) return fail(new Error("smtp ehlo2 " + code)); queue = script(); step = 4; return next() }
      if (step === 4) { if (code >= 400) return fail(new Error("smtp " + code)); return next() }
      if (step === 5) { clearTimeout(timer); done = true; try { sock.end() } catch { } resolve() }
    };
    const next = () => { const c = queue.shift(); if (c === undefined) return; if (c === null) { send(msg.replace(/^\./gm, "..") + "\r\n."); step = 4; queue.unshift("__end__"); return } if (c === "__end__") { step = 4; return next() } if (c === "QUIT") { send("QUIT"); step = 5; return } send(c) };
    const onData = d => { buf += d.toString(); let i; while ((i = buf.indexOf("\r\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2); if (/STARTTLS/i.test(line)) hasTls = true; if (/^\d{3}-/.test(line)) continue; onLine(line) } };
    sock = implicit ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    sock.on("data", onData); sock.on("error", fail);
  });
}

async function viaRelay({ to, subject, text }) {
  const r = await fetch(env().MAIL_RELAY_URL.replace(/\/+$/, "").replace(/\/exec$/, "/exec") + (/\/exec$/.test(env().MAIL_RELAY_URL) ? "" : "/send"), { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8", "X-Relay-Secret": env().MAIL_RELAY_SECRET }, body: JSON.stringify({ to, subject, text, secret: env().MAIL_RELAY_SECRET }), signal: AbortSignal.timeout(30000) });
  let d = {}; try { d = await r.json() } catch { }
  if (!r.ok || d.ok !== true) throw new Error("Relay " + r.status + (d.error ? ": " + d.error : ""));
}

export async function sendMail(o) {
  if (!mailConfigured()) throw new Error("mail not configured");
  if (env().MAIL_RELAY_URL && env().MAIL_RELAY_SECRET) return viaRelay(o);
  if (env().RESEND_API_KEY) return viaResend(o);
  if (env().BREVO_API_KEY) return viaBrevo(o);
  if (env().SMTP2GO_API_KEY) return viaSmtp2go(o);
  if (env().MAILJET_API_KEY && env().MAILJET_SECRET_KEY) return viaMailjet(o);
  return viaSmtp(o);
}
