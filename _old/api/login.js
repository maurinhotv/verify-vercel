import bcrypt from "bcryptjs";

async function readRawBody(req) {
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    // ✅ Compatível com:
    // - Browser (req.body já vem objeto)
    // - MTA fetchRemote (body chega como texto cru)
    let bodyObj = req.body;

    if (!bodyObj || typeof bodyObj !== "object") {
      const raw = await readRawBody(req);
      try {
        bodyObj = JSON.parse(raw || "{}");
      } catch {
        bodyObj = {};
      }
    }

    const username = String(bodyObj.username || "").trim();
    const password = String(bodyObj.password || "");

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "missing_credentials" });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: "missing_supabase_env" });
    }

    const r = await fetch(
      `${url}/rest/v1/users?username=eq.${encodeURIComponent(username)}&select=id,username,password_hash,vip&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, error: "supabase_get_failed", details: t });
    }

    const rows = await r.json().catch(() => []);
    const user = rows?.[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: "invalid_login" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: "invalid_login" });
    }

    return res.json({
      ok: true,
      user_id: user.id,
      username: user.username,
      vip: user.vip || "none",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
