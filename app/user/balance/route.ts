import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não definido");
  if (!service) throw new Error("SUPABASE_SERVICE_ROLE_KEY não definido");

  return createClient(url, service, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const token = (await cookies()).get("session_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const sb = supabaseAdmin();

    // Ajuste se sua tabela de sessões tiver outro nome/colunas:
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("user_id")
      .eq("token", token)
      .single();

    if (sErr || !session?.user_id) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const { data: user, error: uErr } = await sb
      .from("users")
      .select("id, username, diamonds")
      .eq("id", session.user_id)
      .single();

    if (uErr || !user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ diamonds: user.diamonds ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: "Erro interno", details: String(e?.message ?? e) }, { status: 500 });
  }
}
