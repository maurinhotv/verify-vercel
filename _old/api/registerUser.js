import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { username, password } = req.body || {};
  const user = String(username || "").trim();
  const pass = String(password || "");

  if (user.length < 3 || pass.length < 6) {
    return res.json({ ok: false, msg: "Usuário ou senha inválidos" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ ok: false, msg: "Erro interno" });
  }

  // Verifica se já existe
  const check = await fetch(
    `${url}/rest/v1/users?username=eq.${encodeURIComponent(user)}&select=id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  const exists = await check.json();
  if (exists.length) {
    return res.json({ ok: false, msg: "Usuário já existe" });
  }

  const hash = await bcrypt.hash(pass, 10);

  const insert = await fetch(`${url}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: user,
      password_hash: hash,
      vip: "none"
    })
  });

  if (!insert.ok) {
    return res.json({ ok: false, msg: "Erro ao criar conta" });
  }

  return res.json({ ok: true });
}
