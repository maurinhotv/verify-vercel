export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { code } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "invalid_code" });

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!upstashUrl || !upstashToken) return res.status(500).json({ error: "missing_upstash_env" });

  const key = `verify:${code}`;

  const getRes = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });

  if (!getRes.ok) return res.status(502).json({ error: "upstash_get_failed" });

  const getJson = await getRes.json();
  const raw = getJson?.result;
  if (!raw) return res.status(404).json({ error: "not_found_or_expired" });

  let data;
  try { data = JSON.parse(raw); } catch { return res.status(500).json({ error: "bad_payload" }); }

  data.verified = true;

  // Mantém o TTL atual: pega TTL e re-seta
  const ttlRes = await fetch(`${upstashUrl}/ttl/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });
  const ttlJson = await ttlRes.json();
  const ttl = Math.max(Number(ttlJson?.result || 60), 1);

  const setRes = await fetch(`${upstashUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(data))}?EX=${ttl}`, {
    headers: { Authorization: `Bearer ${upstashToken}` }
  });

  if (!setRes.ok) return res.status(502).json({ error: "upstash_set_failed" });

  return res.json({ ok: true, verified: true });
}
