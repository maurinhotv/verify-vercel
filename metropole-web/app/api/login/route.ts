import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, username, password_hash")
    .eq("username", username)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  }

  // cria sessão
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await supabaseAdmin.from("sessions").delete().eq("user_id", user.id);
  await supabaseAdmin.from("sessions").insert({
    token,
    user_id: user.id,
    expires_at: expires.toISOString(),
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, username: user.username },
  });

  res.cookies.set({
    name: "session_token",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: false, // localhost
    path: "/",
    expires,
  });

  return res;
}
