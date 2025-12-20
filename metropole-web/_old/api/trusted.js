export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const serial = String(req.query.serial || "").trim();
  if (!serial) return res.status(400).json({ error: "missing_serial" });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: "missing_supabase_env" });

  const r = await fetch(
    `${url}/rest/v1/trusted_serials?serial=eq.${encodeURIComponent(serial)}&select=serial`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!r.ok) return res.status(502).json({ error: "supabase_get_failed" });

  const rows = await r.json().catch(() => []);
  return res.json({ trusted: !!rows?.[0] });
}
