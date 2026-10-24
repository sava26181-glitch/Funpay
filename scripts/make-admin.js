import pg from "pg";
const email = (process.argv[2] || "").toLowerCase();
if (!email) { console.error("usage: npm run make-admin -- you@mail.com"); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
const r = await pool.query("update users set role=$2 where email=$1", [email, process.argv[3] || 'owner']);
console.log(r.rowCount ? "role granted (default: owner)" : "user not found (register first)");
await pool.end();
