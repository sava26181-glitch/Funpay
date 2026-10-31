// v24: безопасность аккаунта — смена пароля и двухэтапная аутентификация (TOTP)
import bcrypt from "bcryptjs"; import rateLimit from "express-rate-limit";
import { newSecret, otpUri, verifyTotp, newBackupCodes, hashBackup } from "./totp.js"; import { mailConfigured } from "./mailer.js";
export default function routes9(app, { q, E, wrap, need, twofaCheck }) {
  const audit = (a, act, tt, tid, d) => q("insert into audit_log(actor_id,action,target_type,target_id,details) values($1,$2,$3,$4,$5)", [a, act, tt, String(tid ?? ""), d || {}]).catch(() => {});
  const rl = rateLimit({ windowMs: 15 * 60e3, limit: 20 });
  app.get("/api/me/security", need, wrap(async (req, res) => {
    const [u] = await q("select totp_enabled,jsonb_array_length(totp_backup)::int left_codes from users where id=$1", [req.user.id]);
    res.json({ twofa: !!u?.totp_enabled, backup_left: u?.left_codes || 0, email_mail: mailConfigured() });
  }));
  app.post("/api/me/password", need, rl, wrap(async (req, res) => {
    const cur = String(req.body?.current || ""), pw = String(req.body?.password || "");
    if (pw.length < 8 || pw.length > 200) throw E(400, "password too short");
    const [u] = await q("select password_hash from users where id=$1", [req.user.id]);
    if (!u || !(await bcrypt.compare(cur, u.password_hash))) throw E(403, "wrong password");
    await q("update users set password_hash=$2 where id=$1", [req.user.id, await bcrypt.hash(pw, 10)]);
    audit(req.user.id, "password_change", "user", req.user.id); res.json({ ok: true });
  }));
  app.post("/api/me/2fa/setup", need, rl, wrap(async (req, res) => {
    const [u] = await q("select email,totp_enabled from users where id=$1", [req.user.id]);
    if (u.totp_enabled) throw E(409, "2fa already enabled");
    const secret = newSecret(); await q("update users set totp_secret=$2 where id=$1", [req.user.id, secret]);
    res.json({ secret, uri: otpUri(secret, u.email) });
  }));
  app.post("/api/me/2fa/enable", need, rl, wrap(async (req, res) => {
    const [u] = await q("select totp_secret,totp_enabled from users where id=$1", [req.user.id]);
    if (!u?.totp_secret || u.totp_enabled) throw E(400, "invalid input");
    const st = verifyTotp(u.totp_secret, req.body?.code); if (st === null) throw E(400, "wrong 2fa code");
    const codes = newBackupCodes(); await q("update users set totp_enabled=true,totp_last_step=$2,totp_backup=$3::jsonb where id=$1", [req.user.id, st, JSON.stringify(codes.map(hashBackup))]);
    audit(req.user.id, "2fa_enable", "user", req.user.id); res.json({ ok: true, backup_codes: codes });
  }));
  app.post("/api/me/2fa/disable", need, rl, wrap(async (req, res) => {
    const [u] = await q("select password_hash,totp_enabled from users where id=$1", [req.user.id]);
    if (!u?.totp_enabled) throw E(400, "invalid input");
    if (!(await bcrypt.compare(String(req.body?.password || ""), u.password_hash))) throw E(403, "wrong password");
    if (!(await twofaCheck(req.user.id, req.body?.code))) throw E(400, "wrong 2fa code");
    await q("update users set totp_enabled=false,totp_secret=null,totp_backup='[]',totp_last_step=null where id=$1", [req.user.id]);
    audit(req.user.id, "2fa_disable", "user", req.user.id); res.json({ ok: true });
  }));
}
