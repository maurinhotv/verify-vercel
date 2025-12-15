export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const code = String(req.query.code || "");
  if (!code) return res.status(400).json({ error: "missing_code" });

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !upstashToken) return res.status(500).json({ error: "missing_upstash_env" });

  const key = `verify:${code}`;

  const r = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });

  if (!r.ok) return res.status(502).json({ error: "upstash_get_failed" });

  const j = await r.json();
  const raw = j?.result;
  if (!raw) return res.json({ verified: false });

  try {
    const data = JSON.parse(raw);
    return res.json({ verified: !!data.verified });
  } catch {
    return res.json({ verified: false });
  }
}
