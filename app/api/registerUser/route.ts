import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || password.length < 4) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { data: exists } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exists) {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);

  const { error } = await supabaseAdmin.from("users").insert({
    username,
    password_hash: hash,
    vip: "none",
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
