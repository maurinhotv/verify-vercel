export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { code } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).json({ error: "invalid_code" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "missing_supabase_env" });

  // Busca o registro e checa expiração
  const getRes = await fetch(
    `${url}/rest/v1/verification_codes?code=eq.${encodeURIComponent(code)}&select=code,verified,expires_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!getRes.ok) return res.status(502).json({ error: "supabase_get_failed" });

  const rows = await getRes.json().catch(() => []);
  const row = rows?.[0];
  if (!row) return res.status(404).json({ error: "not_found_or_expired" });

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return res.status(404).json({ error: "not_found_or_expired" });
  }

  // Marca como verificado
  const patchRes = await fetch(
    `${url}/rest/v1/verification_codes?code=eq.${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ verified: true })
    }
  );

  if (!patchRes.ok) return res.status(502).json({ error: "supabase_update_failed" });

  return res.json({ ok: true, verified: true });
}
