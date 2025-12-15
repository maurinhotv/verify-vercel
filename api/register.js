export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const secret = process.env.API_SECRET || "GoiabaRP_2025#Verificacao";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) return res.status(401).json({ error: "unauthorized" });

  const { code, ttlSeconds, serial, account } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "invalid_code" });

  const ttl = Math.min(Math.max(Number(ttlSeconds || 180), 30), 900);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "missing_supabase_env" });

  const insertRes = await fetch(`${url}/rest/v1/verification_codes`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([{
      code,
      verified: false,
      serial: String(serial || ""),
      account: String(account || ""),
      expires_at: expiresAt
    }])
  });

  if (!insertRes.ok) {
    const t = await insertRes.text().catch(() => "");
    return res.status(502).json({ error: "supabase_insert_failed", details: t });
  }

  return res.json({ ok: true, ttlSeconds: ttl });
}
