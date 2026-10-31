// Отправка писем без внешних пакетов.
// Вариант 1: Resend (RESEND_API_KEY + MAIL_FROM). Вариант 2: SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
import net from "node:net"; import tls from "node:tls";
const env = () => process.env;
export const mailConfigured = () => !!((env().RESEND_API_KEY || env().SMTP_HOST) && env().MAIL_FROM);
const addr = s => (/<([^>]+)>/.exec(s) || [null, s])[1].trim();
const b64 = s => Buffer.from(s, "utf8").toString("base64");
const clean = s => String(s).replace(/[\r\n]+/g, " ");

async function viaResend({ to, subject, text }) {
  const r = await fetch(env().RESEND_URL || "https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env().RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: env().MAIL_FROM, to: [to], subject, text }) });
  if (!r.ok) throw new Error("mail provider " + r.status);
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

export async function sendMail(o) {
  if (!mailConfigured()) throw new Error("mail not configured");
  if (env().RESEND_API_KEY) return viaResend(o);
  return viaSmtp(o);
}
