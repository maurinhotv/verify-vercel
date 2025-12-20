export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const code = String(req.query.code || "");
  if (!code) return res.status(400).json({ error: "missing_code" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "missing_supabase_env" });

  const r = await fetch(
    `${url}/rest/v1/verification_codes?code=eq.${encodeURIComponent(code)}&select=verified,expires_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!r.ok) return res.status(502).json({ error: "supabase_get_failed" });

  const rows = await r.json().catch(() => []);
  const row = rows?.[0];
  if (!row) return res.json({ verified: false });

  const expired = new Date(row.expires_at).getTime() <= Date.now();
  if (expired) return res.json({ verified: false });

  return res.json({ verified: !!row.verified });
}
