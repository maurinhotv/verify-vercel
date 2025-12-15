export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const secret = process.env.API_SECRET || "";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) return res.status(401).json({ error: "unauthorized" });

  const { code, ttlSeconds, serial, account } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "invalid_code" });

  const ttl = Math.min(Math.max(Number(ttlSeconds || 180), 30), 900);

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !upstashToken) return res.status(500).json({ error: "missing_upstash_env" });

  const payload = {
    verified: false,
    serial: String(serial || ""),
    account: String(account || ""),
    createdAt: Date.now()
  };

  // SET key value EX ttl
  const r = await fetch(`${upstashUrl}/set/verify:${encodeURIComponent(code)}/${encodeURIComponent(JSON.stringify(payload))}?EX=${ttl}`, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });

  if (!r.ok) return res.status(502).json({ error: "upstash_set_failed" });

  return res.json({ ok: true, ttlSeconds: ttl });
}
