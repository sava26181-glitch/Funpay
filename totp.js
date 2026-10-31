// TOTP (RFC 6238): SHA-1, 6 цифр, шаг 30 с. Без внешних пакетов.
import crypto from "node:crypto";
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const b32enc = buf => { let bits = 0, v = 0, o = ""; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += A[(v >>> (bits - 5)) & 31]; bits -= 5 } } if (bits) o += A[(v << (5 - bits)) & 31]; return o };
export const b32dec = s => { let bits = 0, v = 0; const o = []; for (const ch of String(s).replace(/=+$/, "").toUpperCase()) { const i = A.indexOf(ch); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8 } } return Buffer.from(o) };
export const newSecret = () => b32enc(crypto.randomBytes(20));
const hotp = (key, ctr) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(ctr)); const h = crypto.createHmac("sha1", key).update(b).digest(); const o = h[19] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0") };
export const stepNow = (t = Date.now()) => Math.floor(t / 30000);
// возвращает номер подошедшего шага или null (окно ±1 шаг)
export function verifyTotp(secret, code, t = Date.now()) {
  code = String(code || "").replace(/\s/g, ""); if (!/^\d{6}$/.test(code)) return null;
  const key = b32dec(secret), s = stepNow(t);
  for (const d of [0, -1, 1]) { const a = Buffer.from(hotp(key, s + d)), b = Buffer.from(code); if (crypto.timingSafeEqual(a, b)) return s + d }
  return null;
}
export const otpUri = (secret, label, issuer = "DonutPay") => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
export const hashBackup = c => crypto.createHash("sha256").update(String(c).toUpperCase().replace(/[\s-]/g, "")).digest("hex");
export const newBackupCodes = (n = 8) => Array.from({ length: n }, () => { const x = crypto.randomBytes(5).toString("hex").toUpperCase(); return x.slice(0, 5) + "-" + x.slice(5) });
export const hotpAt = (secret, step) => hotp(b32dec(secret), step); // для тестов
