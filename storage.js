// Клиент Supabase Storage (REST). Service role key используется только на сервере.
export function makeStorage(env, dbUrl = "") {
  const ref = (dbUrl.match(/postgres\.([a-z0-9]+)[:@]/) || [])[1];
  const URL_ = (env.SUPABASE_URL || (ref ? `https://${ref}.supabase.co` : "")).replace(/\/$/, ""), KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const PUB = env.SUPABASE_PUBLIC_BUCKET || "donutpay-public", PRIV = env.SUPABASE_PRIVATE_BUCKET || "donutpay-private";
  const on = !!(URL_ && KEY), h = x => String(KEY || "").startsWith("sb_") ? { apikey: KEY, ...x } : { Authorization: `Bearer ${KEY}`, apikey: KEY, ...x };
  const fail = async (what, r) => { const t = (await r.text().catch(() => "")).slice(0, 200); return new Error(`${what}: HTTP ${r.status} ${t}`); };
  const st = (p, o) => fetch(`${URL_}/storage/v1${p}`, o);
  const publicUrl = (b, p) => `${URL_}/storage/v1/object/public/${b}/${p}`;
  return {
    on, PUB, PRIV, url: URL_, publicUrl,
    async ensure() {
      if (!on) return "not configured"; const out = [];
      for (const [id, pub] of [[PUB, true], [PRIV, false]]) {
        const r = await st("/bucket", { method: "POST", headers: h({ "Content-Type": "application/json" }), body: JSON.stringify({ id, name: id, public: pub }) }); const t = await r.text();
        out.push(`${id}: ${r.ok ? "created" : /exist|duplicate/i.test(t) ? "exists" : "error " + r.status + " " + t.slice(0, 120)}`);
      } if (out.some(x => /error/.test(x))) throw new Error(out.join("; ")); return out.join(", ");
    },
    async put(b, p, buf, mime) { const r = await st(`/object/${b}/${p}`, { method: "POST", headers: h({ "Content-Type": mime, "x-upsert": "false" }), body: buf }); if (!r.ok) throw await fail("загрузка в Storage не удалась", r); },
    async del(b, p) { await st(`/object/${b}/${p}`, { method: "DELETE", headers: h() }).catch(() => {}); },
    async signed(b, p, sec = 60) { const r = await st(`/object/sign/${b}/${p}`, { method: "POST", headers: h({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: sec }) }); if (!r.ok) throw await fail("подписанная ссылка не создана", r); const d = await r.json(); return `${URL_}/storage/v1${d.signedURL}`; },
    async verify(b, p, size) { const r = await fetch(publicUrl(b, p)); return r.ok && (await r.arrayBuffer()).byteLength === size; }
  };
}
