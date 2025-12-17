import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { username, password } = req.body || {};
  const user = String(username || "").trim();
  const pass = String(password || "");

  if (!user || !pass) return res.status(400).json({ ok: false, error: "missing_credentials" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: "missing_supabase_env" });

  // busca user
  const r = await fetch(
    `${url}/rest/v1/users?username=eq.${encodeURIComponent(user)}&select=id,username,password_hash,vip&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!r.ok) return res.status(502).json({ ok: false, error: "supabase_get_failed" });

  const rows = await r.json().catch(() => []);
  const row = rows?.[0];
  if (!row) return res.status(401).json({ ok: false, error: "invalid_login" });

  const ok = await bcrypt.compare(pass, row.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: "invalid_login" });

  // Retorne o que o MTA precisa (VIP já vem aqui)
  return res.json({
    ok: true,
    user_id: row.id,
    username: row.username,
    vip: row.vip || "none"
  });
}
